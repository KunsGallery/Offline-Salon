import crypto from 'crypto';
import { requireAdmin } from '../lib/firebaseAuth.mjs';
import { guardPost, json } from '../lib/http.mjs';

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
  const { origin, response: early } = guardPost(request, 'JOIN_PASS_ALLOWED_ORIGINS');
  if (early) return early;

  try {
    await requireAdmin(request, '체크인 조회 권한이 없습니다.');
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
