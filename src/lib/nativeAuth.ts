import {
  SocialLogin,
  type AppleProviderResponse,
  type GoogleLoginResponse,
} from '@capgo/capacitor-social-login';
import { platform } from './platform';
import { persist } from './storage';

/**
 * Sign-in inside the native apps. Google blocks its web sign-in popup in an
 * embedded WebView, so the apps use the OS account sheets instead (Credential
 * Manager on Android, Google Sign-In and Sign in with Apple on iOS). The web
 * keeps @react-oauth/google (lib/auth.ts).
 *
 * Google gives the same account id (`sub`) here as on the web, so a person's
 * cloud saves carry over. Apple ids are prefixed `apple:` and are a separate
 * account.
 */

export type SignInProvider = 'google' | 'apple';

/** Buttons to offer, in order. App Store rule 4.8: an iOS app with Google
 *  sign-in must also offer Sign in with Apple. The web offers Google only. */
export const signInProviders: SignInProvider[] = platform === 'ios' ? ['apple', 'google'] : ['google'];

// Apple sends the person's name on the first sign-in only; remembered here
// so signing in again later still greets them by name.
const APPLE_NAME_KEY = 'psg.appleName';

let ready: Promise<void> | null = null;
function init(): Promise<void> {
  ready ??= SocialLogin.initialize({
    google: {
      // The Web client id: Android's Credential Manager asks for it, and it
      // must be in the same Google Cloud project as the Android client.
      webClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined,
      iOSClientId: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID as string | undefined,
      mode: 'online',
    },
    // Sign in with Apple is offered on iOS only (Android would need a server
    // redirect). The client id only tells the plugin which provider to set up.
    ...(platform === 'ios' ? { apple: { clientId: 'sg.wheretopark.app' } } : {}),
  }).catch((err: unknown) => {
    ready = null;
    throw err;
  });
  return ready;
}

/** Display-only claims from an ID token. Nothing here is trusted server-side. */
function tokenClaims(idToken: string | null): Record<string, unknown> {
  try {
    const part = idToken?.split('.')[1];
    if (!part) return {};
    const bytes = Uint8Array.from(atob(part.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

type Profile = { id: string; name: string; email: string; avatarUrl?: string };

function readAppleName(id: string): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(APPLE_NAME_KEY) ?? 'null') as { id: string; name: string } | null;
    return saved?.id === id ? saved.name : null;
  } catch {
    return null;
  }
}

/** Opens the OS sign-in sheet. Rejects with a user-facing message, or with
 *  `cancelled` when the person closes the sheet. */
export async function nativeSignIn(provider: SignInProvider): Promise<Profile & { accessToken: string | null }> {
  await init();
  try {
    const res = await SocialLogin.login(
      provider === 'google'
        ? // No `scopes`: openid/email/profile are the plugin's defaults, and on
          // Android passing any scopes needs a modified MainActivity.
          { provider: 'google', options: {} }
        : { provider: 'apple', options: { scopes: ['name', 'email'] } },
    );
    // login()'s result union doesn't narrow on `provider`, so cast per provider.
    if (provider === 'google') {
      const r = res.result as GoogleLoginResponse;
      if (r.responseType !== 'online') throw new Error('Unexpected Google response');
      const p = r.profile;
      const claims = tokenClaims(r.idToken);
      const id = p.id ?? (claims.sub as string | undefined);
      if (!id) throw new Error('Google did not return an account id');
      const email = p.email ?? (claims.email as string | undefined) ?? '';
      return {
        id,
        name: p.name ?? p.givenName ?? email,
        email,
        avatarUrl: p.imageUrl ?? undefined,
        accessToken: r.accessToken?.token ?? null,
      };
    }
    const r = res.result as AppleProviderResponse;
    const p = r.profile;
    const claims = tokenClaims(r.idToken);
    const sub = p.user || (claims.sub as string | undefined);
    if (!sub) throw new Error('Apple did not return an account id');
    const id = `apple:${sub}`;
    const email = p.email ?? (claims.email as string | undefined) ?? '';
    const given = [p.givenName, p.familyName].filter(Boolean).join(' ');
    if (given) persist(APPLE_NAME_KEY, JSON.stringify({ id, name: given }));
    return { id, name: given || readAppleName(id) || email || 'Apple user', email, accessToken: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Closing the sheet: Android reports USER_CANCELLED / "canceled", iOS
    // ASAuthorizationError 1001.
    if (/cancel|1001/i.test(msg)) throw new Error('cancelled', { cause: err });
    throw new Error(`${provider === 'apple' ? 'Apple' : 'Google'} sign-in failed: ${msg}`, { cause: err });
  }
}

/** Forget the OS-level sign-in so the account picker shows next time. */
export function nativeSignOut(provider: SignInProvider): void {
  void init()
    .then(() => SocialLogin.logout({ provider }))
    .catch(() => {});
}
