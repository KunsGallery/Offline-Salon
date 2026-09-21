import { decodeProtectedHeader, importX509, jwtVerify } from 'jose';

const FIREBASE_CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certificateCache = { expiresAt: 0, values: {} };

function json(status, body, origin = '*') {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
      vary: 'origin',
    },
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get('origin') || '';
  const requestOrigin = new URL(request.url).origin;
  const configured = [process.env.URL, ...(process.env.PEAR_PLAY_ALLOWED_ORIGINS || '').split(',')]
    .map((value) => value?.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (!origin || origin === requestOrigin || configured.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return origin || '*';
  return '';
}

async function firebaseCertificates() {
  if (certificateCache.expiresAt > Date.now() && Object.keys(certificateCache.values).length) return certificateCache.values;
  const response = await fetch(FIREBASE_CERTS_URL);
  if (!response.ok) throw new Error('Firebase 인증서를 불러오지 못했습니다.');
  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 3600);
  certificateCache = { expiresAt: Date.now() + maxAge * 1000, values: await response.json() };
  return certificateCache.values;
}

async function requireFirebaseUser(request) {
  const authorization = request.headers.get('authorization') || '';
  if (!authorization.startsWith('Bearer ')) throw Object.assign(new Error('참여자 인증이 필요합니다.'), { status: 401, code: 'AUTH_REQUIRED' });
  const token = authorization.slice(7);
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim() || process.env.VITE_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw Object.assign(new Error('FIREBASE_PROJECT_ID 환경 변수가 필요합니다.'), { status: 503, code: 'CONFIG_MISSING' });
  const header = decodeProtectedHeader(token);
  const certificate = (await firebaseCertificates())[header.kid];
  if (header.alg !== 'RS256' || !certificate) throw Object.assign(new Error('Firebase 로그인 토큰을 확인할 수 없습니다.'), { status: 401, code: 'INVALID_AUTH_TOKEN' });
  const key = await importX509(certificate, 'RS256');
  const { payload } = await jwtVerify(token, key, { algorithms: ['RS256'], audience: projectId, issuer: `https://securetoken.google.com/${projectId}` });
  return payload;
}

function parseJson(text) {
  const source = String(text || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI 결과를 JSON으로 읽지 못했습니다.');
  return JSON.parse(source.slice(start, end + 1));
}

function responseText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text;
  return (data?.output || [])
    .flatMap((item) => item?.content || [])
    .map((item) => item?.text || '')
    .filter(Boolean)
    .join('\n');
}

