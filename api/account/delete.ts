/**
 * POST /api/account/delete: delete a person's account and the data linked to
 * it (db/migrations/018_privacy_and_account_deletion.sql, delete_user_data).
 * Body: { provider, accessToken?, idToken?, userId }. The token is verified
 * in _account/verify.ts before anything is deleted.
 */
import { verifyDeleteRequest, HttpError, type DeleteRequest } from '../_account/verify';
import { SB_URL, sbHeaders, hasServiceConfig } from '../_admin/db';
import { json } from '../_admin/auth';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  // CORS preflight from the native apps; the headers come from vercel.json.
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!hasServiceConfig()) return json({ error: 'Server not configured.' }, 500);

  let body: DeleteRequest;
  try {
    body = (await req.json()) as DeleteRequest;
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }

  try {
    const who = await verifyDeleteRequest(body);
    const r = await fetch(`${SB_URL}/rest/v1/rpc/delete_user_data`, {
      method: 'POST',
      headers: sbHeaders(),
      body: JSON.stringify({ p_user_id: who.userId, p_email: who.email }),
    });
    if (!r.ok) return json({ error: 'Could not delete the account. Please try again later.' }, 502);
    return json({ ok: true, deleted: await r.json() });
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    return json({ error: 'Could not confirm your sign-in. Please try again.' }, 502);
  }
}
