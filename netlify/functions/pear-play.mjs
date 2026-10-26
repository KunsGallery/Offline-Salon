import { requireAdmin } from '../lib/firebaseAuth.mjs';
import { guardPost, httpError, json } from '../lib/http.mjs';

// Only photos already uploaded to this project's R2 bucket may be sent to the model.
function isAllowedPhotoUrl(value) {
  const base = process.env.R2_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (!base) throw httpError(503, 'CONFIG_MISSING', 'R2_PUBLIC_BASE_URL 환경 변수가 필요합니다.');
  try {
    const photo = new URL(value);
    const allowed = new URL(base);
    const basePath = allowed.pathname.replace(/\/$/, '');
    return photo.protocol === 'https:'
      && photo.origin === allowed.origin
      && photo.pathname.startsWith(`${basePath}/sessions/`);
  } catch {
    return false;
  }
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

function openAiHeaders(apiKey) {
  return { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' };
}

async function openAiJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function failedOpenAiResponse(data) {
  return data?.error?.message || data?.incomplete_details?.reason || 'PEAR PLAY AI 요청에 실패했습니다.';
}

function investigationStep(data) {
  const searches = (data?.output || []).filter((item) => item?.type === 'web_search_call');
  if (!searches.length) return 'observing';
  return searches.some((item) => item.status !== 'completed') ? 'searching' : 'verifying';
}

export default async function handler(request) {
  const { origin, response: early } = guardPost(request, 'PEAR_PLAY_ALLOWED_ORIGINS');
  if (early) return early;
  try {
    // Each call runs image analysis plus web search on the operator's OpenAI key, so only
    // administrators may start or poll investigations.
    await requireAdmin(request, 'PEAR PLAY 추리는 관리자 계정에서만 시작할 수 있습니다.');
    const input = await request.json().catch(() => ({}));
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return json(503, { ok: false, error: 'PEAR PLAY AI가 아직 연결되지 않았습니다. 운영자에게 OPENAI_API_KEY 설정을 요청해 주세요.', code: 'AI_NOT_CONFIGURED' }, origin);

    const action = String(input.action || 'start').trim().toLowerCase();
    if (action === 'poll') {
      const responseId = String(input.responseId || '').trim();
      if (!responseId) return json(400, { ok: false, error: 'AI 분석 작업 ID가 필요합니다.', code: 'INVALID_RESPONSE_ID' }, origin);
      const { response, data } = await openAiJson(`https://api.openai.com/v1/responses/${encodeURIComponent(responseId)}`, {
        headers: { authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) return json(response.status || 502, { ok: false, error: failedOpenAiResponse(data), code: 'AI_REQUEST_FAILED' }, origin);
      if (data.status === 'queued' || data.status === 'in_progress') return json(200, { ok: true, status: 'pending', responseId, investigationStep: investigationStep(data) }, origin);
      if (data.status !== 'completed') return json(502, { ok: false, error: failedOpenAiResponse(data), code: 'AI_REQUEST_FAILED', status: data.status || 'unknown' }, origin);
      const photoUrl = String(input.photoUrl || '').trim();
      const pairing = normalizePairing(parseJson(responseText(data)), photoUrl);
      return json(200, { ok: true, status: 'completed', responseId, pairing }, origin);
    }

    if (action !== 'start') return json(400, { ok: false, error: '지원하지 않는 AI 작업입니다.', code: 'INVALID_ACTION' }, origin);
    const photoUrl = String(input.photoUrl || '').trim();
    if (!photoUrl || !isAllowedPhotoUrl(photoUrl)) return json(400, { ok: false, error: '업로드된 사진 주소가 필요합니다.', code: 'INVALID_PHOTO_URL' }, origin);

    const { response, data } = await openAiJson('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: openAiHeaders(apiKey),
      body: JSON.stringify({
        model: process.env.PEAR_PLAY_MODEL || 'gpt-5.6',
        reasoning: { effort: process.env.PEAR_PLAY_REASONING_EFFORT || 'low' },
        background: true,
        tools: [{ type: 'web_search' }],
        input: [{
          role: 'user',
          content: [
            { type: 'input_text', text: `당신은 토끼 탐정입니다. 사진의 사물, 색, 구도, 분위기를 살펴 실제 미술 작품과 연결하세요. 웹 검색으로 작품의 존재와 작가, 제목, 연도, 크기, 재료, 공개 이미지와 출처를 확인하세요. 확인되지 않은 정보나 URL은 만들지 말고 빈 문자열로 남기세요. 검색은 관련성 높은 후보에 집중하고, 아래 JSON만 간결한 한국어로 출력하세요.
{
  "analysis": {"objects": [], "colors": [], "composition": [], "mood": "", "context": [], "concept": []},
  "candidates": [{"id":"", "title":"", "artist":"", "year":"", "dimensions":"", "materials":"", "imageUrl":"", "sourceUrl":"", "sourceName":"", "reason":"", "rejected":false}],
  "finalArtwork": {"title":"", "artist":"", "year":"", "dimensions":"", "materials":"", "imageUrl":"", "sourceUrl":"", "sourceName":""},
  "connection":"사진과 작품의 연결 이유를 1~2문장으로 설명",
  "statement":"이 사진에 맞는 한 문장",
  "keywords":["", "", ""]
}
후보는 최대 2개. 검증된 최종 작품 하나만 선택하고 약한 연결은 rejected:true로 표시하세요.` },
            { type: 'input_image', image_url: photoUrl, detail: 'high' },
          ],
        }],
      }),
    });
    if (!response.ok) return json(response.status || 502, { ok: false, error: failedOpenAiResponse(data), code: 'AI_REQUEST_FAILED' }, origin);
    if (data.status === 'completed') {
      const pairing = normalizePairing(parseJson(responseText(data)), photoUrl);
      return json(200, { ok: true, status: 'completed', responseId: data.id, pairing }, origin);
    }
    return json(200, { ok: true, status: 'pending', responseId: data.id, investigationStep: investigationStep(data) }, origin);
  } catch (error) {
    return json(error.status || 500, { ok: false, error: error.message || 'PEAR PLAY 분석에 실패했습니다.', code: error.code || 'PEAR_PLAY_FAILED' }, origin);
  }
}
