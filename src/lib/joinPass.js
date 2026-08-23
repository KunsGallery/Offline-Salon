import { getCurrentUser } from './auth';

export async function lookupJoinSalonPass(rawValue) {
  const user = getCurrentUser();
  const token = await user?.getIdToken?.();
  if (!token) throw new Error('관리자 로그인이 필요합니다.');
  const response = await fetch('/.netlify/functions/join-salon-pass', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ raw: rawValue }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.valid) {
    const error = new Error(result.error || 'Join QR 정보를 확인하지 못했습니다.');
    error.code = result.code;
    error.data = result;
    throw error;
  }
  return result;
}
