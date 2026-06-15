import { createId } from '../ids';
import {
  cloneParticipant,
  cloneQuestion,
  cloneResponse,
  cloneSession,
  createDemoState,
  createSessionTemplate,
  normalizeParticipant,
  normalizeQuestion,
  normalizeResponse,
  sanitizeSession,
  sortByCreatedAsc,
  sortByLastSeenDesc,
  sortByOrderAsc,
  sortByUpdatedDesc,
  nowIso,
} from './schema';

const STORAGE_KEY = 'offline-salon:interactive-studio-pro:v1';
const CHANNEL_NAME = 'offline-salon:interactive-studio-pro';
const isBrowser = typeof window !== 'undefined';

const listeners = {
  sessions: new Set(),
  session: new Map(),
  questions: new Map(),
  responses: new Map(),
  responsesByQuestion: new Map(),
  participants: new Map(),
};

const notifyKinds = {
  sessions() {
    const value = localAdapter.listSessions();
    listeners.sessions.forEach((callback) => callback(value));
  },
  session(sessionId) {
    const value = localAdapter.getSession(sessionId);
    listeners.session.get(sessionId)?.forEach((callback) => callback(value));
  },
  questions(sessionId) {
    const value = localAdapter.getQuestions(sessionId);
    listeners.questions.get(sessionId)?.forEach((callback) => callback(value));
  },
  responses(sessionId) {
    const value = localAdapter.getResponses(sessionId);
    listeners.responses.get(sessionId)?.forEach((callback) => callback(value));
  },
  responsesByQuestion(sessionId, questionId) {
    const value = localAdapter.getResponsesByQuestion(sessionId, questionId);
    listeners.responsesByQuestion.get(`${sessionId}:${questionId}`)?.forEach((callback) => callback(value));
  },
  participants(sessionId) {
    const value = localAdapter.getParticipants(sessionId);
    listeners.participants.get(sessionId)?.forEach((callback) => callback(value));
  },
};

function bucket(map, key) {
  if (!map.has(key)) {
    map.set(key, new Set());
  }
  return map.get(key);
}

function emit(sessionId, questionId) {
  notifyKinds.sessions();
  if (sessionId) {
    notifyKinds.session(sessionId);
    notifyKinds.questions(sessionId);
    notifyKinds.responses(sessionId);
    notifyKinds.participants(sessionId);
    if (questionId) {
      notifyKinds.responsesByQuestion(sessionId, questionId);
    } else {
      const session = state.sessions[sessionId];
      (session?.questions || []).forEach((question) => notifyKinds.responsesByQuestion(sessionId, question.id));
    }
  }
}

function persist() {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
  if (channel) {
    channel.postMessage({ type: 'sync' });
  }
}

function broadcast(sessionId, questionId) {
  persist();
  emit(sessionId, questionId);
}

function loadState() {
  if (!isBrowser) {
    return createDemoState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = createDemoState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.sessions) {
      const seed = createDemoState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return parsed;
  } catch {
    const seed = createDemoState();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    } catch {
      // ignore storage failures and continue with in-memory seed
    }
    return seed;
  }
}

let state = loadState();
let channel = null;

if (isBrowser) {
  if ('BroadcastChannel' in window) {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type === 'sync') {
        state = loadState();
        emit();
      }
    };
  }

  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      state = loadState();
      emit();
    }
  });
}

function ensureSession(sessionId) {
  const session = state.sessions[sessionId];
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }
  return session;
}

function readSession(sessionId) {
  const session = state.sessions[sessionId];
  return session ? sanitizeSession(cloneSession(session)) : null;
}

function readQuestions(sessionId) {
  const session = readSession(sessionId);
  return (session?.questions || []).slice().sort(sortByOrderAsc);
}

