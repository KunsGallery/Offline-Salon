import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { createId } from '../ids';
import { requireAdminUser } from '../auth';
import { db } from '../firebase';
import {
  cloneParticipant,
  cloneQuestion,
  cloneResponse,
  cloneSession,
  normalizeParticipant,
  normalizeQuestion,
  normalizeResponse,
  normalizeSession,
  sanitizeSession,
  sortByCreatedAsc,
  sortByLastSeenDesc,
  sortByOrderAsc,
  sortByUpdatedDesc,
} from './schema';

const sessionCache = new Map();
const questionCache = new Map();
const responseCache = new Map();
const participantCache = new Map();

function ensureDb() {
  if (!db) {
    throw new Error('Firestore is unavailable. Check VITE_FIREBASE_* env vars and VITE_REALTIME_MODE=firestore.');
  }
  return db;
}

function requireAdminWrite() {
  requireAdminUser();
}

function toIso(value) {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  return new Date(value).toISOString();
}

function fromSessionDoc(id, data) {
  if (!data) return null;
  return sanitizeSession(
    normalizeSession({
      id,
      title: data.title,
      description: data.description,
      status: data.status,
      currentQuestionId: data.currentQuestionId ?? null,
      showResults: data.showResults,
      allowNickname: data.allowNickname,
      allowMultipleSubmissions: data.allowMultipleSubmissions,
      createdAt: toIso(data.createdAt),
      updatedAt: toIso(data.updatedAt),
      branding: data.branding || {},
      questions: [],
      responses: [],
      participants: {},
    }),
  );
}

function fromQuestionDoc(id, data) {
  return normalizeQuestion({
    id,
    title: data.title,
    description: data.description,
    type: data.type,
    options: data.options || [],
    order: data.order,
    isActive: data.isActive,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  });
}

function fromResponseDoc(id, data) {
  return normalizeResponse({
    id,
    questionId: data.questionId,
    participantId: data.participantId,
    nickname: data.nickname,
    value: data.value,
    hidden: data.hidden,
    likes: data.likes,
    likedBy: data.likedBy || {},
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt || data.createdAt),
  });
}

function fromParticipantDoc(participantId, data) {
  return normalizeParticipant(participantId, {
    participantId,
    nickname: data.nickname,
    joinedAt: toIso(data.joinedAt),
    lastSeenAt: toIso(data.lastSeenAt),
  });
}

function writeSessionCache(session) {
  if (!session) return null;
  const normalized = sanitizeSession(cloneSession(session));
  sessionCache.set(normalized.id, normalized);
  return normalized;
}

function composeSession(sessionId, baseSession = sessionCache.get(sessionId)) {
  if (!baseSession) return undefined;
  const participantSource = participantCache.get(sessionId) || Object.values(baseSession.participants || {});
  return sanitizeSession(
    cloneSession({
      ...baseSession,
      questions: questionCache.get(sessionId) || baseSession.questions || [],
      responses: responseCache.get(sessionId) || baseSession.responses || [],
      participants: Object.fromEntries(
        participantSource.map((participant) => [participant.participantId, participant]),
      ),
    }),
  );
}

function writeQuestionsCache(sessionId, questions) {
  const list = (questions || []).map((question) => cloneQuestion(question)).sort(sortByOrderAsc);
  questionCache.set(sessionId, list);
  return list;
}

function writeResponsesCache(sessionId, responses) {
  const list = (responses || []).map((response) => cloneResponse(response)).sort(sortByCreatedAsc).reverse();
  responseCache.set(sessionId, list);
  return list;
}

function writeParticipantsCache(sessionId, participants) {
  const list = (participants || []).map((participant) => cloneParticipant(participant)).sort(sortByLastSeenDesc);
  participantCache.set(sessionId, list);
  return list;
}

function sessionsRef() {
  return collection(ensureDb(), 'sessions');
}

function sessionDocRef(sessionId) {
  return doc(ensureDb(), 'sessions', sessionId);
}

