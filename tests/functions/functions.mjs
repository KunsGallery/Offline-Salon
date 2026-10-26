// Tests for the shared Netlify function helpers and the admin gate on pear-play.
// Run with `npm run test:functions`. Tokens are signed with a throwaway key whose
// certificate is served in place of Google's, so verification runs for real.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { SignJWT, importPKCS8 } from 'jose';
import { guardPost } from '../../netlify/lib/http.mjs';
import { requireAdmin, requireFirebaseUser } from '../../netlify/lib/firebaseAuth.mjs';
import pearPlay from '../../netlify/functions/pear-play.mjs';

const PROJECT = 'demo-offline-salon';
const ADMIN_EMAIL = 'admin@example.com';
const KID = 'test-key';
const SITE = 'https://salon.example.com';

let privateKey;
const realFetch = globalThis.fetch;

before(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'salon-functions-'));
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=test',
      '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem')], { stdio: 'ignore' });
    privateKey = await importPKCS8(readFileSync(join(dir, 'key.pem'), 'utf8'), 'RS256');
    const certificate = readFileSync(join(dir, 'cert.pem'), 'utf8');
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('securetoken@system.gserviceaccount.com')) {
        return new Response(JSON.stringify({ [KID]: certificate }), { headers: { 'cache-control': 'max-age=3600' } });
      }
      return realFetch(url, init);
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  Object.assign(process.env, {
    URL: SITE,
    FIREBASE_PROJECT_ID: PROJECT,
    ADMIN_EMAILS: ` ${ADMIN_EMAIL.toUpperCase()} , other@example.com`,
    OPENAI_API_KEY: 'test-key-not-used',
    R2_PUBLIC_BASE_URL: 'https://media.example.com/salon',
  });
});

after(() => {
  globalThis.fetch = realFetch;
});

function token(claims = {}, options = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ auth_time: now, ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: options.kid || KID })
    .setIssuer(`https://securetoken.google.com/${options.project || PROJECT}`)
    .setAudience(options.project || PROJECT)
    .setSubject(options.sub || 'user-1')
    .setIssuedAt(now)
    .setExpirationTime(options.expired ? now - 60 : now + 3600)
    .sign(privateKey);
}

function post(headers = {}, body = {}, method = 'POST') {
  return new Request(`${SITE}/.netlify/functions/test`, {
    method,
    headers: { origin: SITE, 'content-type': 'application/json', ...headers },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}

const bearer = async (claims, options) => ({ authorization: `Bearer ${await token(claims, options)}` });
const adminClaims = { email: ADMIN_EMAIL, email_verified: true };

describe('guardPost', () => {
  test('rejects unknown origins and non-POST methods, answers preflight', () => {
    assert.equal(guardPost(post({ origin: 'https://evil.example.com' }), 'TEST_ORIGINS').response.status, 403);
    assert.equal(guardPost(post({}, {}, 'GET'), 'TEST_ORIGINS').response.status, 405);
    const preflight = guardPost(post({}, {}, 'OPTIONS'), 'TEST_ORIGINS').response;
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), SITE);
  });

  test('allows the site, configured origins and local dev servers', () => {
    process.env.TEST_ORIGINS = 'https://extra.example.com/';
    for (const origin of [SITE, 'https://extra.example.com', 'http://localhost:5173']) {
      const result = guardPost(post({ origin }), 'TEST_ORIGINS');
      assert.equal(result.response, undefined, origin);
      assert.equal(result.origin, origin);
    }
  });
});

describe('Firebase token checks', () => {
  test('missing or malformed tokens are 401', async () => {
    await assert.rejects(requireFirebaseUser(post()), { status: 401, code: 'AUTH_REQUIRED' });
    await assert.rejects(requireFirebaseUser(post({ authorization: 'Bearer not-a-jwt' })), { status: 401 });
  });

  test('tokens for another project, unknown keys or past expiry are 401', async () => {
    await assert.rejects(requireFirebaseUser(post(await bearer({}, { project: 'other-project' }))), { status: 401 });
    await assert.rejects(requireFirebaseUser(post(await bearer({}, { kid: 'unknown' }))), { status: 401, code: 'UNKNOWN_AUTH_KEY' });
    await assert.rejects(requireFirebaseUser(post(await bearer({}, { expired: true }))), { status: 401 });
  });

  test('allowlisted verified emails and admin claims are admins', async () => {
    assert.equal((await requireAdmin(post(await bearer(adminClaims)))).email, ADMIN_EMAIL);
    assert.equal((await requireAdmin(post(await bearer({ admin: true })))).admin, true);
  });

  test('anonymous, unverified and non-allowlisted users are not admins', async () => {
    const denied = { status: 403, code: 'ADMIN_REQUIRED' };
    await assert.rejects(requireAdmin(post(await bearer({ firebase: { sign_in_provider: 'anonymous' } }))), denied);
    await assert.rejects(requireAdmin(post(await bearer({ email: ADMIN_EMAIL, email_verified: false }))), denied);
    await assert.rejects(requireAdmin(post(await bearer({ email: ADMIN_EMAIL }))), denied);
    await assert.rejects(requireAdmin(post(await bearer({ email: 'someone@example.com', email_verified: true }))), denied);
  });
});

describe('pear-play', () => {
  test('anonymous participants cannot start an investigation', async () => {
    const response = await pearPlay(post(await bearer({ firebase: { sign_in_provider: 'anonymous' } }), { action: 'start', photoUrl: 'https://media.example.com/salon/sessions/s1/pear/a.jpg' }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, 'ADMIN_REQUIRED');
  });

  test('admins may only send photos from this project\'s R2 sessions path', async () => {
    for (const photoUrl of [
      'https://evil.example.com/salon/sessions/s1/a.jpg',
      'https://media.example.com.evil.com/salon/sessions/s1/a.jpg',
      'http://media.example.com/salon/sessions/s1/a.jpg',
      'https://media.example.com/other/sessions/s1/a.jpg',
      'not a url',
    ]) {
      const response = await pearPlay(post(await bearer(adminClaims), { action: 'start', photoUrl }));
      assert.equal(response.status, 400, photoUrl);
      assert.equal((await response.json()).code, 'INVALID_PHOTO_URL', photoUrl);
    }
  });
});
