import { createId } from '../ids';

export function nowIso() {
  return new Date().toISOString();
}

export function cloneQuestion(question) {
  return {
    ...question,
    options: [...(question.options || [])],
  };
}

export function cloneResponse(response) {
  return {
    ...response,
    likedBy: { ...(response.likedBy || {}) },
    value: Array.isArray(response.value) ? [...response.value] : response.value,
  };
}

export function cloneParticipant(participant) {
  return { ...participant };
}

export function cloneSession(session) {
  return {
    ...session,
    branding: { ...(session.branding || {}) },
    questions: (session.questions || []).map(cloneQuestion),
    responses: (session.responses || []).map(cloneResponse),
    participants: Object.fromEntries(
      Object.entries(session.participants || {}).map(([participantId, participant]) => [participantId, cloneParticipant(participant)]),
    ),
  };
}

export function sortByUpdatedDesc(a, b) {
  return new Date(b.updatedAt) - new Date(a.updatedAt);
}

export function sortByOrderAsc(a, b) {
  return (a.order ?? 0) - (b.order ?? 0);
}

export function sortByCreatedAsc(a, b) {
  return new Date(a.createdAt) - new Date(b.createdAt);
}

export function sortByLastSeenDesc(a, b) {
  return new Date(b.lastSeenAt) - new Date(a.lastSeenAt);
}

export function countResponseLikes(response) {
  if (!response) return 0;
  if (typeof response.likes === 'number' && response.likes >= 0) return response.likes;
  return Object.keys(response.likedBy || {}).length;
}

export function sanitizeSession(session) {
  if (!session) return null;
  const next = cloneSession(session);
  const questionExists = next.questions.some((question) => question.id === next.currentQuestionId);
  if (!questionExists) {
    next.currentQuestionId = null;
  }
  next.questions = next.questions.map((question) => ({
    ...question,
    isActive: question.id === next.currentQuestionId,
  }));
  return next;
}

export function normalizeQuestion(question) {
  if (!question) return null;
  return cloneQuestion({
    id: question.id,
    title: question.title || '',
    description: question.description || '',
    type: question.type || 'text',
    options: Array.isArray(question.options) ? question.options : [],
    order: question.order ?? 0,
    isActive: Boolean(question.isActive),
    createdAt: question.createdAt || nowIso(),
    updatedAt: question.updatedAt || nowIso(),
  });
}

export function normalizeResponse(response) {
  if (!response) return null;
  const likedBy = Object.fromEntries(
    Object.entries(response.likedBy || {}).filter(([, value]) => Boolean(value)),
  );
  const likes = typeof response.likes === 'number' ? response.likes : Object.keys(likedBy).length;
  return cloneResponse({
    id: response.id,
    questionId: response.questionId || '',
    participantId: response.participantId || '',
    nickname: typeof response.nickname === 'string' ? response.nickname : '',
    value: Array.isArray(response.value) ? [...response.value] : response.value ?? '',
    hidden: response.hidden === true,
    likes,
    likedBy,
    createdAt: response.createdAt || nowIso(),
    updatedAt: response.updatedAt || response.createdAt || nowIso(),
  });
}

export function normalizeParticipant(participantId, participant) {
  return cloneParticipant({
    participantId,
    nickname: participant?.nickname ?? null,
    joinedAt: participant?.joinedAt || nowIso(),
    lastSeenAt: participant?.lastSeenAt || nowIso(),
  });
}

export function normalizeSession(session) {
  if (!session) return null;
  return sanitizeSession({
    id: session.id,
    title: session.title || '새 세션',
    description: session.description || '실시간 인터랙티브 세션',
    status: session.status || 'draft',
    currentQuestionId: session.currentQuestionId || null,
    showResults: Boolean(session.showResults),
    allowNickname: session.allowNickname !== false,
    allowMultipleSubmissions: Boolean(session.allowMultipleSubmissions),
    createdAt: session.createdAt || nowIso(),
    updatedAt: session.updatedAt || nowIso(),
    branding: {
      primaryColor: session.branding?.primaryColor || '#004AAD',
      logoUrl: session.branding?.logoUrl || null,
      backgroundMode: session.branding?.backgroundMode || 'dark',
    },
    questions: (session.questions || []).map(normalizeQuestion).filter(Boolean),
    responses: (session.responses || []).map(normalizeResponse).filter(Boolean),
    participants: Object.fromEntries(
      Object.entries(session.participants || {}).map(([participantId, participant]) => [
        participantId,
        normalizeParticipant(participantId, participant),
      ]),
    ),
  });
}

export function createDemoState() {
  const sessionId = 'session_demo';
  const questionA = 'question_wordcloud';
  const questionB = 'question_poll';
  const questionC = 'question_text';

  return {
    sessions: {
      [sessionId]: normalizeSession({
        id: sessionId,
        title: 'UNFRAME Demo Salon',
        description: '실시간 관객 참여형 데모 세션',
        status: 'live',
        currentQuestionId: questionA,
        showResults: true,
        allowNickname: true,
        allowMultipleSubmissions: false,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        branding: {
          primaryColor: '#004AAD',
          logoUrl: null,
          backgroundMode: 'dark',
        },
        questions: [
          {
            id: questionA,
            title: '오늘 모임을 한 단어로 표현한다면?',
            description: '가장 먼저 떠오르는 단어를 입력해 주세요.',
            type: 'wordcloud',
            options: [],
            order: 0,
            isActive: true,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
          {
            id: questionB,
            title: '가장 기대되는 프로그램은?',
            description: '한 가지를 골라 주세요.',
            type: 'poll',
            options: ['토크', '워크숍', '전시', '네트워킹'],
            order: 1,
            isActive: false,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
          {
            id: questionC,
            title: '오늘의 감상을 자유롭게 적어주세요',
            description: '짧게 또는 길게 남겨도 좋아요.',
            type: 'text',
            options: [],
            order: 2,
            isActive: false,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          },
        ],
        responses: [],
        participants: {},
      }),
    },
  };
}

export function createSessionTemplate(input = {}) {
  const sessionId = input.id || createId('session');
  return normalizeSession({
    id: sessionId,
    title: input.title || '새 세션',
    description: input.description || '실시간 인터랙티브 세션',
    status: input.status || 'draft',
    currentQuestionId: null,
    showResults: false,
    allowNickname: true,
    allowMultipleSubmissions: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    branding: {
      primaryColor: input.primaryColor || '#004AAD',
      logoUrl: null,
      backgroundMode: 'dark',
    },
    questions: [],
    responses: [],
    participants: {},
  });
}
