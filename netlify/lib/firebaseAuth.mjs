// Verifies Firebase ID tokens sent as `Authorization: Bearer <token>` and checks the
// admin allowlist. Keep ADMIN_EMAILS in sync with the allowlist in the Firestore rules.
import { decodeProtectedHeader, importX509, jwtVerify } from 'jose';
import { httpError } from './http.mjs';

const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificateCache = { expiresAt: 0, values: {} };

async function firebaseCertificates() {
  if (certificateCache.expiresAt > Date.now() && Object.keys(certificateCache.values).length) return certificateCache.values;
  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) throw httpError(503, 'AUTH_CERTS_UNAVAILABLE', 'Firebase 공개 인증서를 불러오지 못했습니다.');
  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 3600);
  certificateCache = { expiresAt: Date.now() + maxAge * 1000, values: await response.json() };
  return certificateCache.values;
}

function firebaseProjectId() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || process.env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw httpError(503, 'CONFIG_MISSING', 'FIREBASE_PROJECT_ID 환경 변수가 필요합니다.');
  return projectId;
}

export async function requireFirebaseUser(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw httpError(401, 'AUTH_REQUIRED', 'Firebase 로그인이 필요합니다.');
  const token = authorization.slice(7);
  const projectId = firebaseProjectId();
  let header;
  try {
    header = decodeProtectedHeader(token);
  } catch {
    throw httpError(401, 'INVALID_AUTH_TOKEN', '올바르지 않은 Firebase 로그인 토큰입니다.');
  }
  if (header.alg !== 'RS256' || !header.kid) throw httpError(401, 'INVALID_AUTH_TOKEN', '올바르지 않은 Firebase 로그인 토큰입니다.');
  const certificate = (await firebaseCertificates())[header.kid];
  if (!certificate) throw httpError(401, 'UNKNOWN_AUTH_KEY', '만료되었거나 알 수 없는 Firebase 로그인 키입니다.');
  const key = await importX509(certificate, 'RS256');
  let decoded;
  try {
    ({ payload: decoded } = await jwtVerify(token, key, { algorithms: ['RS256'], audience: projectId, issuer: `https://securetoken.google.com/${projectId}` }));
  } catch {
    throw httpError(401, 'INVALID_AUTH_TOKEN', 'Firebase 로그인 토큰을 확인할 수 없습니다.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (!decoded.sub || decoded.iat > now || decoded.auth_time > now) throw httpError(401, 'INVALID_AUTH_TIME', 'Firebase 로그인 토큰 시간이 올바르지 않습니다.');
  return decoded;
}

// Same test as `isAdminByEmail` in the Firestore rules, plus an `admin` custom claim.
export function isAdminToken(decoded) {
  const allowedEmails = (process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (typeof decoded?.email === 'string' && decoded.email_verified === true && allowedEmails.includes(decoded.email.toLowerCase())) return true;
  return decoded?.admin === true || decoded?.role === 'admin';
}

export async function requireAdmin(request, deniedMessage = '관리자 계정만 사용할 수 있습니다.') {
  const decoded = await requireFirebaseUser(request);
  if (!isAdminToken(decoded)) throw httpError(403, 'ADMIN_REQUIRED', deniedMessage);
  return decoded;
}
