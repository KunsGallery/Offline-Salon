import { DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { decodeProtectedHeader, importX509, jwtVerify } from 'jose';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const PDF_TYPE = 'application/pdf';
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_PARTICIPANT_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificateCache = { expiresAt: 0, values: {} };

function json(status, body, origin = '*') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      vary: 'origin',
    },
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get('origin') || '';
  const configured = [process.env.URL, ...(process.env.R2_ALLOWED_ORIGINS || '').split(',')]
    .map((value) => value?.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (!origin || configured.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin || '*';
  return '';
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw Object.assign(new Error(`${name} 환경 변수가 필요합니다.`), { status: 503, code: 'R2_NOT_CONFIGURED' });
  return value;
}

async function firebaseCertificates() {
  if (certificateCache.expiresAt > Date.now() && Object.keys(certificateCache.values).length) return certificateCache.values;
  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) throw Object.assign(new Error('Firebase 공개 인증서를 불러오지 못했습니다.'), { status: 503, code: 'AUTH_CERTS_UNAVAILABLE' });
  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 3600);
  certificateCache = { expiresAt: Date.now() + maxAge * 1000, values: await response.json() };
  return certificateCache.values;
}

async function requireFirebaseUser(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw Object.assign(new Error('Firebase 로그인이 필요합니다.'), { status: 401, code: 'AUTH_REQUIRED' });
  const token = authorization.slice(7);
  const projectId = required('FIREBASE_PROJECT_ID');
  const header = decodeProtectedHeader(token);
  if (header.alg !== 'RS256' || !header.kid) throw Object.assign(new Error('올바르지 않은 Firebase 로그인 토큰입니다.'), { status: 401, code: 'INVALID_AUTH_TOKEN' });
  const certificate = (await firebaseCertificates())[header.kid];
  if (!certificate) throw Object.assign(new Error('만료되었거나 알 수 없는 Firebase 로그인 키입니다.'), { status: 401, code: 'UNKNOWN_AUTH_KEY' });
  const key = await importX509(certificate, 'RS256');
  const { payload: decoded } = await jwtVerify(token, key, { algorithms: ['RS256'], audience: projectId, issuer: `https://securetoken.google.com/${projectId}` });
  const now = Math.floor(Date.now() / 1000);
  if (!decoded.sub || decoded.iat > now || decoded.auth_time > now) throw Object.assign(new Error('Firebase 로그인 토큰 시간이 올바르지 않습니다.'), { status: 401, code: 'INVALID_AUTH_TIME' });
  return decoded;
}

async function requireAdmin(request) {
  const decoded = await requireFirebaseUser(request);
  const allowedEmails = (process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (decoded.email && allowedEmails.includes(decoded.email.toLowerCase())) return decoded;
  if (decoded.admin === true || decoded.role === 'admin') return decoded;
  throw Object.assign(new Error('R2 업로드 권한이 없는 계정입니다.'), { status: 403, code: 'ADMIN_REQUIRED' });
}

function r2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: required('R2_ACCESS_KEY_ID'),
      secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    },
  });
}

function safePart(value, fallback) {
  const normalized = String(value || '').trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return normalized.slice(0, 120) || fallback;
}

function validateUpload({ category, contentType, size }) {
  const bytes = Number(size || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) throw Object.assign(new Error('파일 크기를 확인할 수 없습니다.'), { status: 400, code: 'INVALID_SIZE' });
  if (category === 'poster' || category === 'artworks') {
    if (!IMAGE_TYPES.has(contentType) || bytes >= MAX_IMAGE_BYTES) throw Object.assign(new Error('12MB 미만 JPG, PNG, WEBP 이미지만 업로드할 수 있습니다.'), { status: 400, code: 'INVALID_IMAGE' });
    return;
  }
  if (category === 'decks') {
    const validPdf = contentType === PDF_TYPE && bytes < MAX_PDF_BYTES;
    const validThumbnail = contentType === 'image/jpeg' && bytes < 2 * 1024 * 1024;
    if (!validPdf && !validThumbnail) throw Object.assign(new Error('PDF는 50MB 미만, 표지는 2MB 미만 JPEG만 업로드할 수 있습니다.'), { status: 400, code: 'INVALID_DECK_FILE' });
    return;
  }
  throw Object.assign(new Error('지원하지 않는 미디어 종류입니다.'), { status: 400, code: 'INVALID_CATEGORY' });
}

