/**
 * Revokes a person's Sign in with Apple grant when they delete their account
 * (App Store guideline 5.1.1(v)). The app sends the authorization code from
 * the confirm-your-account sheet; it is exchanged for a refresh token, which
 * is then revoked. Both calls are signed with a client secret: an ES256 JWT
 * made from our Apple .p8 key.
 *
 * Env (server only, from developer.apple.com → Keys, with Sign in with Apple):
 *   APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY (the .p8 contents; `\n`
 *   escapes are accepted so it fits in one env var line).
 */
import { SignJWT, importPKCS8 } from 'jose';

const CLIENT_ID = 'sg.wheretopark.app';
const APPLE = 'https://appleid.apple.com';

export type AppleKeyConfig = { teamId: string; keyId: string; privateKey: string };

export function appleKeyConfig(env: Record<string, string | undefined> = process.env): AppleKeyConfig | null {
  const teamId = env.APPLE_TEAM_ID?.trim();
  const keyId = env.APPLE_KEY_ID?.trim();
  const privateKey = env.APPLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  return teamId && keyId && privateKey ? { teamId, keyId, privateKey } : null;
}

/** The client_secret Apple's token and revoke endpoints expect. */
export async function appleClientSecret(cfg: AppleKeyConfig, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const key = await importPKCS8(cfg.privateKey, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setSubject(CLIENT_ID)
    .setAudience(APPLE)
    .setIssuedAt(now)
    .setExpirationTime(now + 5 * 60)
    .sign(key);
}

function form(fields: Record<string, string>): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString(),
  };
}

export type RevokeResult = 'revoked' | 'not-configured' | 'no-code' | 'failed';

/** Best effort: the account data is already gone by the time this runs, so a
 *  failure here is reported, not thrown. */
export async function revokeAppleGrant(authorizationCode: string | null, cfg = appleKeyConfig()): Promise<RevokeResult> {
  if (!cfg) return 'not-configured';
  if (!authorizationCode) return 'no-code';
  try {
    const secret = await appleClientSecret(cfg);
    const auth = { client_id: CLIENT_ID, client_secret: secret };
    const tr = await fetch(
      `${APPLE}/auth/token`,
      form({ ...auth, code: authorizationCode, grant_type: 'authorization_code' }),
    );
    const tokens = (await tr.json().catch(() => ({}))) as { refresh_token?: string; access_token?: string };
    const token = tokens.refresh_token ?? tokens.access_token;
    if (!tr.ok || !token) return 'failed';
    const rr = await fetch(
      `${APPLE}/auth/revoke`,
      form({ ...auth, token, token_type_hint: tokens.refresh_token ? 'refresh_token' : 'access_token' }),
    );
    return rr.ok ? 'revoked' : 'failed';
  } catch {
    return 'failed';
  }
}
