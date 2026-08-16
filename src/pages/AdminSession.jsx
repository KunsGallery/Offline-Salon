import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ExportButton from '../components/admin/ExportButton';
import AdminStatusBar from '../components/admin/AdminStatusBar';
import QuestionEditor from '../components/admin/QuestionEditor';
import QuestionList from '../components/admin/QuestionList';
import ResponseMonitor from '../components/admin/ResponseMonitor';
import SessionEditor from '../components/admin/SessionEditor';
import SessionMediaStudio from '../components/admin/SessionMediaStudio';
import AdminLiveConsole from '../components/admin/AdminLiveConsole';
import RealtimeStatusBanner from '../components/RealtimeStatusBanner';
import { formatDateTime } from '../lib/format';
import { hasSessionModule } from '../lib/sessionModules';
import QRJoinCard from '../components/host/QRJoinCard';
import { realtime } from '../lib/realtime';
import { useParticipants } from '../hooks/useParticipants';
import { useQuestions } from '../hooks/useQuestions';
import { useAllResponses, useResponses } from '../hooks/useResponses';
import { useSession } from '../hooks/useSession';
import { sessionThemeStyle } from '../lib/colorPalette';

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
  const { responses: allResponses, error: allResponsesError } = useAllResponses(sessionId, Boolean(session));
  const { participants, loading: participantsLoading, error: participantsError } = useParticipants(sessionId);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [section, setSection] = useState('setup');
  const realtimeError = sessionError || questionsError || responsesError || allResponsesError || participantsError;
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

  useEffect(() => {
    if (!session?.id || !realtime.migrateLegacyAssets) return;
    Promise.resolve(realtime.migrateLegacyAssets(session.id)).catch((reason) => console.error('[AdminSession] asset migration failed', reason));
  }, [session?.id]);

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
  const remoteUrl = `${window.location.origin}/remote/${sessionId}`;

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
    <main className="page-shell admin-session" style={sessionThemeStyle(session)}>
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
          <button className="btn" onClick={() => window.open(remoteUrl, '_blank', 'noopener,noreferrer')}>
            모바일 리모컨
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

      <nav className="admin-workspace-tabs" aria-label="관리자 작업 구역">
        <button className={section === 'setup' ? 'active' : ''} onClick={() => setSection('setup')}><span>01</span>세션 준비</button>
        <button className={section === 'live' ? 'active' : ''} onClick={() => setSection('live')}><span>02</span>라이브 진행</button>
        <button className={section === 'engagement' ? 'active' : ''} onClick={() => setSection('engagement')}><span>03</span>참여 현황</button>
        <button className={section === 'access' ? 'active' : ''} onClick={() => setSection('access')}><span>04</span>접속·QR</button>
      </nav>

      {section === 'setup' ? <section className="admin-workspace stack gap-lg"><div className="setup-summary"><div><span>{hasSessionModule(session, 'exhibition-grape') ? '전시 NFC' : '갤러리 이미지'}</span><strong>{hasSessionModule(session, 'exhibition-grape') ? session.exhibitionNfcEntries?.length || 0 : session.artworks?.length || 0}</strong></div><div><span>PDF</span><strong>{session.decks?.length || 0}</strong></div><div><span>참여 활동</span><strong>{questions.filter((item) => !item.internal).length}</strong></div><div><span>마지막 저장</span><strong>{formatDateTime(session.updatedAt)}</strong></div></div><SessionEditor session={session} /><SessionMediaStudio session={session} questions={questions} /></section> : null}

      {section === 'live' ? <section className="admin-workspace stack gap-lg"><AdminLiveConsole session={session} questions={questions} activeQuestion={activeQuestion} responses={responses} allResponses={allResponses} participants={participants} hostUrl={hostUrl} /><section className="question-workspace"><div className="stack gap-lg"><div className="row between align-center"><div><p className="eyebrow">CORE ACTIVITIES</p><h2>질문·참여 활동</h2><p className="muted">질문마다 좋아요 투표와 결과 갤러리 포함 여부를 선택할 수 있습니다.</p></div><button className="btn primary" onClick={() => setEditingQuestion(null)}>새 활동</button></div><QuestionList session={session} questions={questions.filter((question) => !question.internal)} activeQuestionId={session.currentQuestionId} onSelectQuestion={setEditingQuestion} /></div><QuestionEditor session={session} question={editingQuestion} /></section></section> : <AdminLiveConsole session={session} questions={questions} activeQuestion={activeQuestion} responses={responses} allResponses={allResponses} participants={participants} hostUrl={hostUrl} showPanel={false} />}

      {section === 'engagement' ? <section className="admin-workspace engagement-workspace"><div className="engagement-metrics"><article><span>현재 접속</span><strong>{participants.length}</strong></article><article><span>현재 응답</span><strong>{responses.filter((item) => !item.hidden).length}</strong></article><article><span>숨긴 응답</span><strong>{responses.filter((item) => item.hidden).length}</strong></article><article><span>총 좋아요</span><strong>{responses.reduce((sum, item) => sum + Number(item.likes || 0), 0)}</strong></article></div><ResponseMonitor session={session} responses={responses} activeQuestion={activeQuestion} /><section className="panel"><div className="panel-header"><div><h2>응답 내보내기</h2><p className="muted">현재 세션의 모든 응답을 CSV로 저장합니다.</p></div></div><ExportButton session={session} /></section></section> : null}

      {section === 'access' ? <section className="admin-workspace access-workspace"><section className="panel"><div className="panel-header"><div><p className="eyebrow">JOIN & CONTROL</p><h2>참여자·관리자 접속</h2><p className="muted">왼쪽 QR은 참여자, 오른쪽 QR은 관리자 전용 리모컨입니다.</p></div></div><div className="admin-qr-grid"><QRJoinCard sessionId={sessionId} /><QRJoinCard url={remoteUrl} title="관리자 휴대폰으로 스캔해 리모컨을 여세요" /></div></section><section className="panel readiness-card"><p className="eyebrow">EVENT CHECK</p><h2>행사 전 점검</h2><ul><li className={session.status === 'live' ? 'done' : ''}>세션 라이브 상태</li><li className={activeQuestion ? 'done' : ''}>활성 질문 준비</li><li className={(session.artworks?.length || session.decks?.length) ? 'done' : ''}>작품 또는 PDF 등록</li><li className={participants.length ? 'done' : ''}>참여자 연결 테스트</li></ul><button className="btn" onClick={() => window.open(hostUrl, '_blank', 'noopener,noreferrer')}>Host 화면 점검</button><button className="btn primary" onClick={() => window.open(remoteUrl, '_blank', 'noopener,noreferrer')}>리모컨 점검</button></section></section> : null}
    </main>
  );
}
