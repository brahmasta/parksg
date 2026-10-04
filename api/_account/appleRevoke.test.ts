import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, exportPKCS8, jwtVerify, decodeProtectedHeader } from 'jose';
import { appleKeyConfig, appleClientSecret, revokeAppleGrant, type AppleKeyConfig } from './appleRevoke';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function testConfig() {
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  const cfg: AppleKeyConfig = { teamId: 'TEAM123', keyId: 'KEY456', privateKey: await exportPKCS8(privateKey) };
  return { cfg, publicKey };
}

test('config needs all three env vars and unescapes \\n in the key', () => {
  assert.equal(appleKeyConfig({ APPLE_TEAM_ID: 't', APPLE_KEY_ID: 'k' }), null);
  assert.deepEqual(appleKeyConfig({ APPLE_TEAM_ID: 't', APPLE_KEY_ID: 'k', APPLE_PRIVATE_KEY: 'a\\nb' }), {
    teamId: 't',
    keyId: 'k',
    privateKey: 'a\nb',
  });
});

test('client secret is an ES256 JWT Apple will accept', async () => {
  const { cfg, publicKey } = await testConfig();
  const jwt = await appleClientSecret(cfg);
  assert.deepEqual(decodeProtectedHeader(jwt), { alg: 'ES256', kid: 'KEY456' });
  const { payload } = await jwtVerify(jwt, publicKey, { issuer: 'TEAM123', audience: 'https://appleid.apple.com' });
  assert.equal(payload.sub, 'sg.wheretopark.app');
  assert.ok(payload.exp! - payload.iat! <= 15777000);
});

test('exchanges the code, then revokes the refresh token', async () => {
  const { cfg } = await testConfig();
  const calls: { url: string; body: URLSearchParams }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, body: new URLSearchParams(init.body as string) });
    return url.endsWith('/auth/token')
      ? new Response(JSON.stringify({ refresh_token: 'rt', access_token: 'at' }))
      : new Response('', { status: 200 });
  }) as typeof fetch;
  assert.equal(await revokeAppleGrant('code1', cfg), 'revoked');
  assert.equal(calls[0].body.get('code'), 'code1');
  assert.equal(calls[1].url, 'https://appleid.apple.com/auth/revoke');
  assert.equal(calls[1].body.get('token'), 'rt');
  assert.equal(calls[1].body.get('token_type_hint'), 'refresh_token');
});

test('skips without a key or code, and reports Apple errors', async () => {
  const { cfg } = await testConfig();
  assert.equal(await revokeAppleGrant('code', null), 'not-configured');
  assert.equal(await revokeAppleGrant(null, cfg), 'no-code');
  globalThis.fetch = (async () => new Response('{"error":"invalid_grant"}', { status: 400 })) as typeof fetch;
  assert.equal(await revokeAppleGrant('stale', cfg), 'failed');
});
