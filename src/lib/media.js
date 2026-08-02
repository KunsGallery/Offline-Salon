import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { mode } from './realtime';
import { storage } from './firebase';

const objectUrls = new Set();

function localUrl(file) {
  const url = URL.createObjectURL(file);
  objectUrls.add(url);
  return url;
}

export async function uploadMedia(sessionId, category, id, file, filename, metadata = {}) {
  if (mode !== 'firestore') return { url: localUrl(file), path: null };
  if (!storage) throw new Error('Firebase Storage 설정을 확인해 주세요.');
  const path = `sessions/${sessionId}/${category}/${id}/${filename}`;
  const target = ref(storage, path);
  await uploadBytes(target, file, { contentType: metadata.contentType || file.type, cacheControl: metadata.cacheControl || 'public,max-age=86400' });
  return { url: await getDownloadURL(target), path };
}

export async function removeMedia(path) {
  if (!path || !storage) return;
  await deleteObject(ref(storage, path)).catch(() => undefined);
}
