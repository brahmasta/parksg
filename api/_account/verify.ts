/**
 * Proves who is asking to delete an account. The app's anon RPCs take the
 * user id on trust, so deletion instead requires a fresh Google or Apple
 * token, checked here against our own client ids:
 *
 * - Google ID token (native apps) or access token (web popup): Google's
 *   tokeninfo endpoint validates it; `aud` / `azp` must be one of our clients.
 * - Apple ID token (iOS): signature checked against Apple's published keys,
 *   issuer appleid.apple.com, audience our bundle id.
 *
 * ID tokens must also be recent, so a token lifted from an old session can't
 * be replayed.
 */
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type Identity = { userId: string; email: string | null };
export type DeleteRequest = {
  provider?: unknown;
  accessToken?: unknown;
  idToken?: unknown;
  /** Apple only: lets the server revoke the grant (appleRevoke.ts). */
  authorizationCode?: unknown;
  userId?: unknown;
};

const MAX_ID_TOKEN_AGE_S = 10 * 60;
const APPLE_AUDIENCE = 'sg.wheretopark.app';
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

/** Our Google OAuth client ids: web (also used by Android) and iOS. */
export function googleClientIds(env: Record<string, string | undefined> = process.env): string[] {
  return [env.VITE_GOOGLE_CLIENT_ID, env.VITE_GOOGLE_IOS_CLIENT_ID, ...(env.GOOGLE_CLIENT_IDS ?? '').split(',')]
    .map((s) => (s ?? '').trim())
    .filter(Boolean);
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

type TokenInfo = {
  sub?: string;
  aud?: string;
  azp?: string;
  email?: string;
  email_verified?: string | boolean;
  iat?: string;
  error_description?: string;
};

async function verifyGoogle(accessToken: string | null, idToken: string | null): Promise<Identity> {
  const clients = googleClientIds();
  if (clients.length === 0) throw new HttpError(500, 'Google client ids are not configured.');
  const param = idToken ? `id_token=${encodeURIComponent(idToken)}` : `access_token=${encodeURIComponent(accessToken ?? '')}`;
  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?${param}`);
  const info = (await r.json().catch(() => ({}))) as TokenInfo;
  if (!r.ok || !info.sub) throw new HttpError(401, 'Your Google sign-in has expired. Please try again.');
  if (![info.aud, info.azp].some((a) => a && clients.includes(a))) {
    throw new HttpError(401, 'That Google sign-in is not for wheretopark.sg.');
  }
  if (idToken && (!info.iat || Date.now() / 1000 - Number(info.iat) > MAX_ID_TOKEN_AGE_S)) {
    throw new HttpError(401, 'Please confirm your Google account again.');
  }
  const verified = info.email_verified === true || info.email_verified === 'true';
  return { userId: info.sub, email: verified ? (info.email ?? null) : null };
}

async function verifyApple(idToken: string): Promise<Identity> {
  try {
    const { payload } = await jwtVerify(idToken, appleKeys, {
      issuer: 'https://appleid.apple.com',
      audience: APPLE_AUDIENCE,
      maxTokenAge: MAX_ID_TOKEN_AGE_S,
    });
    if (!payload.sub) throw new Error('no sub');
    const email = typeof payload.email === 'string' ? payload.email : null;
    return { userId: `apple:${payload.sub}`, email };
  } catch {
    throw new HttpError(401, 'Your Apple sign-in could not be confirmed. Please try again.');
  }
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** The verified account, which must also be the one the app says is signed in. */
export async function verifyDeleteRequest(body: DeleteRequest): Promise<Identity> {
  const provider = body.provider === 'apple' ? 'apple' : body.provider === 'google' ? 'google' : null;
  const accessToken = str(body.accessToken);
  const idToken = str(body.idToken);
  const claimed = str(body.userId);
  if (!provider || !claimed) throw new HttpError(400, 'Missing account details.');
  if (provider === 'apple' && !idToken) throw new HttpError(400, 'Missing Apple sign-in.');
  if (provider === 'google' && !idToken && !accessToken) throw new HttpError(400, 'Missing Google sign-in.');

  const identity = provider === 'apple' ? await verifyApple(idToken!) : await verifyGoogle(accessToken, idToken);
  if (identity.userId !== claimed) {
    throw new HttpError(403, 'That is a different account from the one signed in here.');
  }
  return identity;
}