function questionsCol(sessionId) {
  return collection(ensureDb(), 'sessions', sessionId, 'questions');
}

function responsesCol(sessionId) {
  return collection(ensureDb(), 'sessions', sessionId, 'responses');
}

function participantsCol(sessionId) {
  return collection(ensureDb(), 'sessions', sessionId, 'participants');
}

async function readSessionDoc(sessionId) {
  const snap = await getDoc(sessionDocRef(sessionId));
  return snap.exists() ? fromSessionDoc(snap.id, snap.data()) : null;
}

async function readQuestions(sessionId) {
  const snap = await getDocs(query(questionsCol(sessionId), orderBy('order', 'asc')));
  return snap.docs.map((item) => fromQuestionDoc(item.id, item.data())).filter(Boolean);
}

async function readResponses(sessionId, questionId = '') {
  const snap = await getDocs(responsesCol(sessionId));
  return snap.docs
    .map((item) => fromResponseDoc(item.id, item.data()))
    .filter(Boolean)
    .filter((response) => (questionId ? response.questionId === questionId : true))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function readParticipants(sessionId) {
  const snap = await getDocs(query(participantsCol(sessionId), orderBy('lastSeenAt', 'desc')));
  return snap.docs.map((item) => fromParticipantDoc(item.id, item.data())).filter(Boolean);
}

const firestoreAdapter = {
  getSession(sessionId) {
    return composeSession(sessionId);
  },

  getQuestions(sessionId) {
    return questionCache.get(sessionId) || [];
  },

  getResponses(sessionId) {
    return responseCache.get(sessionId) || [];
  },

  async getAllResponses(sessionId) {
    return readResponses(sessionId);
  },

  getResponsesByQuestion(sessionId, questionId) {
    return (responseCache.get(sessionId) || []).filter((response) => response.questionId === questionId);
  },

  getParticipants(sessionId) {
    return participantCache.get(sessionId) || [];
  },

  findSessionQuestion(sessionId, questionId) {
    return this.getQuestions(sessionId).find((question) => question.id === questionId) || null;
  },

  listSessions() {
    return [...sessionCache.values()].map((session) => composeSession(session.id, session)).filter(Boolean).sort(sortByUpdatedDesc);
  },

  async createSession(input = {}) {
    requireAdminWrite();
    const sessionId = input.id || createId('session');
    await setDoc(sessionDocRef(sessionId), {
      title: input.title || '새 세션',
      description: input.description || '실시간 인터랙티브 세션',
      status: input.status || 'draft',
      currentQuestionId: null,
      showResults: false,
      allowNickname: true,
      allowMultipleSubmissions: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      branding: {
        primaryColor: input.primaryColor || '#004AAD',
        logoUrl: null,
        backgroundMode: 'dark',
      },
    });
    const session = await readSessionDoc(sessionId);
    writeSessionCache(session);
    return session;
  },

  async updateSession(sessionId, patch) {
    requireAdminWrite();
    await updateDoc(sessionDocRef(sessionId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteSession(sessionId) {
    requireAdminWrite();
    const batch = writeBatch(ensureDb());
    const qSnap = await getDocs(questionsCol(sessionId));
    qSnap.docs.forEach((item) => batch.delete(item.ref));
    const rSnap = await getDocs(responsesCol(sessionId));
    rSnap.docs.forEach((item) => batch.delete(item.ref));
    const pSnap = await getDocs(participantsCol(sessionId));
    pSnap.docs.forEach((item) => batch.delete(item.ref));
    batch.delete(sessionDocRef(sessionId));
    await batch.commit();
    sessionCache.delete(sessionId);
    questionCache.delete(sessionId);
    responseCache.delete(sessionId);
    participantCache.delete(sessionId);
  },

  subscribeSessions(callback, onError) {
    return onSnapshot(
      sessionsRef(),
      (snap) => {
        const sessions = snap.docs.map((item) =>
          writeSessionCache(
            normalizeSession({
              id: item.id,
              ...item.data(),
              questions: [],
              responses: [],
              participants: {},
            }),
          ),
        );
        callback(sessions.filter(Boolean).map((session) => composeSession(session.id, session)).filter(Boolean).sort(sortByUpdatedDesc));
      },
      (error) => {
        console.error('[firestoreAdapter] subscribeSessions failed:', error);
        onError?.(error);
      },
    );
  },

  subscribeSession(sessionId, callback, onError) {
    let unsubscribe = () => {};
    try {
      unsubscribe = onSnapshot(
        sessionDocRef(sessionId),
        (snap) => {
          const session = snap.exists() ? writeSessionCache(fromSessionDoc(snap.id, snap.data())) : null;
          callback(session);
        },
        (error) => {
          console.error('[firestoreAdapter] subscribeSession failed:', error);
          onError?.(error);
        },
      );
    } catch (error) {
      console.error('[firestoreAdapter] subscribeSession setup failed:', error);
      onError?.(error);
    }
    return unsubscribe;
  },

  async createQuestion(sessionId, input = {}) {
    requireAdminWrite();
    const snap = await getDocs(questionsCol(sessionId));
    const nextOrder = snap.docs.length ? Math.max(...snap.docs.map((item) => item.data().order ?? 0)) + 1 : 0;
    const questionId = createId('question');
    await setDoc(doc(questionsCol(sessionId), questionId), {
      title: input.title || '새 질문',
      description: input.description || '',
      type: input.type || 'text',
      options: input.options || [],
      order: nextOrder,
      isActive: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const questions = await readQuestions(sessionId);
    writeQuestionsCache(sessionId, questions);
    return questions.find((question) => question.id === questionId) || null;
  },

  async updateQuestion(sessionId, questionId, patch) {
    requireAdminWrite();
    await updateDoc(doc(questionsCol(sessionId), questionId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  },

  async deleteQuestion(sessionId, questionId) {
    requireAdminWrite();
    const batch = writeBatch(ensureDb());
    const session = await readSessionDoc(sessionId);
    const responseSnap = await getDocs(responsesCol(sessionId));
    responseSnap.docs
      .filter((item) => item.data().questionId === questionId)
      .forEach((item) => batch.delete(item.ref));
    batch.delete(doc(questionsCol(sessionId), questionId));
    if (session?.currentQuestionId === questionId) {
      batch.update(sessionDocRef(sessionId), {
        currentQuestionId: null,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  },

  async reorderQuestions(sessionId, orderedQuestionIds) {
    requireAdminWrite();
    const batch = writeBatch(ensureDb());
    orderedQuestionIds.forEach((questionId, order) => {
      batch.update(doc(questionsCol(sessionId), questionId), {
        order,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  },

  async activateQuestion(sessionId, questionId) {
    requireAdminWrite();
    const batch = writeBatch(ensureDb());
    const snap = await getDocs(questionsCol(sessionId));
    snap.docs.forEach((item) => {
      batch.update(item.ref, {
        isActive: item.id === questionId,
        updatedAt: serverTimestamp(),
      });
    });
    batch.update(sessionDocRef(sessionId), {
      currentQuestionId: questionId,
      status: 'live',
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  },

  subscribeQuestions(sessionId, callback, onError) {
    return onSnapshot(
      query(questionsCol(sessionId), orderBy('order', 'asc')),
      (snap) => {
        const questions = snap.docs.map((item) => fromQuestionDoc(item.id, item.data())).filter(Boolean);
        questionCache.set(sessionId, questions);
        const base = sessionCache.get(sessionId);
        if (base) {
          sessionCache.set(sessionId, composeSession(sessionId, base));
        }
        callback(questions);
      },
      (error) => {
        console.error('[firestoreAdapter] subscribeQuestions failed:', error);
        onError?.(error);
      },
    );
  },

  async createResponse(sessionId, input = {}) {
    const ref = responsesCol(sessionId);
    const session = await readSessionDoc(sessionId);
    const existing = (await readResponses(sessionId, input.questionId)).filter(
      (response) => response.participantId === input.participantId,
    );
    const payload = {
      questionId: input.questionId,
      participantId: input.participantId,
      nickname: input.nickname || null,
      value: input.value,
      hidden: existing[0]?.hidden ?? false,
      likes: existing[0]?.likes ?? 0,
      likedBy: existing[0]?.likedBy || {},
      createdAt: existing[0]?.createdAt ? existing[0].createdAt : serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (existing[0] && !(session?.allowMultipleSubmissions ?? false)) {
      await setDoc(doc(responsesCol(sessionId), existing[0].id), payload, { merge: true });
      return normalizeResponse({
        ...existing[0],
        ...payload,
        id: existing[0].id,
        createdAt: existing[0].createdAt,
        updatedAt: new Date().toISOString(),
      });
    }

    const created = await addDoc(ref, payload);
    return normalizeResponse({
      ...payload,
      id: created.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },

  async updateResponse(sessionId, responseId, patch) {
    requireAdminWrite();
    await updateDoc(doc(responsesCol(sessionId), responseId), {
      ...patch,
      updatedAt: serverTimestamp(),
    });
  },

  async updateOwnResponse(sessionId, responseId, participantId, patch = {}) {
    const responseRef = doc(responsesCol(sessionId), responseId);
    await runTransaction(ensureDb(), async (transaction) => {
      const snap = await transaction.get(responseRef);
      if (!snap.exists()) {
        throw new Error(`Response not found: ${responseId}`);
      }
      const data = snap.data();
      if (data.participantId !== participantId) {
        throw new Error('Cannot edit another participant response.');
      }
      const nextPatch = {};
      if (Object.prototype.hasOwnProperty.call(patch, 'value')) nextPatch.value = patch.value;
      if (Object.prototype.hasOwnProperty.call(patch, 'nickname')) nextPatch.nickname = patch.nickname;
      transaction.update(responseRef, {
        ...nextPatch,
        updatedAt: serverTimestamp(),
      });
    });
  },

  async toggleResponseLike(sessionId, responseId, participantId) {
    const responseRef = doc(responsesCol(sessionId), responseId);
    return runTransaction(ensureDb(), async (transaction) => {
      const snap = await transaction.get(responseRef);
      if (!snap.exists()) {
        throw new Error(`Response not found: ${responseId}`);
      }
      const data = snap.data();
      if (data.participantId === participantId) {
        return normalizeResponse({
          id: snap.id,
          ...data,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt || data.createdAt),
        });
      }
      const likedBy = { ...(data.likedBy || {}) };
      if (likedBy[participantId]) {
        delete likedBy[participantId];
      } else {
        likedBy[participantId] = true;
      }
      const likes = Object.keys(likedBy).length;
      transaction.update(responseRef, {
        likedBy,
        likes,
        updatedAt: serverTimestamp(),
      });
      return normalizeResponse({
        id: snap.id,
        ...data,
        likedBy,
        likes,
        createdAt: toIso(data.createdAt),
        updatedAt: new Date().toISOString(),
      });
    });
  },

  async deleteResponse(sessionId, responseId) {
    requireAdminWrite();
    await deleteDoc(doc(responsesCol(sessionId), responseId));
  },

  subscribeResponses(sessionId, callback, onError) {
    return onSnapshot(
      responsesCol(sessionId),
      (snap) => {
        const responses = snap.docs
          .map((item) => fromResponseDoc(item.id, item.data()))
          .filter(Boolean)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        responseCache.set(sessionId, responses);
        const base = sessionCache.get(sessionId);
        if (base) {
          sessionCache.set(sessionId, composeSession(sessionId, base));
        }
        callback(responses);
      },
      (error) => {
        console.error('[firestoreAdapter] subscribeResponses failed:', error);
        onError?.(error);
      },
    );
  },

  subscribeResponsesByQuestion(sessionId, questionId, callback, onError) {
    return onSnapshot(
      responsesCol(sessionId),
      (snap) => {
        const responses = snap.docs
          .map((item) => fromResponseDoc(item.id, item.data()))
          .filter(Boolean)
          .filter((response) => response.questionId === questionId)
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const all = responseCache.get(sessionId) || [];
        responseCache.set(
          sessionId,
          [...all.filter((item) => item.questionId !== questionId), ...responses].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        );
        const base = sessionCache.get(sessionId);
        if (base) {
          sessionCache.set(sessionId, composeSession(sessionId, base));
        }
        callback(responses);
      },
      (error) => {
        console.error('[firestoreAdapter] subscribeResponsesByQuestion failed:', error);
        onError?.(error);
      },
    );
  },

  async upsertParticipant(sessionId, participantId, data = {}) {
    await setDoc(
      doc(participantsCol(sessionId), participantId),
      {
        nickname: data.nickname ?? null,
        joinedAt: data.joinedAt || serverTimestamp(),
        lastSeenAt: data.lastSeenAt || serverTimestamp(),
      },
      { merge: true },
    );
    return normalizeParticipant(participantId, {
      ...data,
      participantId,
      joinedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    });
  },

  subscribeParticipants(sessionId, callback, onError) {
    return onSnapshot(
      query(participantsCol(sessionId), orderBy('lastSeenAt', 'desc')),
      (snap) => {
        const participants = snap.docs.map((item) => fromParticipantDoc(item.id, item.data())).filter(Boolean);
        participantCache.set(sessionId, participants);
        const base = sessionCache.get(sessionId);
        if (base) {
          sessionCache.set(sessionId, composeSession(sessionId, base));
        }
        callback(participants);
      },
      (error) => {
        console.error('[firestoreAdapter] subscribeParticipants failed:', error);
        onError?.(error);
      },
    );
  },

  async resetSessionResponses(sessionId) {
    requireAdminWrite();
    const batch = writeBatch(ensureDb());
    const snap = await getDocs(responsesCol(sessionId));
    snap.docs.forEach((item) => batch.delete(item.ref));
    await batch.commit();
  },

  async endSession(sessionId) {
    requireAdminWrite();
    await updateDoc(sessionDocRef(sessionId), {
      status: 'ended',
      updatedAt: serverTimestamp(),
    });
  },

  async resetSession(sessionId) {
    requireAdminWrite();
    const batch = writeBatch(ensureDb());
    const responseSnap = await getDocs(responsesCol(sessionId));
    responseSnap.docs.forEach((item) => batch.delete(item.ref));
    const participantSnap = await getDocs(participantsCol(sessionId));
    participantSnap.docs.forEach((item) => batch.delete(item.ref));
    batch.update(sessionDocRef(sessionId), {
      showResults: false,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  },

  async setShowResults(sessionId, showResults) {
    requireAdminWrite();
    await updateDoc(sessionDocRef(sessionId), {
      showResults,
      updatedAt: serverTimestamp(),
    });
  },

  async setSessionStatus(sessionId, status) {
    requireAdminWrite();
    await updateDoc(sessionDocRef(sessionId), {
      status,
      updatedAt: serverTimestamp(),
    });
  },

  async joinParticipant(sessionId, participantId, nickname) {
    return this.upsertParticipant(sessionId, participantId, { nickname });
  },

  async touchParticipant(sessionId, participantId) {
    return this.upsertParticipant(sessionId, participantId, {});
  },

  async submitResponse(sessionId, input) {
    return this.createResponse(sessionId, input);
  },

  async setResponseHidden(sessionId, responseId, hidden) {
    return this.updateResponse(sessionId, responseId, { hidden });
  },

  async moveQuestion(sessionId, questionId, direction) {
    const questions = await readQuestions(sessionId);
    const index = questions.findIndex((question) => question.id === questionId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= questions.length) return;
    const next = [...questions];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    await this.reorderQuestions(sessionId, next.map((question) => question.id));
  },

  async addQuestion(sessionId, input) {
    return this.createQuestion(sessionId, input);
  },

  async findSessionQuestion(sessionId, questionId) {
    return this.getQuestions(sessionId).find((question) => question.id === questionId) || null;
  },
};

export { firestoreAdapter };