function normalizePairing(value, photoUrl) {
  const analysis = value?.analysis || {};
  const candidates = Array.isArray(value?.candidates) ? value.candidates.slice(0, 5).map((candidate, index) => ({
    id: String(candidate?.id || `candidate-${index + 1}`),
    title: String(candidate?.title || ''),
    artist: String(candidate?.artist || ''),
    year: String(candidate?.year || ''),
    dimensions: String(candidate?.dimensions || ''),
    materials: String(candidate?.materials || ''),
    imageUrl: String(candidate?.imageUrl || ''),
    sourceUrl: String(candidate?.sourceUrl || ''),
    sourceName: String(candidate?.sourceName || ''),
    reason: String(candidate?.reason || ''),
    rejected: candidate?.rejected === true,
  })) : [];
  const finalArtwork = value?.finalArtwork || candidates.find((candidate) => !candidate.rejected) || null;
  return {
    status: 'ready',
    photoUrl,
    analysis: {
      objects: Array.isArray(analysis.objects) ? analysis.objects.slice(0, 8).map(String) : [],
      colors: Array.isArray(analysis.colors) ? analysis.colors.slice(0, 8).map(String) : [],
      composition: Array.isArray(analysis.composition) ? analysis.composition.slice(0, 8).map(String) : [],
      mood: String(analysis.mood || ''),
      context: Array.isArray(analysis.context) ? analysis.context.slice(0, 8).map(String) : [],
      concept: Array.isArray(analysis.concept) ? analysis.concept.slice(0, 8).map(String) : [],
    },
    candidates,
    finalArtwork: finalArtwork ? {
      title: String(finalArtwork.title || ''),
      artist: String(finalArtwork.artist || ''),
      year: String(finalArtwork.year || ''),
      dimensions: String(finalArtwork.dimensions || ''),
      materials: String(finalArtwork.materials || ''),
      imageUrl: String(finalArtwork.imageUrl || ''),
      sourceUrl: String(finalArtwork.sourceUrl || ''),
      sourceName: String(finalArtwork.sourceName || ''),
    } : null,
    connection: String(value?.connection || ''),
    statement: String(value?.statement || ''),
    keywords: Array.isArray(value?.keywords) ? value.keywords.slice(0, 5).map(String) : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default async function handler(request) {
  const origin = allowedOrigin(request);
  if (!origin) return json(403, { ok: false, error: '허용되지 않은 출처입니다.', code: 'ORIGIN_DENIED' }, 'null');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'access-control-allow-origin': origin, 'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'POST, OPTIONS', vary: 'origin' } });
  if (request.method !== 'POST') return json(405, { ok: false, error: 'POST 요청만 지원합니다.', code: 'METHOD_NOT_ALLOWED' }, origin);
  try {
    await requireFirebaseUser(request);
    const input = await request.json().catch(() => ({}));
    const photoUrl = String(input.photoUrl || '').trim();
    if (!photoUrl || !/^https:\/\//i.test(photoUrl)) return json(400, { ok: false, error: '업로드된 사진 주소가 필요합니다.', code: 'INVALID_PHOTO_URL' }, origin);
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return json(503, { ok: false, error: 'PEAR PLAY AI가 아직 연결되지 않았습니다. 운영자에게 OPENAI_API_KEY 설정을 요청해 주세요.', code: 'AI_NOT_CONFIGURED' }, origin);

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.PEAR_PLAY_MODEL || 'gpt-5.6',
        tools: [{ type: 'web_search' }],
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: `당신은 토끼 탐정입니다. 아래 사진을 실제 존재하는 미술 작품과 연결하는 PEAR PLAY 사건을 수사하세요. 먼저 이미지의 사물, 색, 구도, 분위기와 맥락을 세심하게 이해하고, 그 단서에서 출발해 작품을 추론하세요. 웹 검색으로 작품의 존재, 작가, 제목, 연도, 크기, 재료/기법, 이미지와 출처를 검증하세요. 존재하지 않는 작품이나 확인되지 않은 이미지 URL을 만들지 마세요. 이미지 URL과 sourceUrl은 검색 결과에서 확인된 공개 URL만 사용하세요. 반드시 아래 JSON 하나만 출력하세요. 한국어로 작성하되 분석 태그는 짧은 영어도 허용합니다.
{
  "analysis": {"objects": [], "colors": [], "composition": [], "mood": "", "context": [], "concept": []},
  "candidates": [{"id":"", "title":"", "artist":"", "year":"", "dimensions":"", "materials":"", "imageUrl":"", "sourceUrl":"", "sourceName":"", "reason":"", "rejected":false}],
  "finalArtwork": {"title":"", "artist":"", "year":"", "dimensions":"", "materials":"", "imageUrl":"", "sourceUrl":"", "sourceName":""},
  "connection":"사진과 작품의 연결 이유를 2~4문장으로 설명",
  "statement":"이 사진에 맞는 한 문장",
  "keywords":["", "", ""]
}
후보는 2~4개, 최종 작품은 반드시 하나를 고르고, 후보 중 약한 연결은 rejected:true로 표시하세요.` },
            { type: 'input_image', image_url: photoUrl, detail: 'high' },
          ],
        }],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json(response.status || 502, { ok: false, error: data.error?.message || 'PEAR PLAY AI 요청에 실패했습니다.', code: 'AI_REQUEST_FAILED' }, origin);
    const pairing = normalizePairing(parseJson(responseText(data)), photoUrl);
    return json(200, { ok: true, pairing }, origin);
  } catch (error) {
    return json(error.status || 500, { ok: false, error: error.message || 'PEAR PLAY 분석에 실패했습니다.', code: error.code || 'PEAR_PLAY_FAILED' }, origin);
  }
}
