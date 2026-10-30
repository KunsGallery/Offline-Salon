import { ensureParticipantUser, getCurrentUser } from './auth';
import { mode } from './realtime';

const objectUrls = new Set();

function localUrl(file) {
  const url = URL.createObjectURL(file);
  objectUrls.add(url);
  return url;
}

export async function uploadMedia(sessionId, category, id, file, filename, metadata = {}) {
  if (mode !== 'firestore') return { url: localUrl(file), path: null };
  const signed = await requestMediaAction({
    action: 'sign-upload',
    sessionId,
    category,
    assetId: id,
    filename,
    contentType: metadata.contentType || file.type,
    cacheControl: metadata.cacheControl || 'public,max-age=86400',
    size: file.size,
  });
  await uploadToSignedUrl(signed, file, metadata.onProgress);
  return { url: signed.publicUrl, path: signed.key };
}

export async function uploadParticipantPhoto(sessionId, id, file, metadata = {}) {
  if (mode !== 'firestore') return { url: localUrl(file), path: null };
  const user = await ensureParticipantUser();
  const signed = await requestMediaAction({
    action: 'sign-participant-upload',
    sessionId,
    assetId: id,
    activity: metadata.activity || 'grape',
    contentType: file.type,
    size: file.size,
  }, user);
  await uploadToSignedUrl(signed, file, metadata.onProgress);
  return { url: signed.publicUrl, path: signed.key };
}

export async function removeMedia(path) {
  if (!path || mode !== 'firestore') return;
  await requestMediaAction({ action: 'delete', key: path });
}

export async function removeSessionMedia(sessionId) {
  if (!sessionId || mode !== 'firestore') return { ok: true, deleted: 0 };
  return requestMediaAction({ action: 'delete-session', sessionId });
}

export async function getMediaStorageStatus() {
  if (mode !== 'firestore') return { ok: true, provider: 'local-preview', message: '로컬 미리보기 모드' };
  return requestMediaAction({ action: 'health' });
}

async function requestMediaAction(payload, requestedUser = null) {
  const user = requestedUser || getCurrentUser();
  if (!user) throw new Error('관리자 로그인 후 다시 시도해 주세요.');
  const token = await user.getIdToken();
  const response = await fetch('/.netlify/functions/r2-media', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `R2 요청에 실패했습니다. (${response.status})`);
    error.code = result.code;
    throw error;
  }
  return result;
}

async function uploadToSignedUrl(signed, file, onProgress) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await uploadAttempt(signed, file, onProgress);
    } catch (error) {
      if (!error.retryable || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
      onProgress?.(0);
    }
  }
}

function uploadAttempt(signed, file, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', signed.uploadUrl);
    request.timeout = 60000;
    Object.entries(signed.headers || {}).forEach(([key, value]) => request.setRequestHeader(key, value));
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(Object.assign(new Error(`사진 전송을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요. (${request.status})`), { retryable: request.status === 408 || request.status === 429 || request.status >= 500 }));
    };
    request.onerror = () => reject(Object.assign(new Error('연결이 불안정해 사진을 전송하지 못했습니다. Wi-Fi 또는 모바일 데이터를 확인하고 다시 시도해 주세요.'), { retryable: true }));
    request.ontimeout = () => reject(Object.assign(new Error('사진 전송 시간이 초과됐습니다. 연결 상태를 확인하고 다시 시도해 주세요.'), { retryable: true }));
    request.send(file);
  });
}
