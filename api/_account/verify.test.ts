import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { verifyDeleteRequest, googleClientIds, HttpError } from './verify';

const WEB = 'web-client.apps.googleusercontent.com';
const realFetch = globalThis.fetch;
const now = () => Math.floor(Date.now() / 1000);

function stubTokenInfo(info: Record<string, unknown>, ok = true) {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(info), { status: ok ? 200 : 400 })) as typeof fetch;
}

const rejects = (p: Promise<unknown>, status: number) =>
  assert.rejects(p, (e: unknown) => e instanceof HttpError && e.status === status);

beforeEach(() => {
  process.env.VITE_GOOGLE_CLIENT_ID = WEB;
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test('client ids come from the web, iOS and extra env vars', () => {
  assert.deepEqual(
    googleClientIds({ VITE_GOOGLE_CLIENT_ID: 'a', VITE_GOOGLE_IOS_CLIENT_ID: 'b', GOOGLE_CLIENT_IDS: ' c, ,d' }),
    ['a', 'b', 'c', 'd'],
  );
});

test('a request without a provider, account or token is refused', async () => {
  await rejects(verifyDeleteRequest({ idToken: 'x', userId: '1' }), 400);
  await rejects(verifyDeleteRequest({ provider: 'google', idToken: 'x' }), 400);
  await rejects(verifyDeleteRequest({ provider: 'google', userId: '1' }), 400);
  await rejects(verifyDeleteRequest({ provider: 'apple', accessToken: 'x', userId: 'apple:1' }), 400);
});

test('a valid Google ID token for our client returns the account', async () => {
  stubTokenInfo({ sub: '123', aud: WEB, email: 'a@b.sg', email_verified: 'true', iat: String(now()) });
  assert.deepEqual(await verifyDeleteRequest({ provider: 'google', idToken: 't', userId: '123' }), {
    userId: '123',
    email: 'a@b.sg',
  });
});

test('an unverified email is not used to match reports', async () => {
  stubTokenInfo({ sub: '123', aud: WEB, email: 'a@b.sg', email_verified: 'false', iat: String(now()) });
  assert.equal((await verifyDeleteRequest({ provider: 'google', idToken: 't', userId: '123' })).email, null);
});

test('a token issued to another app is refused', async () => {
  stubTokenInfo({ sub: '123', aud: 'someone-else', iat: String(now()) });
  await rejects(verifyDeleteRequest({ provider: 'google', idToken: 't', userId: '123' }), 401);
});

test('an old ID token is refused', async () => {
  stubTokenInfo({ sub: '123', aud: WEB, iat: String(now() - 3600) });
  await rejects(verifyDeleteRequest({ provider: 'google', idToken: 't', userId: '123' }), 401);
});

test('a web access token is matched on azp', async () => {
  stubTokenInfo({ sub: '123', azp: WEB, aud: WEB });
  assert.equal((await verifyDeleteRequest({ provider: 'google', accessToken: 't', userId: '123' })).userId, '123');
});

test('an expired or invalid token is refused', async () => {
  stubTokenInfo({ error_description: 'Invalid Value' }, false);
  await rejects(verifyDeleteRequest({ provider: 'google', accessToken: 't', userId: '123' }), 401);
});

test('a token for a different account than the signed-in one is refused', async () => {
  stubTokenInfo({ sub: '999', aud: WEB, iat: String(now()) });
  await rejects(verifyDeleteRequest({ provider: 'google', idToken: 't', userId: '123' }), 403);
});
