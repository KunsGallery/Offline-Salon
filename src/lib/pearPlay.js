import { getCurrentUser } from './auth';

export async function requestPearPairing({ sessionId, participantId, photoUrl }) {
  const user = getCurrentUser();
  const token = await user?.getIdToken?.();
  if (!token) throw new Error('사진 분석을 시작하려면 세션에 먼저 참여해 주세요.');
  const response = await fetch('/.netlify/functions/pear-play', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, participantId, photoUrl }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    const error = new Error(result.error || '사진과 작품을 연결하지 못했습니다.');
    error.code = result.code;
    throw error;
  }
  return result.pairing;
}
