import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import JoinForm from '../components/client/JoinForm';
import QuestionAnswerForm from '../components/client/QuestionAnswerForm';
import SubmittedScreen from '../components/client/SubmittedScreen';
import WaitingScreen from '../components/client/WaitingScreen';
import RealtimeStatusBanner from '../components/RealtimeStatusBanner';
import { realtime } from '../lib/realtime';
import { useSession } from '../hooks/useSession';
import { useQuestions } from '../hooks/useQuestions';
import { useResponses } from '../hooks/useResponses';
import { createParticipantId } from '../lib/ids';

function storageKey(sessionId, key) {
  return `offline-salon:${key}:${sessionId}`;
}

function readStoredValue(key) {
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function writeStoredValue(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in private mode or restrictive browsers.
  }
}

export default function ParticipantApp() {
  const { sessionId } = useParams();
  const { session, loading: sessionLoading, error: sessionError } = useSession(sessionId);
  const { questions, loading: questionsLoading, error: questionsError } = useQuestions(sessionId);
  const currentQuestion = useMemo(
    () => questions.find((question) => question.id === session?.currentQuestionId) || questions.find((question) => question.isActive) || null,
    [questions, session?.currentQuestionId],
  );

  const [participantId, setParticipantId] = useState(() => readStoredValue(storageKey(sessionId, 'participantId')));
  const [nickname, setNickname] = useState(() => readStoredValue(storageKey(sessionId, 'nickname')));
  const [isJoining, setIsJoining] = useState(false);
  const [editing, setEditing] = useState(false);
  const { responses, loading: responsesLoading, error: responsesError } = useResponses(sessionId, currentQuestion?.id || null);
  const myResponse = useMemo(
    () => responses.find((response) => response.participantId === participantId) || null,
    [participantId, responses],
  );
  const realtimeError = sessionError || questionsError || responsesError;
  const realtimeLoading = sessionLoading || questionsLoading || responsesLoading;

  useEffect(() => {
    if (session && participantId) {
      realtime.touchParticipant(sessionId, participantId);
      const timer = window.setInterval(() => realtime.touchParticipant(sessionId, participantId), 15000);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [participantId, session, sessionId]);

  useEffect(() => {
    if (!session || !sessionId || !participantId || !nickname) return;
    writeStoredValue(storageKey(sessionId, 'participantId'), participantId);
    writeStoredValue(storageKey(sessionId, 'nickname'), nickname);
  }, [participantId, nickname, session, sessionId]);

  if (realtimeError) {
    return (
      <main className="mobile-shell">
        <section className="client-panel stack gap-lg">
          <RealtimeStatusBanner loading={realtimeLoading} error={realtimeError} />
          <div className="stack gap-xs">
            <h1>데이터 연결에 문제가 있습니다.</h1>
            <p className="muted">Firestore 설정 또는 네트워크 상태를 확인해주세요.</p>
          </div>
        </section>
      </main>
    );
  }

  if (realtimeLoading && session === undefined) {
    return (
      <main className="mobile-shell">
        <section className="client-panel stack gap-lg">
          <RealtimeStatusBanner loading={realtimeLoading} />
          <h1>세션을 불러오는 중입니다.</h1>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mobile-shell">
        <div className="client-panel stack gap-lg">
          <RealtimeStatusBanner loading={realtimeLoading} />
          <h1>세션을 찾을 수 없습니다.</h1>
        </div>
      </main>
    );
  }

  const accentStyle = { '--accent': session.branding?.primaryColor || '#004AAD' };

  if (session.status === 'ended') {
    return (
      <main className="mobile-shell" style={accentStyle}>
        <WaitingScreen title="세션이 종료되었습니다" message="참여해 주셔서 감사합니다." />
      </main>
    );
  }

  const handleJoin = async (nextNickname) => {
    setIsJoining(true);
    const nextParticipantId = participantId || createParticipantId(sessionId);
    await Promise.resolve(realtime.joinParticipant(sessionId, nextParticipantId, nextNickname));
    setParticipantId(nextParticipantId);
    setNickname(nextNickname);
    setEditing(false);
    setIsJoining(false);
  };

  const handleSubmit = async (value) => {
    if (!currentQuestion) return;
    await Promise.resolve(realtime.upsertParticipant(sessionId, participantId, { nickname }));
    await Promise.resolve(realtime.createResponse(sessionId, {
      questionId: currentQuestion.id,
      participantId,
      nickname,
      value,
    }));
    setEditing(false);
  };

  if (!participantId || !nickname) {
    return (
      <main className="mobile-shell" style={accentStyle}>
        <JoinForm session={session} onJoin={handleJoin} loading={isJoining} allowNickname={session.allowNickname} />
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="mobile-shell" style={accentStyle}>
        <WaitingScreen title="대기 중" message="관리자가 질문을 시작하면 자동으로 전환됩니다." />
      </main>
    );
  }

  if (myResponse && !editing) {
    return (
      <main className="mobile-shell" style={accentStyle}>
        <SubmittedScreen question={currentQuestion} response={myResponse} onEdit={() => setEditing(true)} />
      </main>
    );
  }

  return (
    <main className="mobile-shell" style={accentStyle}>
      <QuestionAnswerForm question={currentQuestion} onSubmit={handleSubmit} initialValue={myResponse?.value || ''} />
    </main>
  );
}
