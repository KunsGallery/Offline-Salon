function json(status, body, origin = '*') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      vary: 'origin',
    },
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get('origin') || '';
  const requestOrigin = new URL(request.url).origin;
  const configured = [process.env.URL, ...(process.env.JOIN_CHECKIN_ALLOWED_ORIGINS || '').split(',')]
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

function joinBaseUrl() {
  return (process.env.JOIN_BASE_URL || 'https://join.unframe.kr').replace(/\/$/, '');
}

export default async function handler(request) {
  const origin = allowedOrigin(request);
  if (!origin) return json(403, { ok: false, error: '허용되지 않은 출처입니다.', code: 'ORIGIN_DENIED' }, 'null');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } });
  if (request.method !== 'POST') return json(405, { ok: false, error: 'POST 요청만 지원합니다.', code: 'METHOD_NOT_ALLOWED' }, origin);

  try {
    const input = await request.json().catch(() => ({}));
    const salonId = String(input.salonId || '').trim();
    const token = String(input.token || '').trim();
    const qrPayload = String(input.qrPayload || '').trim();
    if (!salonId || (!token && !qrPayload)) return json(400, { ok: false, error: 'salonId와 token 또는 qrPayload가 필요합니다.', code: 'INVALID_INPUT' }, origin);

    const response = await fetch(`${joinBaseUrl()}/.netlify/functions/confirm-salon-check-in`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-salon-checkin-secret': required('JOIN_CHECKIN_SHARED_SECRET'),
      },
      body: JSON.stringify({ salonId, ...(token ? { token } : { qrPayload }) }),
    });
    const data = await response.json().catch(() => ({}));
    return json(response.status, data, origin);
  } catch (error) {
    return json(error.status || 502, { ok: false, error: error.message || 'Join 체크인 요청에 실패했습니다.', code: error.code || 'JOIN_CHECKIN_PROXY_FAILED' }, origin);
  }
}