function readResponses(sessionId, questionId = '') {
  const session = readSession(sessionId);
  const responses = (session?.responses || []).slice();
  const filtered = questionId ? responses.filter((response) => response.questionId === questionId) : responses;
  return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function readResponsesByQuestion(sessionId, questionId) {
  return readResponses(sessionId, questionId);
}

function readParticipants(sessionId) {
  const session = readSession(sessionId);
  return Object.values(session?.participants || {}).sort(sortByLastSeenDesc);
}

function normalizeSessionState(session) {
  const next = sanitizeSession(cloneSession(session));
  state.sessions[next.id] = next;
  return next;
}

function updateSessionState(sessionId, patch) {
  const session = ensureSession(sessionId);
  Object.assign(session, patch, { updatedAt: nowIso() });
  normalizeSessionState(session);
  return readSession(sessionId);
}

function updateQuestionState(sessionId, questionId, patch) {
  const session = ensureSession(sessionId);
  const question = session.questions.find((item) => item.id === questionId);
  if (!question) return null;
  Object.assign(question, patch, { updatedAt: nowIso() });
  session.updatedAt = nowIso();
  normalizeSessionState(session);
  return cloneQuestion(question);
}

function updateResponseState(sessionId, responseId, patch) {
  const session = ensureSession(sessionId);
  const response = session.responses.find((item) => item.id === responseId);
  if (!response) return null;
  Object.assign(response, patch);
  session.updatedAt = nowIso();
  normalizeSessionState(session);
  return cloneResponse(response);
}

const localAdapter = {
  getSession(sessionId) {
    return readSession(sessionId);
  },

  getQuestions(sessionId) {
    return readQuestions(sessionId);
  },

  getResponses(sessionId) {
    return readResponses(sessionId);
  },

  getAllResponses(sessionId) {
    return readResponses(sessionId);
  },

  getResponsesByQuestion(sessionId, questionId) {
    return readResponsesByQuestion(sessionId, questionId);
  },

  getParticipants(sessionId) {
    return readParticipants(sessionId);
  },

  findSessionQuestion(sessionId, questionId) {
    return readQuestions(sessionId).find((question) => question.id === questionId) || null;
  },

  listSessions() {
    return Object.values(state.sessions)
      .map((session) => sanitizeSession(cloneSession(session)))
      .sort(sortByUpdatedDesc);
  },

  createSession(input = {}) {
    const session = createSessionTemplate(input);
    state.sessions[session.id] = session;
    broadcast(session.id);
    return session;
  },

  updateSession(sessionId, patch) {
    const session = updateSessionState(sessionId, patch);
    broadcast(sessionId);
    return session;
  },

  deleteSession(sessionId) {
    delete state.sessions[sessionId];
    broadcast();
  },

  subscribeSessions(callback) {
    listeners.sessions.add(callback);
    callback(this.listSessions());
    return () => listeners.sessions.delete(callback);
  },

  subscribeSession(sessionId, callback) {
    const set = bucket(listeners.session, sessionId);
    set.add(callback);
    callback(this.getSession(sessionId));
    return () => set.delete(callback);
  },

  createQuestion(sessionId, input) {
    const session = ensureSession(sessionId);
    const order = session.questions.length ? Math.max(...session.questions.map((question) => question.order ?? 0)) + 1 : 0;
    const question = normalizeQuestion({
      id: createId('question'),
      title: input.title || '새 질문',
      description: input.description || '',
      type: input.type || 'text',
      options: input.options || [],
      order,
      isActive: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    session.questions.push(question);
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
    return cloneQuestion(question);
  },

  updateQuestion(sessionId, questionId, patch) {
    const question = updateQuestionState(sessionId, questionId, patch);
    broadcast(sessionId, questionId);
    return question;
  },

  deleteQuestion(sessionId, questionId) {
    const session = ensureSession(sessionId);
    session.questions = session.questions.filter((question) => question.id !== questionId);
    session.responses = session.responses.filter((response) => response.questionId !== questionId);
    if (session.currentQuestionId === questionId) {
      session.currentQuestionId = null;
    }
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
  },

  reorderQuestions(sessionId, orderedQuestionIds) {
    const session = ensureSession(sessionId);
    const nextOrder = [];
    orderedQuestionIds.forEach((questionId) => {
      const question = session.questions.find((item) => item.id === questionId);
      if (question) nextOrder.push(question);
    });
    session.questions.forEach((question) => {
      if (!orderedQuestionIds.includes(question.id)) {
        nextOrder.push(question);
      }
    });
    session.questions = nextOrder.map((question, order) => ({ ...question, order }));
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
  },

  activateQuestion(sessionId, questionId) {
    const session = ensureSession(sessionId);
    session.currentQuestionId = questionId;
    session.questions = session.questions.map((question) => ({
      ...question,
      isActive: question.id === questionId,
    }));
    session.status = 'live';
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId, questionId);
  },

  subscribeQuestions(sessionId, callback) {
    const set = bucket(listeners.questions, sessionId);
    set.add(callback);
    callback(this.getQuestions(sessionId));
    return () => set.delete(callback);
  },

  createResponse(sessionId, input) {
    const session = ensureSession(sessionId);
    const question = session.questions.find((item) => item.id === input.questionId);
    if (!question) return null;

    const duplicateIndex = session.responses.findIndex(
      (response) => response.questionId === input.questionId && response.participantId === input.participantId,
    );

    const response = normalizeResponse({
      id: session.allowMultipleSubmissions ? createId('response') : `${input.questionId}:${input.participantId}`,
      questionId: input.questionId,
      participantId: input.participantId,
      nickname: input.nickname || null,
      value: input.value,
      hidden: false,
      createdAt: nowIso(),
    });

    if (session.allowMultipleSubmissions) {
      session.responses.unshift(response);
    } else if (duplicateIndex >= 0) {
      session.responses[duplicateIndex] = { ...session.responses[duplicateIndex], ...response, id: session.responses[duplicateIndex].id };
    } else {
      session.responses.unshift(response);
    }

    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId, input.questionId);
    return cloneResponse(response);
  },

  updateResponse(sessionId, responseId, patch) {
    const response = updateResponseState(sessionId, responseId, patch);
    broadcast(sessionId);
    return response;
  },

  deleteResponse(sessionId, responseId) {
    const session = ensureSession(sessionId);
    session.responses = session.responses.filter((response) => response.id !== responseId);
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
  },

  subscribeResponses(sessionId, callback) {
    const set = bucket(listeners.responses, sessionId);
    set.add(callback);
    callback(this.getResponses(sessionId));
    return () => set.delete(callback);
  },

  subscribeResponsesByQuestion(sessionId, questionId, callback) {
    const key = `${sessionId}:${questionId}`;
    const set = bucket(listeners.responsesByQuestion, key);
    set.add(callback);
    callback(this.getResponsesByQuestion(sessionId, questionId));
    return () => set.delete(callback);
  },

  upsertParticipant(sessionId, participantId, data = {}) {
    const session = ensureSession(sessionId);
    const participant = normalizeParticipant(participantId, {
      ...(session.participants[participantId] || {}),
      ...data,
      participantId,
      joinedAt: session.participants[participantId]?.joinedAt || nowIso(),
      lastSeenAt: nowIso(),
    });
    session.participants[participantId] = participant;
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
    return cloneParticipant(participant);
  },

  subscribeParticipants(sessionId, callback) {
    const set = bucket(listeners.participants, sessionId);
    set.add(callback);
    callback(this.getParticipants(sessionId));
    return () => set.delete(callback);
  },

  resetSessionResponses(sessionId) {
    const session = ensureSession(sessionId);
    session.responses = [];
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
  },

  endSession(sessionId) {
    const session = updateSessionState(sessionId, { status: 'ended' });
    broadcast(sessionId);
    return session;
  },

  resetSession(sessionId) {
    const session = ensureSession(sessionId);
    session.responses = [];
    session.participants = {};
    session.showResults = false;
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
  },

  setShowResults(sessionId, showResults) {
    const session = updateSessionState(sessionId, { showResults });
    broadcast(sessionId);
    return session;
  },

  setSessionStatus(sessionId, status) {
    const session = updateSessionState(sessionId, { status });
    broadcast(sessionId);
    return session;
  },

  joinParticipant(sessionId, participantId, nickname) {
    return this.upsertParticipant(sessionId, participantId, { nickname });
  },

  touchParticipant(sessionId, participantId) {
    return this.upsertParticipant(sessionId, participantId, {});
  },

  submitResponse(sessionId, input) {
    return this.createResponse(sessionId, input);
  },

  setResponseHidden(sessionId, responseId, hidden) {
    return this.updateResponse(sessionId, responseId, { hidden });
  },

  moveQuestion(sessionId, questionId, direction) {
    const questions = this.getQuestions(sessionId);
    const index = questions.findIndex((question) => question.id === questionId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= questions.length) return;
    const next = [...questions];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    this.reorderQuestions(sessionId, next.map((question) => question.id));
  },

  addQuestion(sessionId, input) {
    return this.createQuestion(sessionId, input);
  },

  findSessionQuestion(sessionId, questionId) {
    return this.getQuestions(sessionId).find((question) => question.id === questionId) || null;
  },
};

export { localAdapter };
