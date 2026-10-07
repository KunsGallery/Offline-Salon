export async function confirmJoinCheckin({ salonId, token, qrPayload }) {
  const startedAt = performance.now();
  const response = await fetch('/.netlify/functions/confirm-join-checkin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ salonId, ...(token ? { token } : { qrPayload }) }),
  });
  const result = await response.json().catch(() => ({}));
  console.info('[checkin-timing]', { phase: 'join-confirmation', durationMs: Math.round(performance.now() - startedAt), status: response.status, serverTiming: response.headers.get('server-timing') || '' });
  if (!response.ok || !result.ok) {
    const error = new Error(result.error || 'Join 체크인 확인에 실패했습니다.');
    error.code = result.code || `JOIN_CHECKIN_${response.status}`;
    error.status = response.status;
    error.data = result;
    throw error;
  }
  return result;
}
