import { decodeProtectedHeader, importX509, jwtVerify } from 'jose';
import crypto from 'crypto';

const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificateCache = { expiresAt: 0, values: {} };

function json(status, body, origin = '*') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      vary: 'origin',
    },
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get('origin') || '';
  const requestOrigin = new URL(request.url).origin;
  const configured = [process.env.URL, ...(process.env.JOIN_PASS_ALLOWED_ORIGINS || '').split(',')]
    .map((value) => value?.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (!origin || origin === requestOrigin || configured.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin || '*';
  return '';
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw Object.assign(new Error(`${name} 환경 변수가 필요합니다.`), { status: 503, code: 'CONFIG_MISSING' });
  return value;
}

async function firebaseCertificates() {
  if (certificateCache.expiresAt > Date.now() && Object.keys(certificateCache.values).length) return certificateCache.values;
  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) throw Object.assign(new Error('Firebase 공개 인증서를 불러오지 못했습니다.'), { status: 503, code: 'AUTH_CERTS_UNAVAILABLE' });
  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 3600);
  certificateCache = { expiresAt: Date.now() + maxAge * 1000, values: await response.json() };
  return certificateCache.values;
}

async function requireAdmin(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw Object.assign(new Error('관리자 로그인이 필요합니다.'), { status: 401, code: 'AUTH_REQUIRED' });
  const token = authorization.slice(7);
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || required('VITE_FIREBASE_PROJECT_ID');
  const header = decodeProtectedHeader(token);
  const certificate = (await firebaseCertificates())[header.kid];
  if (header.alg !== 'RS256' || !certificate) throw Object.assign(new Error('Firebase 로그인 토큰을 확인할 수 없습니다.'), { status: 401, code: 'INVALID_AUTH_TOKEN' });
  const key = await importX509(certificate, 'RS256');
  const { payload } = await jwtVerify(token, key, { algorithms: ['RS256'], audience: projectId, issuer: `https://securetoken.google.com/${projectId}` });
  const allowedEmails = (process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (payload.email && allowedEmails.includes(payload.email.toLowerCase())) return payload;
  if (payload.admin === true || payload.role === 'admin') return payload;
  throw Object.assign(new Error('체크인 조회 권한이 없습니다.'), { status: 403, code: 'ADMIN_REQUIRED' });
}

function extractToken(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return url.searchParams.get('token') || url.searchParams.get('checkinToken') || raw;
  } catch {
    return raw;
  }
}

function joinBaseUrl() {
  return (process.env.JOIN_BASE_URL || process.env.VITE_JOIN_BASE_URL || 'https://join.unframe.kr').replace(/\/$/, '');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export default async function handler(request) {
  const origin = allowedOrigin(request);
  if (!origin) return json(403, { error: '허용되지 않은 출처입니다.', code: 'ORIGIN_DENIED' }, 'null');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } });
  if (request.method !== 'POST') return json(405, { error: 'POST 요청만 지원합니다.', code: 'METHOD_NOT_ALLOWED' }, origin);

  try {
    await requireAdmin(request);
    const input = await request.json().catch(() => ({}));
    const token = extractToken(input.token || input.qrPayload || input.raw);
    if (token.length < 32) return json(400, { valid: false, error: 'Join 개인 QR 토큰을 찾지 못했습니다.', code: 'INVALID_JOIN_TOKEN' }, origin);

    const response = await fetch(`${joinBaseUrl()}/.netlify/functions/get-salon-pass?token=${encodeURIComponent(token)}`, {
      headers: { accept: 'application/json' },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.valid) {
      return json(response.status || 502, {
        valid: false,
        error: data.error || 'Join QR 정보를 확인하지 못했습니다.',
        expired: Boolean(data.expired),
        code: data.expired ? 'JOIN_TOKEN_EXPIRED' : 'JOIN_PASS_LOOKUP_FAILED',
      }, origin);
    }

    const tokenHash = hashToken(token);
    return json(200, {
      valid: true,
      source: 'join.unframe.kr',
      tokenHash,
      shortCode: data.shortCode || tokenHash.slice(0, 6).toUpperCase(),
      applicantDisplayName: data.applicantDisplayName || '참가자',
      salonTitle: data.salonTitle || 'UNFRAME SALON',
      eventDateTime: data.eventDateTime || '',
      venueName: data.venueName || '',
      checkedInOnJoin: Boolean(data.checkedIn),
      joinCheckedInAt: data.checkedInAt || null,
      programUrl: data.programUrl || '',
      guestbookUrl: data.guestbookUrl || '',
    }, origin);
  } catch (error) {
    console.error('[join-salon-pass]', error);
    return json(error.status || 500, { valid: false, error: error.message || 'Join QR 조회에 실패했습니다.', code: error.code || 'JOIN_PASS_PROXY_FAILED' }, origin);
  }
}
