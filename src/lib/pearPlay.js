import { getCurrentUser } from './auth';

async function requestPearApi(payload) {
  const user = getCurrentUser();
  const token = await user?.getIdToken?.();
  if (!token) throw new Error('사진 분석을 시작하려면 세션에 먼저 참여해 주세요.');
  const response = await fetch('/.netlify/functions/pear-play', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    const error = new Error(result.error || '사진과 작품을 연결하지 못했습니다.');
    error.code = result.code;
    throw error;
  }
  return result;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function requestPearPairing({ sessionId, participantId, photoUrl, onProgress }) {
  const reportProgress = async (phase) => {
    await onProgress?.({ phase });
  };
  const started = await requestPearApi({ action: 'start', sessionId, participantId, photoUrl });
  if (started.status === 'completed' && started.pairing) return started.pairing;
  if (!started.responseId) throw new Error('AI 분석 작업을 시작하지 못했습니다.');
  await reportProgress(started.investigationStep || 'observing');

  // The OpenAI job can outlive a single Netlify function invocation, so each poll is a short request.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await wait(1500);
    const result = await requestPearApi({ action: 'poll', responseId: started.responseId, photoUrl });
    if (result.status === 'completed' && result.pairing) return result.pairing;
    await reportProgress(result.investigationStep || 'observing');
  }

  const error = new Error('사진 분석이 예상보다 오래 걸리고 있습니다. 잠시 후 다시 시도해 주세요.');
  error.code = 'AI_TIMEOUT';
  throw error;
}
