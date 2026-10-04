import { useCallback, useEffect, useRef, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import type { Session, User } from './types';
import { recordSignIn } from './api/analytics';
import { persist } from './storage';
import { isNative } from './platform';
import { nativeSignIn, nativeSignOut, type SignInProvider } from './nativeAuth';
import { apiUrl } from './apiBase';
import { PRIVACY_VERSION } from './privacy';

const KEY = 'psg.session';

function readSession(): Session {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { user: null, syncedAt: null };
    const parsed = JSON.parse(raw) as Session;
    if (parsed && typeof parsed === 'object' && 'user' in parsed) return parsed;
  } catch {
    /* ignore */
  }
  return { user: null, syncedAt: null };
}

function writeSession(s: Session) {
  try {
    persist(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Two-letter initials derived from a Google display name. Falls back to
 * the first letter of the email local-part if the name is unavailable. */
function deriveInitials(name: string, email: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    return (tokens[0][0] + tokens[tokens.length - 1][0]).toUpperCase();
  }
  if (tokens.length === 1 && tokens[0].length >= 2) {
    return tokens[0].slice(0, 2).toUpperCase();
  }
  const local = email.split('@')[0] ?? '';
  if (local.length >= 2) return local.slice(0, 2).toUpperCase();
  return local.slice(0, 1).toUpperCase() || 'U';
}

type GoogleUserInfo = {
  sub: string;
  name?: string;
  given_name?: string;
  email: string;
  picture?: string;
};

export function useSession() {
  const [session, setSession] = useState<Session>(() => readSession());
  const [error, setError] = useState<string | null>(null);
  // The Google access token, kept in memory only (never persisted). Used to
  // authenticate the admin control panel: the server re-verifies it against
  // Google + the admin-email allowlist. Null after a reload until re-sign-in.
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Cross-tab sync — keep both windows in step on sign-in / sign-out.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSession(readSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // The privacy policy version accepted for the sign-in in progress (null
  // for the admin panel, which signs in without it).
  const privacyVersion = useRef<string | null>(null);
  // Set while the web popup is confirming the account for deletion: the
  // token goes to deleteAccount() instead of signing in again.
  const reauth = useRef<{ resolve: (token: string) => void; reject: (err: Error) => void } | null>(null);

  const finishSignIn = useCallback((user: User) => {
    const next: Session = { user, syncedAt: Date.now() };
    writeSession(next);
    setSession(next);
    setError(null);
    // Best-effort: record the sign-in to Supabase (upsert profile +
    // bump count). Never blocks or throws into the auth flow.
    recordSignIn({ id: user.id, name: user.name, email: user.email, privacyVersion: privacyVersion.current });
  }, []);

  const login = useGoogleLogin({
    onSuccess: async (resp) => {
      if (reauth.current) {
        reauth.current.resolve(resp.access_token);
        reauth.current = null;
        return;
      }
      setAccessToken(resp.access_token ?? null);
      try {
        const r = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${resp.access_token}` } },
        );
        if (!r.ok) throw new Error(`userinfo ${r.status}`);
        const info = (await r.json()) as GoogleUserInfo;
        const name = info.name ?? info.given_name ?? info.email;
        finishSignIn({
          id: info.sub,
          name,
          email: info.email,
          initials: deriveInitials(name, info.email),
          avatarUrl: info.picture,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Google sign-in failed',
        );
      }
    },
    onNonOAuthError: () => {
      // Popup closed or blocked.
      reauth.current?.reject(new Error('cancelled'));
      reauth.current = null;
    },
    onError: (err) => {
      if (reauth.current) {
        reauth.current.reject(new Error('Google could not confirm your account.'));
        reauth.current = null;
        return;
      }
      setError(
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error: string }).error)
          : 'Google sign-in failed',
      );
    },
  });

  /** Web: Google's popup. Native apps: the OS sheet for `provider`.
   *  `privacyAccepted` is set by the Account screens, where signing in needs
   *  the privacy policy ticked; the version is stored on the profile. */
  const signIn = useCallback((provider: SignInProvider = 'google', opts?: { privacyAccepted?: boolean }) => {
    setError(null);
    privacyVersion.current = opts?.privacyAccepted ? PRIVACY_VERSION : null;
    if (isNative) {
      nativeSignIn(provider).then(
        // Tokens stay in memory: only the profile fields go into the session.
        ({ id, name, email, avatarUrl, accessToken: token }) => {
          setAccessToken(token);
          finishSignIn({ id, name, email, avatarUrl, initials: deriveInitials(name, email), provider });
        },
        (err: Error) => {
          if (err.message !== 'cancelled') setError(err.message);
        },
      );
      return;
    }
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError(
        'Google client ID missing — set VITE_GOOGLE_CLIENT_ID in .env.local',
      );
      return;
    }
    login();
  }, [login, finishSignIn]);

  const signOut = useCallback(() => {
    if (isNative) nativeSignOut(readSession().user?.provider ?? 'google');
    const next: Session = { user: null, syncedAt: null };
    writeSession(next);
    setSession(next);
    setAccessToken(null);
    setError(null);
  }, []);

  /**
   * Delete the account and everything linked to it on the server, then sign
   * out. The server only acts on a fresh sign-in token, so this first asks
   * the person to confirm their account (Google popup on the web, the OS
   * sheet in the apps). Call it straight from a click: the web popup must
   * open before any await. Rejects with a message to show, or `cancelled`.
   */
  const deleteAccount = useCallback(async () => {
    const user = readSession().user;
    if (!user) throw new Error('You are not signed in.');
    const provider: SignInProvider = user.provider ?? 'google';
    let proof: {
      provider: SignInProvider;
      accessToken?: string | null;
      idToken?: string | null;
      authorizationCode?: string | null;
    };
    if (isNative) {
      const p = await nativeSignIn(provider);
      if (p.id !== user.id) throw new Error('That is a different account from the one signed in here.');
      proof = { provider, accessToken: p.accessToken, idToken: p.idToken, authorizationCode: p.authorizationCode };
    } else {
      const token = await new Promise<string>((resolve, reject) => {
        reauth.current = { resolve, reject };
        login();
      });
      proof = { provider: 'google', accessToken: token };
    }
    const r = await fetch(apiUrl('/api/account/delete'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...proof, userId: user.id }),
    });
    const body = (await r.json().catch(() => null)) as { error?: string } | null;
    if (!r.ok) throw new Error(body?.error ?? `Could not delete the account (${r.status}).`);
    signOut();
  }, [login, signOut]);

  // Stamp the session once the cloud-saves merge actually completes, so
  // `syncedAt` reflects real sync state rather than just sign-in time.
  const markSynced = useCallback((ts: number = Date.now()) => {
    setSession((prev) => {
      if (!prev.user) return prev;
      const next: Session = { ...prev, syncedAt: ts };
      writeSession(next);
      return next;
    });
  }, []);

  return { session, user: session.user, accessToken, signIn, signOut, deleteAccount, markSynced, error };
}
