import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import HostShell from '../components/host/HostShell';
import QRJoinCard from '../components/host/QRJoinCard';
import PollChartView from '../components/host/PollChartView';
import RankingView from '../components/host/RankingView';
import TextWallView from '../components/host/TextWallView';
import WordCloudView from '../components/host/WordCloudView';
import RealtimeStatusBanner from '../components/RealtimeStatusBanner';
import { useParticipants } from '../hooks/useParticipants';
import { useQuestions } from '../hooks/useQuestions';
import { useResponses } from '../hooks/useResponses';
import { useSession } from '../hooks/useSession';

function countByValue(responses) {
  return responses.reduce((accumulator, response) => {
    const key = Array.isArray(response.value) ? response.value.join('|') : response.value;
    accumulator[key] = (accumulator[key] || 0) + 1;
    return accumulator;
  }, {});
}

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
  const visibleResponses = responses.filter((response) => !response.hidden);
  const realtimeError = sessionError || questionsError || participantsError || responsesError;
  const realtimeLoading = sessionLoading || questionsLoading || participantsLoading || responsesLoading;
  const joinUrl = `${window.location.origin}/client/${sessionId}`;

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

  const counts = countByValue(visibleResponses);

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
      <section className="host-main panel">
        <div className="stack gap-xs">
          <p className="eyebrow">현재 질문</p>
          <h2>{activeQuestion?.title || '잠시 후 질문이 시작됩니다.'}</h2>
          <p className="muted">{activeQuestion?.description || '관리자가 질문을 선택하면 여기에 표시됩니다.'}</p>
        </div>

        {session.status === 'ended' ? (
          <div className="center-screen host-placeholder">
            <h3>참여해주셔서 감사합니다.</h3>
          </div>
        ) : !activeQuestion ? (
          <div className="center-screen host-placeholder">
            <h3>잠시 후 질문이 시작됩니다.</h3>
            <p className="muted">관리자가 질문을 활성화하면 참여 안내가 나타납니다.</p>
          </div>
        ) : session.showResults ? (
          <>
            {activeQuestion.type === 'wordcloud' ? <WordCloudView responses={visibleResponses} /> : null}
            {activeQuestion.type === 'poll' ? <PollChartView options={activeQuestion.options || []} counts={counts} /> : null}
            {activeQuestion.type === 'ranking' ? <RankingView options={activeQuestion.options || []} counts={counts} /> : null}
            {activeQuestion.type === 'text' ? <TextWallView responses={visibleResponses} /> : null}
          </>
        ) : (
          <div className="center-screen host-placeholder collecting">
            <h3>답변 수집 중</h3>
            <p className="muted">결과는 관리자가 공개할 때 보여집니다.</p>
            <span className="badge">응답 {visibleResponses.length}</span>
          </div>
        )}
      </section>

      <aside className="host-aside stack gap-lg">
        <section className="panel">
          <div className="panel-header compact">
            <h2>참여 QR</h2>
            <span className="badge">Live</span>
          </div>
          <QRJoinCard url={joinUrl} />
        </section>
      </aside>
    </HostShell>
  );
}
