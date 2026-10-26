// Shared HTTP helpers for the Netlify functions: JSON responses, CORS and env checks.
// Kept outside netlify/functions so Netlify does not deploy it as a function.

const CORS_HEADERS = {
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  vary: 'origin',
};

export function httpError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export function json(status, body, origin = '*') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': origin,
      ...CORS_HEADERS,
    },
  });
}

// Allows the request's own origin, the site URL, localhost dev servers and the
// comma-separated origins in `originsEnvName`. Returns '' when the origin is denied.
export function allowedOrigin(request, originsEnvName) {
  const origin = request.headers.get('origin') || '';
  const requestOrigin = new URL(request.url).origin;
  const configured = [process.env.URL, ...(process.env[originsEnvName] || '').split(',')]
    .map((value) => value?.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (!origin || origin === requestOrigin || configured.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin || '*';
  return '';
}

// Handles the origin check, CORS preflight and POST-only rule every function shares.
// Returns `{ origin }` to continue, or `{ origin, response }` to return immediately.
export function guardPost(request, originsEnvName) {
  const origin = allowedOrigin(request, originsEnvName);
  if (!origin) return { origin, response: json(403, { ok: false, error: '허용되지 않은 출처입니다.', code: 'ORIGIN_DENIED' }, 'null') };
  if (request.method === 'OPTIONS') return { origin, response: new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin, ...CORS_HEADERS } }) };
  if (request.method !== 'POST') return { origin, response: json(405, { ok: false, error: 'POST 요청만 지원합니다.', code: 'METHOD_NOT_ALLOWED' }, origin) };
  return { origin };
}

export function requiredEnv(name, code = 'CONFIG_MISSING') {
  const value = process.env[name]?.trim();
  if (!value) throw httpError(503, code, `${name} 환경 변수가 필요합니다.`);
  return value;
}
