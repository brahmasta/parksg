/**
 * Admin authorization for the /admin control panel.
 *
 * The browser sends the signed-in user's Google **access token** as a Bearer
 * header. We re-verify it server-side by calling Google's userinfo endpoint
 * (the token can't be forged) and check the resulting verified email against
 * the ADMIN_EMAILS allowlist. No long-lived shared secret to manage.
 *
 * Privileged DB work then uses the service-role key (see _admin/db.ts), so the
 * service-role key never reaches the browser.
 */

export type AdminResult =
  | { ok: true; email: string }
  | { ok: false; status: number; message: string };

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export async function verifyAdmin(req: Request): Promise<AdminResult> {
  const header = req.headers.get('authorization') || '';
  const token = /^bearer /i.test(header) ? header.slice(7).trim() : '';
  if (!token) return { ok: false, status: 401, message: 'Sign in required.' };

  let info: { email?: string; email_verified?: boolean | string };
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { ok: false, status: 401, message: 'Session expired — sign in again.' };
    info = (await r.json()) as typeof info;
  } catch {
    return { ok: false, status: 502, message: 'Could not verify sign-in.' };
  }

  const email = (info.email || '').toLowerCase();
  const verified = info.email_verified === true || info.email_verified === 'true';
  if (!email || !verified) return { ok: false, status: 401, message: 'Email not verified.' };
  if (ADMIN_EMAILS.length === 0)
    return { ok: false, status: 500, message: 'ADMIN_EMAILS env var is not configured.' };
  if (!ADMIN_EMAILS.includes(email))
    return { ok: false, status: 403, message: 'This account is not an admin.' };
  return { ok: true, email };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
