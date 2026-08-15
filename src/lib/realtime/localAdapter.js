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
  const sessionIds = sessionId ? [sessionId] : Object.keys(state.sessions || {});
  sessionIds.forEach((id) => {
    notifyKinds.session(id);
    notifyKinds.questions(id);
    notifyKinds.responses(id);
    notifyKinds.participants(id);
    if (questionId && id === sessionId) {
      notifyKinds.responsesByQuestion(id, questionId);
    } else {
      const session = state.sessions[id];
      (session?.questions || []).forEach((question) => notifyKinds.responsesByQuestion(id, question.id));
    }
  });
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

function updateOwnResponseState(sessionId, responseId, participantId, patch = {}) {
  const session = ensureSession(sessionId);
  const response = session.responses.find((item) => item.id === responseId);
  if (!response) return null;
  if (response.participantId !== participantId) {
    throw new Error('Cannot edit another participant response.');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'value')) {
    response.value = patch.value;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'nickname')) {
    response.nickname = patch.nickname;
  }
  response.updatedAt = nowIso();
  session.updatedAt = nowIso();
  normalizeSessionState(session);
  return cloneResponse(response);
}

function toggleResponseLikeState(sessionId, responseId, participantId) {
  const session = ensureSession(sessionId);
  const response = session.responses.find((item) => item.id === responseId);
  if (!response) return null;
  const question = session.questions.find((item) => item.id === response.questionId);
  if (question?.likesEnabled !== true && question?.type !== 'artwork-title') {
    throw new Error('이 활동은 좋아요 투표를 사용하지 않습니다.');
  }
  const likedBy = { ...(response.likedBy || {}) };
  if (response.participantId === participantId) {
    return cloneResponse(response);
  }
  if (likedBy[participantId]) {
    delete likedBy[participantId];
  } else {
    likedBy[participantId] = true;
  }
  response.likedBy = likedBy;
  response.likes = Object.keys(likedBy).length;
  response.updatedAt = nowIso();
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

  getArtworkSecrets(sessionId) {
    return { ...(readSession(sessionId)?.artworkSecrets || {}) };
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

  subscribeArtworkSecrets(sessionId, callback) {
    const unsubscribe = this.subscribeSession(sessionId, (session) => callback({ ...(session?.artworkSecrets || {}) }));
    return unsubscribe;
  },

  createArtwork(sessionId, artwork, secret = {}) {
    const session = ensureSession(sessionId);
    const id = artwork.id || createId('artwork');
    session.artworks = [...(session.artworks || []), { ...artwork, id, title: undefined, artist: undefined, description: undefined }];
    session.artworkSecrets = { ...(session.artworkSecrets || {}), [id]: { id, title: secret.title || '', artist: secret.artist || '', description: secret.description || '' } };
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
    return id;
  },

  updateArtwork(sessionId, artworkId, publicPatch = {}, secretPatch = {}) {
    const session = ensureSession(sessionId);
    session.artworks = (session.artworks || []).map((item) => item.id === artworkId ? { ...item, ...publicPatch, title: undefined, artist: undefined, description: undefined } : item);
    if (Object.keys(secretPatch).length) session.artworkSecrets = { ...(session.artworkSecrets || {}), [artworkId]: { ...(session.artworkSecrets?.[artworkId] || {}), ...secretPatch, id: artworkId } };
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
  },

  deleteArtwork(sessionId, artworkId) {
    const session = ensureSession(sessionId);
    session.artworks = (session.artworks || []).filter((item) => item.id !== artworkId);
    const secrets = { ...(session.artworkSecrets || {}) };
    delete secrets[artworkId];
    session.artworkSecrets = secrets;
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
  },

  reorderArtworks(sessionId, orderedIds) {
    const session = ensureSession(sessionId);
    session.artworks = orderedIds.map((id, order) => ({ ...session.artworks.find((item) => item.id === id), order })).filter((item) => item.id);
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
  },

  createDeck(sessionId, deck) {
    const session = ensureSession(sessionId);
    const id = deck.id || createId('deck');
    session.decks = [...(session.decks || []), { ...deck, id }];
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
    return id;
  },

  updateDeck(sessionId, deckId, patch) {
    const session = ensureSession(sessionId);
    session.decks = (session.decks || []).map((item) => item.id === deckId ? { ...item, ...patch } : item);
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
  },

  deleteDeck(sessionId, deckId) {
    const session = ensureSession(sessionId);
    session.decks = (session.decks || []).filter((item) => item.id !== deckId);
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
  },

  reorderDecks(sessionId, orderedIds) {
    const session = ensureSession(sessionId);
    session.decks = orderedIds.map((id, order) => ({ ...session.decks.find((item) => item.id === id), order })).filter((item) => item.id);
    session.updatedAt = nowIso();
    normalizeSessionState(session);
    broadcast(sessionId);
  },

  migrateLegacyAssets(sessionId) {
    const session = ensureSession(sessionId);
    let changed = false;
    session.artworks = (session.artworks || []).map((item) => {
      if (item.title !== undefined || item.artist !== undefined || item.description !== undefined) {
        session.artworkSecrets = { ...(session.artworkSecrets || {}), [item.id]: { id: item.id, title: item.title || '', artist: item.artist || '', description: item.description || '' } };
        changed = true;
      }
      const { title, artist, description, ...publicItem } = item;
      return publicItem;
    });
    if (changed) { session.updatedAt = nowIso(); normalizeSessionState(session); broadcast(sessionId); }
  },

  getSessionAssetLibrary(sessionId) {
    const session = readSession(sessionId);
    if (!session) throw new Error('가져올 세션을 찾을 수 없습니다.');
    return {
      artworks: (session.artworks || []).map((item) => ({ ...item, ...(session.artworkSecrets?.[item.id] || {}) })),
      decks: (session.decks || []).map((item) => ({ ...item })),
    };
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
      artworkId: input.artworkId || null,
      runId: input.runId || null,
      internal: input.internal === true,
      likesEnabled: input.likesEnabled === true,
      includeInGallery: input.includeInGallery === true,
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
    session.stage = { mode: 'questions', page: 1 };
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
      nickname: input.nickname || '',
      value: input.value,
      hidden: false,
      likes: 0,
      likedBy: {},
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    if (session.allowMultipleSubmissions) {
      session.responses.unshift(response);
    } else if (duplicateIndex >= 0) {
      const existing = session.responses[duplicateIndex];
      session.responses[duplicateIndex] = {
        ...existing,
        ...response,
        id: existing.id,
        hidden: existing.hidden,
        likes: existing.likes || 0,
        likedBy: { ...(existing.likedBy || {}) },
        nickname: input.nickname || existing.nickname || '',
        createdAt: existing.createdAt,
        updatedAt: nowIso(),
      };
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

  updateOwnResponse(sessionId, responseId, participantId, patch = {}) {
    const response = updateOwnResponseState(sessionId, responseId, participantId, patch);
    broadcast(sessionId);
    return response;
  },

  toggleResponseLike(sessionId, responseId, participantId) {
    const response = toggleResponseLikeState(sessionId, responseId, participantId);
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

  deleteArtworkTitleResponse(sessionId, responseId, artworkId, options = {}) {
    const session = ensureSession(sessionId);
    if (options.clearAdoption) {
      session.artworks = (session.artworks || []).map((item) => item.id === artworkId ? {
        ...item,
        adoptedTitle: null,
        adoptedResponseId: null,
        adoptedQuestionId: null,
        adoptedLikes: 0,
        adoptedAt: null,
      } : item);
    }
    session.responses = session.responses.filter((response) => response.id !== responseId);
    if (options.sessionPatch) Object.assign(session, options.sessionPatch);
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

  joinParticipant(sessionId, participantId, nickname, avatar = null) {
    return this.upsertParticipant(sessionId, participantId, { nickname, avatar });
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
