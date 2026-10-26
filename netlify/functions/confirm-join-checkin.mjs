import { guardPost, json, requiredEnv } from '../lib/http.mjs';

function joinBaseUrl() {
  return (process.env.JOIN_BASE_URL || 'https://join.unframe.kr').replace(/\/$/, '');
}

export default async function handler(request) {
  const { origin, response: early } = guardPost(request, 'JOIN_CHECKIN_ALLOWED_ORIGINS');
  if (early) return early;

  try {
    const input = await request.json().catch(() => ({}));
    const salonId = String(input.salonId || '').trim();
    const token = String(input.token || '').trim();
    const qrPayload = String(input.qrPayload || '').trim();
    if (!salonId || (!token && !qrPayload)) return json(400, { ok: false, error: 'salonId와 token 또는 qrPayload가 필요합니다.', code: 'INVALID_INPUT' }, origin);

    const startedAt = performance.now();
    const response = await fetch(`${joinBaseUrl()}/.netlify/functions/confirm-salon-check-in`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-salon-checkin-secret': requiredEnv('JOIN_CHECKIN_SHARED_SECRET'),
      },
      body: JSON.stringify({ salonId, ...(token ? { token } : { qrPayload }) }),
    });
    const data = await response.json().catch(() => ({}));
    const durationMs = Math.round(performance.now() - startedAt);
    console.info('[checkin-timing]', { phase: 'join-upstream', durationMs, status: response.status });
    const result = json(response.status, data, origin);
    result.headers.set('server-timing', [response.headers.get('server-timing'), `joinUpstreamMs;dur=${durationMs}`].filter(Boolean).join(', '));
    return result;
  } catch (error) {
    return json(error.status || 502, { ok: false, error: error.message || 'Join 체크인 요청에 실패했습니다.', code: error.code || 'JOIN_CHECKIN_PROXY_FAILED' }, origin);
  }
}
