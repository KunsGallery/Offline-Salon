export async function confirmJoinCheckin({ salonId, token, qrPayload }) {
  const response = await fetch('/.netlify/functions/confirm-join-checkin', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ salonId, ...(token ? { token } : { qrPayload }) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    const error = new Error(result.error || 'Join 체크인 확인에 실패했습니다.');
    error.code = result.code || `JOIN_CHECKIN_${response.status}`;
    error.status = response.status;
    error.data = result;
    throw error;
  }
  return result;
}
