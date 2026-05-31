import { useCallback, useEffect, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import type { Session, User } from './types';
import { recordSignIn } from './api/analytics';

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
    localStorage.setItem(KEY, JSON.stringify(s));
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

  // Cross-tab sync — keep both windows in step on sign-in / sign-out.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setSession(readSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useGoogleLogin({
    onSuccess: async (resp) => {
      try {
        const r = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${resp.access_token}` } },
        );
        if (!r.ok) throw new Error(`userinfo ${r.status}`);
        const info = (await r.json()) as GoogleUserInfo;
        const name = info.name ?? info.given_name ?? info.email;
        const user: User = {
          id: info.sub,
          name,
          email: info.email,
          initials: deriveInitials(name, info.email),
          avatarUrl: info.picture,
        };
        const next: Session = { user, syncedAt: Date.now() };
        writeSession(next);
        setSession(next);
        setError(null);
        // Best-effort: record the sign-in to Supabase (upsert profile +
        // bump count). Never blocks or throws into the auth flow.
        recordSignIn({ id: user.id, name: user.name, email: user.email });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Google sign-in failed',
        );
      }
    },
    onError: (err) => {
      setError(
        typeof err === 'object' && err && 'error' in err
          ? String((err as { error: string }).error)
          : 'Google sign-in failed',
      );
    },
  });

  const signIn = useCallback(() => {
    setError(null);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError(
        'Google client ID missing — set VITE_GOOGLE_CLIENT_ID in .env.local',
      );
      return;
    }
    login();
  }, [login]);

  const signOut = useCallback(() => {
    const next: Session = { user: null, syncedAt: null };
    writeSession(next);
    setSession(next);
    setError(null);
  }, []);

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

  return { session, user: session.user, signIn, signOut, markSynced, error };
}