function publicUrl(key) {
  const base = required('R2_PUBLIC_BASE_URL').replace(/\/$/, '');
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function deleteSessionObjects(sessionId) {
  const client = r2Client();
  const bucket = required('R2_BUCKET_NAME');
  const prefix = `sessions/${sessionId}/`;
  let continuationToken;
  let deleted = 0;

  do {
    const page = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    const objects = (page.Contents || []).map(({ Key }) => ({ Key })).filter(({ Key }) => Boolean(Key));
    if (objects.length) {
      const result = await client.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: objects, Quiet: true },
      }));
      if (result.Errors?.length) {
        throw Object.assign(new Error('세션의 일부 R2 파일을 삭제하지 못했습니다.'), { status: 502, code: 'R2_PARTIAL_DELETE' });
      }
      deleted += objects.length;
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}

export default async function handler(request) {
  const origin = allowedOrigin(request);
  if (!origin) return json(403, { error: '허용되지 않은 출처입니다.', code: 'ORIGIN_DENIED' }, 'null');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } });
  if (request.method !== 'POST') return json(405, { error: 'POST 요청만 지원합니다.', code: 'METHOD_NOT_ALLOWED' }, origin);

  try {
    const input = await request.json();
    if (input.action === 'sign-participant-upload') {
      const user = await requireFirebaseUser(request);
      const bytes = Number(input.size || 0);
      if (input.contentType !== 'image/jpeg' || !Number.isFinite(bytes) || bytes <= 0 || bytes >= MAX_PARTICIPANT_IMAGE_BYTES) {
        throw Object.assign(new Error('8MB 미만 JPEG 사진만 업로드할 수 있습니다.'), { status: 400, code: 'INVALID_PARTICIPANT_IMAGE' });
      }
      const sessionId = safePart(input.sessionId, 'session');
      const participantId = safePart(user.sub, 'participant');
      const assetId = safePart(input.assetId, 'grape');
      const key = `sessions/${sessionId}/grape/${participantId}/${assetId}/photo.jpg`;
      const cacheControl = 'public,max-age=31536000,immutable';
      const command = new PutObjectCommand({ Bucket: required('R2_BUCKET_NAME'), Key: key, ContentType: 'image/jpeg', CacheControl: cacheControl });
      const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 300 });
      return json(200, { uploadUrl, publicUrl: publicUrl(key), key, headers: { 'content-type': 'image/jpeg', 'cache-control': cacheControl } }, origin);
    }
    await requireAdmin(request);
    if (input.action === 'health') {
      ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_BASE_URL'].forEach(required);
      return json(200, { ok: true, provider: 'cloudflare-r2', publicBaseUrl: process.env.R2_PUBLIC_BASE_URL }, origin);
    }
    if (input.action === 'sign-upload') {
      validateUpload(input);
      const sessionId = safePart(input.sessionId, 'session');
      const category = safePart(input.category, 'media');
      const assetId = safePart(input.assetId, 'asset');
      const filename = safePart(input.filename, 'file');
      const key = `sessions/${sessionId}/${category}/${assetId}/${filename}`;
      const cacheControl = input.cacheControl || 'public,max-age=86400';
      const command = new PutObjectCommand({ Bucket: required('R2_BUCKET_NAME'), Key: key, ContentType: input.contentType, CacheControl: cacheControl });
      const uploadUrl = await getSignedUrl(r2Client(), command, { expiresIn: 300 });
      return json(200, { uploadUrl, publicUrl: publicUrl(key), key, headers: { 'content-type': input.contentType, 'cache-control': cacheControl } }, origin);
    }
    if (input.action === 'delete') {
      const key = String(input.key || '');
      if (!/^sessions\/[a-zA-Z0-9._-]+\/(poster|artworks|decks)\//.test(key)) throw Object.assign(new Error('삭제할 파일 경로가 올바르지 않습니다.'), { status: 400, code: 'INVALID_KEY' });
      await r2Client().send(new DeleteObjectCommand({ Bucket: required('R2_BUCKET_NAME'), Key: key }));
      return json(200, { ok: true }, origin);
    }
    if (input.action === 'delete-session') {
      const sessionId = String(input.sessionId || '');
      if (!/^[a-zA-Z0-9._-]+$/.test(sessionId)) throw Object.assign(new Error('삭제할 세션 ID가 올바르지 않습니다.'), { status: 400, code: 'INVALID_SESSION_ID' });
      const deleted = await deleteSessionObjects(sessionId);
      return json(200, { ok: true, deleted }, origin);
    }
    return json(400, { error: '지원하지 않는 작업입니다.', code: 'INVALID_ACTION' }, origin);
  } catch (error) {
    console.error('[r2-media]', error);
    return json(error.status || 500, { error: error.message || 'R2 요청을 처리하지 못했습니다.', code: error.code || 'R2_REQUEST_FAILED' }, origin);
  }
}
