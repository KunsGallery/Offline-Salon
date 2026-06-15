import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import JoinForm from '../components/client/JoinForm';
import QuestionAnswerForm from '../components/client/QuestionAnswerForm';
import WaitingScreen from '../components/client/WaitingScreen';
import RealtimeStatusBanner from '../components/RealtimeStatusBanner';
import ResponseNote from '../components/host/ResponseNote';
import { mode, realtime } from '../lib/realtime';
import { useSession } from '../hooks/useSession';
import { useQuestions } from '../hooks/useQuestions';
import { useResponses } from '../hooks/useResponses';
import { createParticipantId } from '../lib/ids';
import { safeJoin } from '../lib/format';

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
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const [likingResponseId, setLikingResponseId] = useState(null);
  const [actionError, setActionError] = useState('');
  const { responses, loading: responsesLoading, error: responsesError } = useResponses(sessionId, currentQuestion?.id || null);

  const visibleResponses = useMemo(() => responses.filter((response) => response.hidden !== true), [responses]);
  const myResponse = useMemo(
    () =>
      visibleResponses.find(
        (response) => response.participantId === participantId && response.questionId === currentQuestion?.id,
      ) || null,
    [currentQuestion?.id, participantId, visibleResponses],
  );
  const otherResponses = useMemo(
    () =>
      visibleResponses
        .filter((response) => response.id !== myResponse?.id)
        .sort((a, b) => (b.likes || 0) - (a.likes || 0) || new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)),
    [myResponse?.id, visibleResponses],
  );
  const realtimeError = sessionError || questionsError || responsesError;
  const realtimeLoading = sessionLoading || questionsLoading || responsesLoading;

  useEffect(() => {
    setIsEditing(false);
    setDraftValue('');
  }, [currentQuestion?.id]);

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
      <main className="mobile-shell client-room-shell">
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
      <main className="mobile-shell client-room-shell">
        <section className="client-panel stack gap-lg">
          <RealtimeStatusBanner loading={realtimeLoading} />
          <h1>세션을 불러오는 중입니다.</h1>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mobile-shell client-room-shell">
        <div className="client-panel stack gap-lg">
          <RealtimeStatusBanner loading={realtimeLoading} />
          <h1>세션을 찾을 수 없습니다.</h1>
          <p className="muted">접속한 세션 ID: {sessionId}</p>
          {mode !== 'firestore' ? (
            <p className="tiny muted">현재 {mode} 모드입니다. 다른 기기와 같은 세션을 보려면 Firestore 모드가 필요합니다.</p>
          ) : null}
        </div>
      </main>
    );
  }

  const accentStyle = { '--accent': session.branding?.primaryColor || '#004AAD' };

  if (session.status === 'ended') {
    return (
      <main className="mobile-shell client-room-shell" style={accentStyle}>
        <WaitingScreen title="세션이 종료되었습니다" message="참여해 주셔서 감사합니다." />
      </main>
    );
  }

  const handleJoin = async (nextNickname) => {
    setIsJoining(true);
    try {
      const nextParticipantId = participantId || createParticipantId(sessionId);
      await Promise.resolve(realtime.joinParticipant(sessionId, nextParticipantId, nextNickname));
      setParticipantId(nextParticipantId);
      setNickname(nextNickname);
      setActionError('');
    } catch (error) {
      console.error('[ParticipantApp] join failed', error);
      setActionError('참여자 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSubmit = async (nextValue) => {
    if (!currentQuestion) return;
    try {
      await Promise.resolve(realtime.upsertParticipant(sessionId, participantId, { nickname }));
      if (myResponse) {
        await Promise.resolve(
          realtime.updateOwnResponse(sessionId, myResponse.id, participantId, {
            value: nextValue,
            nickname,
          }),
        );
      } else {
        await Promise.resolve(
          realtime.submitResponse(sessionId, {
            questionId: currentQuestion.id,
            participantId,
            nickname,
            value: nextValue,
          }),
        );
      }
      setIsEditing(false);
      setDraftValue('');
      setActionError('');
    } catch (error) {
      console.error('[ParticipantApp] submit failed', error);
      setActionError('답변을 저장하지 못했습니다. 다시 시도해 주세요.');
    }
  };

  const handleEdit = () => {
    setDraftValue(safeJoin(myResponse?.value));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraftValue('');
    setIsEditing(false);
  };

  const handleToggleLike = async (response) => {
    if (!response || response.participantId === participantId) return;
    setLikingResponseId(response.id);
    try {
      await Promise.resolve(realtime.toggleResponseLike(sessionId, response.id, participantId));
      setActionError('');
    } catch (error) {
      console.error('[ParticipantApp] like failed', error);
      setActionError('좋아요를 반영하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setLikingResponseId(null);
    }
  };

  if (!participantId || !nickname) {
    return (
      <main className="mobile-shell client-room-shell" style={accentStyle}>
        <JoinForm session={session} onJoin={handleJoin} loading={isJoining} allowNickname={session.allowNickname} />
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="mobile-shell client-room-shell" style={accentStyle}>
        <WaitingScreen title="대기 중" message="관리자가 질문을 시작하면 자동으로 전환됩니다." />
      </main>
    );
  }

  return (
    <main className="mobile-shell client-room-shell" style={accentStyle}>
      <section className="client-panel stack gap-xl client-room">
        <header className="client-room-header">
          <div className="stack gap-xs">
            <p className="eyebrow">LIVE PARTICIPATION</p>
            <h1>{session.title}</h1>
            <p className="muted">{currentQuestion.description || '질문에 참여하고 다른 사람의 공개 조각도 확인해 보세요.'}</p>
          </div>
          <div className="row wrap gap-sm">
            <span className="badge">응답 {visibleResponses.length}</span>
            <span className="badge">내 답변 {myResponse ? '있음' : '없음'}</span>
            <span className={`badge status-${session.status}`}>{session.status}</span>
          </div>
        </header>

        {isEditing ? (
          <QuestionAnswerForm
            question={currentQuestion}
            onSubmit={handleSubmit}
            initialValue={draftValue}
            submitLabel="수정 저장"
            onCancel={handleCancelEdit}
            cancelLabel="수정 취소"
          />
        ) : myResponse ? (
          <div className="stack gap-xl">
            <article className="submitted-card submitted-card--bright">
              <p className="eyebrow">SUBMITTED</p>
              <h2>답변이 제출되었습니다.</h2>
              <p className="muted">{currentQuestion.title}</p>
              <div className="submitted-response">
                <strong>내 응답</strong>
                <p>{safeJoin(myResponse.value)}</p>
              </div>
              <div className="row wrap gap-sm">
                <button className="btn primary large-btn" type="button" onClick={handleEdit}>
                  수정하기
                </button>
                <span className="badge">좋아요 {myResponse.likes || 0}</span>
              </div>
            </article>

            <section className="client-section stack gap-lg">
              <div className="panel-header compact">
                <div>
                  <h2>다른 사람들의 조각</h2>
                  <p className="muted">공개된 답변만 보이고, 좋아요는 실시간으로 반영됩니다.</p>
                </div>
                <span className="badge">{otherResponses.length}</span>
              </div>

              {otherResponses.length === 0 ? (
                <div className="empty-state">
                  <h3>아직 공개된 조각이 없습니다.</h3>
                  <p className="muted">다른 참여자의 답변이 올라오면 이곳에 나타납니다.</p>
                </div>
              ) : (
                <div className="response-grid">
                  {otherResponses.map((response) => (
                    <ResponseNote
                      key={response.id}
                      response={response}
                      participantId={participantId}
                      onLike={handleToggleLike}
                      burstCount={0}
                      busy={likingResponseId === response.id}
                    />
                  ))}
                </div>
              )}
              {likingResponseId ? <p className="tiny muted">좋아요 반영 중...</p> : null}
            </section>

            <div className="client-footer-note">
              <p className="muted">다음 질문이 시작되면 자동으로 전환됩니다.</p>
            </div>
          </div>
        ) : (
          <div className="stack gap-lg">
            <QuestionAnswerForm
              question={currentQuestion}
              onSubmit={handleSubmit}
              initialValue={draftValue}
              submitLabel="답변 제출"
            />
            <div className="client-hint panel-soft">
              <p className="eyebrow">AFTER YOU SUBMIT</p>
              <p className="muted">제출 후에는 내 답변을 수정할 수 있고, 공개된 다른 사람의 조각도 볼 수 있습니다.</p>
            </div>
          </div>
        )}
        {actionError ? <p className="error-text">{actionError}</p> : null}
      </section>
    </main>
  );
}
