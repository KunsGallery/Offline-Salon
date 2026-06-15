import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ExportButton from '../components/admin/ExportButton';
import AdminStatusBar from '../components/admin/AdminStatusBar';
import QuestionEditor from '../components/admin/QuestionEditor';
import QuestionList from '../components/admin/QuestionList';
import ResponseMonitor from '../components/admin/ResponseMonitor';
import SessionEditor from '../components/admin/SessionEditor';
import RealtimeStatusBanner from '../components/RealtimeStatusBanner';
import { formatDateTime } from '../lib/format';
import QRJoinCard from '../components/host/QRJoinCard';
import { realtime } from '../lib/realtime';
import { useParticipants } from '../hooks/useParticipants';
import { useQuestions } from '../hooks/useQuestions';
import { useResponses } from '../hooks/useResponses';
import { useSession } from '../hooks/useSession';

function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  return Promise.resolve();
}

export default function AdminSession() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { session, loading: sessionLoading, error: sessionError } = useSession(sessionId);
  const { questions, loading: questionsLoading, error: questionsError } = useQuestions(sessionId);
  const activeQuestion = useMemo(
    () => questions.find((question) => question.id === session?.currentQuestionId) || questions.find((question) => question.isActive) || null,
    [questions, session?.currentQuestionId],
  );
  const { responses, loading: responsesLoading, error: responsesError } = useResponses(sessionId, activeQuestion?.id || null);
  const { participants, loading: participantsLoading, error: participantsError } = useParticipants(sessionId);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');
  const realtimeError = sessionError || questionsError || responsesError || participantsError;
  const realtimeLoading = sessionLoading || questionsLoading || responsesLoading || participantsLoading;

  useEffect(() => {
    if (!editingQuestion) return;
    const latestQuestion = questions.find((question) => question.id === editingQuestion.id);
    if (!latestQuestion) {
      setEditingQuestion(null);
      return;
    }

    if (latestQuestion !== editingQuestion) {
      setEditingQuestion(latestQuestion);
    }
  }, [editingQuestion, questions]);

  if (realtimeError) {
    return (
      <main className="page-shell">
        <section className="panel stack gap-lg">
          <RealtimeStatusBanner loading={realtimeLoading} error={realtimeError} />
          <div className="stack gap-sm">
            <h1>데이터 연결에 문제가 있습니다.</h1>
            <p className="muted">Firestore 설정 또는 네트워크 상태를 확인해주세요.</p>
          </div>
          <button className="btn primary" onClick={() => navigate('/admin')}>
            세션 목록으로 돌아가기
          </button>
        </section>
      </main>
    );
  }

  if (realtimeLoading && session === undefined) {
    return (
      <main className="page-shell">
        <section className="panel stack gap-lg">
          <RealtimeStatusBanner loading={realtimeLoading} />
          <h1>세션을 불러오는 중입니다.</h1>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="page-shell">
        <section className="panel stack gap-lg">
          <RealtimeStatusBanner loading={realtimeLoading} />
          <h1>세션을 찾을 수 없습니다.</h1>
          <button className="btn primary" onClick={() => navigate('/admin')}>
            돌아가기
          </button>
        </section>
      </main>
    );
  }

  const clientUrl = `${window.location.origin}/client/${sessionId}`;
  const hostUrl = `${window.location.origin}/host/${sessionId}`;

  const copyClientLink = async () => {
    try {
      await copyText(clientUrl);
      setCopyStatus('링크가 복사되었습니다.');
    } catch {
      setCopyStatus('복사에 실패했습니다.');
    }
    window.setTimeout(() => setCopyStatus(''), 1800);
  };

  const confirmReset = () => {
    const ok = window.confirm('이 세션의 모든 응답과 참여자 상태를 초기화할까요? 이 작업은 되돌릴 수 없습니다.');
    if (ok) {
      realtime.resetSession(session.id);
    }
  };

  return (
    <main className="page-shell admin-session" style={{ '--accent': session.branding?.primaryColor || '#004AAD' }}>
      <AdminStatusBar />
      <header className="admin-header panel">
        <div className="stack gap-xs">
          <p className="eyebrow">ADMIN PANEL</p>
          <h1>{session.title}</h1>
          <p className="muted">{session.description}</p>
        </div>
        <div className="row wrap gap-sm">
          <button className="btn" onClick={() => navigate('/admin')}>
            세션 목록
          </button>
          <button className="btn" onClick={() => window.open(hostUrl, '_blank', 'noopener,noreferrer')}>
            Host 화면 열기
          </button>
          <button className="btn" onClick={copyClientLink}>
            Client 링크 복사
          </button>
          <button className="btn ghost" onClick={() => realtime.setShowResults(session.id, !session.showResults)}>
            {session.showResults ? '결과 숨기기' : '결과 공개'}
          </button>
          <button className="btn danger" onClick={confirmReset}>
            세션 초기화
          </button>
        </div>
        <RealtimeStatusBanner loading={realtimeLoading} compact />
        {copyStatus ? <p className="tiny muted copy-status">{copyStatus}</p> : null}
      </header>

      <section className="admin-grid">
        <div className="stack gap-lg">
          <SessionEditor session={session} />

          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>참여자 / 링크</h2>
                <p className="muted">
                  현재 {participants.length}명 접속 중 · 업데이트 {formatDateTime(session.updatedAt)}
                </p>
              </div>
            </div>
            <QRJoinCard sessionId={sessionId} />
          </section>
        </div>

        <div className="stack gap-lg">
          <div className="row between align-center">
            <div>
              <h2>질문 관리</h2>
              <p className="muted">활성 질문을 선택하면 Host와 Client가 즉시 전환됩니다.</p>
            </div>
            <button className="btn primary" onClick={() => setEditingQuestion(null)}>
              새 질문
            </button>
          </div>
          <QuestionList session={session} questions={questions} activeQuestionId={session.currentQuestionId} onSelectQuestion={setEditingQuestion} />
          <QuestionEditor session={session} question={editingQuestion} />
        </div>

        <div className="stack gap-lg">
          <ResponseMonitor session={session} responses={responses} activeQuestion={activeQuestion} />
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>내보내기</h2>
                <p className="muted">현재 세션의 모든 응답을 CSV로 저장합니다.</p>
              </div>
            </div>
            <ExportButton session={session} />
          </section>
        </div>
      </section>
    </main>
  );
}
