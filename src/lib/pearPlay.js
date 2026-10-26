import { getCurrentUser } from './auth';

async function requestPearApi(payload, { signal } = {}) {
  const user = getCurrentUser();
  const token = await user?.getIdToken?.();
  if (!token) throw new Error('PEAR PLAY 추리는 관리자 로그인 후 시작할 수 있습니다.');
  const response = await fetch('/.netlify/functions/pear-play', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
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

// Quick first look at the photo: a few detective lines with clue positions to narrate
// while the full search runs. Resolves to [] when it is slow or fails, so the host
// falls back to scripted lines.
export async function requestPearObservation({ photoUrl, timeoutMs = 15000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await requestPearApi({ action: 'observe', photoUrl }, { signal: controller.signal });
    return Array.isArray(result.notes) ? result.notes : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function requestPearPairing({ sessionId, participantId, photoUrl, onProgress }) {
  const reportProgress = async (phase, pairing = null, queries = []) => {
    await onProgress?.({ phase, pairing, queries });
  };
  const started = await requestPearApi({ action: 'start', sessionId, participantId, photoUrl });
  await reportProgress('searching');
  if (started.status === 'completed' && started.pairing) {
    await reportProgress('verifying', started.pairing);
    return started.pairing;
  }
  if (!started.responseId) throw new Error('AI 분석 작업을 시작하지 못했습니다.');

  // The OpenAI job can outlive a single Netlify function invocation, so each poll is a short request.
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await wait(1500);
    const result = await requestPearApi({ action: 'poll', responseId: started.responseId, photoUrl });
    if (result.status === 'completed' && result.pairing) {
      await reportProgress('verifying', result.pairing, result.searchQueries || []);
      return result.pairing;
    }
    await reportProgress(result.investigationStep === 'verifying' ? 'verifying' : 'searching', null, result.searchQueries || []);
  }

  const error = new Error('사진 분석이 예상보다 오래 걸리고 있습니다. 잠시 후 다시 시도해 주세요.');
  error.code = 'AI_TIMEOUT';
  throw error;
}
