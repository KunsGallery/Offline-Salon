import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import HostShell from '../components/host/HostShell';
import QRJoinCard from '../components/host/QRJoinCard';
import LiveRoomView from '../components/host/LiveRoomView';
import RealtimeStatusBanner from '../components/RealtimeStatusBanner';
import { useParticipants } from '../hooks/useParticipants';
import { useQuestions } from '../hooks/useQuestions';
import { useResponses } from '../hooks/useResponses';
import { useSession } from '../hooks/useSession';

export default function HostDisplay() {
  const { sessionId } = useParams();
  const { session, loading: sessionLoading, error: sessionError } = useSession(sessionId);
  const { questions, loading: questionsLoading, error: questionsError } = useQuestions(sessionId);
  const { participants, loading: participantsLoading, error: participantsError } = useParticipants(sessionId);
  const activeQuestion = useMemo(
    () => questions.find((question) => question.id === session?.currentQuestionId) || questions.find((question) => question.isActive) || null,
    [questions, session?.currentQuestionId],
  );
  const {
    responses,
    loading: responsesLoading,
    error: responsesError,
  } = useResponses(sessionId, activeQuestion?.id || null);
  const visibleResponses = useMemo(() => responses.filter((response) => response.hidden !== true), [responses]);
  const [likeEffects, setLikeEffects] = useState([]);
  const previousLikesRef = useRef({});

  const realtimeError = sessionError || questionsError || participantsError || responsesError;
  const realtimeLoading = sessionLoading || questionsLoading || participantsLoading || responsesLoading;

  useEffect(() => {
    previousLikesRef.current = {};
    setLikeEffects([]);
  }, [activeQuestion?.id]);

  useEffect(() => {
    if (!activeQuestion?.id) return;
    if (Object.keys(previousLikesRef.current).length === 0) {
      previousLikesRef.current = Object.fromEntries(visibleResponses.map((response) => [response.id, response.likes || 0]));
      return;
    }

    const nextSnapshot = {};
    visibleResponses.forEach((response) => {
      const prev = previousLikesRef.current[response.id] || 0;
      const next = response.likes || 0;

      if (next > prev) {
        const token = `${response.id}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
        setLikeEffects((current) => [...current, { token, responseId: response.id, burstCount: next - prev }]);
        window.setTimeout(() => {
          setLikeEffects((current) => current.filter((effect) => effect.token !== token));
        }, 1500);
      }

      nextSnapshot[response.id] = next;
    });
    previousLikesRef.current = nextSnapshot;
  }, [activeQuestion?.id, visibleResponses]);

  if (realtimeError) {
    return (
      <div className="host-screen">
        <div className="center-screen">
          <section className="panel stack gap-lg">
            <RealtimeStatusBanner loading={realtimeLoading} error={realtimeError} />
            <h1>데이터 연결에 문제가 있습니다.</h1>
            <p className="muted">Firestore 설정 또는 네트워크 상태를 확인해주세요.</p>
          </section>
        </div>
      </div>
    );
  }

  if (realtimeLoading && session === undefined) {
    return (
      <div className="host-screen">
        <div className="center-screen">
          <section className="panel stack gap-lg">
            <RealtimeStatusBanner loading={realtimeLoading} />
            <h1>세션을 불러오는 중입니다.</h1>
          </section>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="host-screen">
        <div className="center-screen">
          <h1>세션을 찾을 수 없습니다.</h1>
        </div>
      </div>
    );
  }

  return (
    <HostShell
      session={session}
      aside={
        <>
          <span className="badge">참여자 {participants.length}</span>
          <span className="badge">응답 {visibleResponses.length}</span>
          <span className={`badge status-${session.status}`}>{session.status}</span>
        </>
      }
    >
      <LiveRoomView
        question={activeQuestion}
        responses={visibleResponses}
        participants={participants}
        session={session}
        likeEffects={likeEffects}
      />

      <aside className="host-aside stack gap-lg">
        <section className="panel">
          <div className="panel-header compact">
            <h2>참여 QR</h2>
            <span className="badge">Live</span>
          </div>
          <QRJoinCard sessionId={sessionId} />
        </section>
      </aside>
    </HostShell>
  );
}
