import React, { useMemo, useState } from 'react';
import { realtime } from '../../lib/realtime';
import { useArtworkSecrets } from '../../hooks/useArtworkSecrets';
import { PdfPageCanvas } from '../media/LiveMediaViews';

function stageName(stage) {
  if (stage?.mode === 'pdf') return 'PDF 발표';
  if (stage?.mode === 'artwork') return stage.phase === 'collect' ? '작품 제목 수집' : stage.phase === 'vote' ? '작품 제목 투표' : '작품 정답 공개';
  return '일반 질문';
}

export default function AdminLiveConsole({ session, activeQuestion, responses, participants, hostUrl, showPanel = true }) {
  const { secrets } = useArtworkSecrets(session.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const stage = session.stage || { mode: 'questions', page: 1 };
  const artwork = (session.artworks || []).find((item) => item.id === stage.artworkId);
  const artworkSecret = secrets[artwork?.id] || {};
  const deck = (session.decks || []).find((item) => item.id === stage.deckId);
  const page = Math.max(1, Number(stage.page || 1));
  const pageLinks = deck?.linksByPage?.[page] || [];
  const visibleResponses = useMemo(() => responses.filter((item) => item.hidden !== true), [responses]);

  const run = async (action) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await Promise.resolve(action()); } catch (reason) { setError(reason.message || '화면 명령을 적용하지 못했습니다.'); } finally { setBusy(false); }
  };
  const questionMode = () => realtime.updateSession(session.id, { stage: { mode: 'questions', page: 1, blackout: false } });
  const phase = (next) => realtime.updateSession(session.id, { stage: { ...stage, phase: next, reveal: next === 'reveal' ? { title: artworkSecret.title || '', artist: artworkSecret.artist || '', description: artworkSecret.description || '' } : null, blackout: false }, showResults: next !== 'collect' });
  const setPage = (next) => deck && realtime.updateSession(session.id, { stage: { ...stage, page: Math.min(deck.pageCount, Math.max(1, next)), blackout: false } });
  const setView = (patch) => realtime.updateSession(session.id, { stage: { ...stage, ...patch } });

  return <div className={`admin-live-console ${showPanel ? '' : 'dock-only'}`}>
    {showPanel ? <section className="live-console-grid">
      <article className="panel stage-preview-card">
        <header><div><p className="eyebrow">ON AIR PREVIEW</p><h2>{stageName(stage)}</h2></div><span className={`connection-dot status-${session.status}`}>● {session.status}</span></header>
        <div className={`stage-preview stage-${stage.mode} ${stage.blackout ? 'blackout' : ''}`}>
          {stage.blackout ? <strong>화면 가림</strong> : stage.mode === 'pdf' && deck ? <><PdfPageCanvas url={deck.fileUrl} pageNumber={page} fitMode={stage.fitMode} zoom={stage.zoom} compact /><span>{page} / {deck.pageCount}</span></> : stage.mode === 'artwork' && artwork ? <><img src={artwork.imageUrl} alt="현재 작품" /><div><strong>{artworkSecret.title || '작품 제목 비공개'}</strong><span>{visibleResponses.length}개 제목 도착</span></div></> : <div><p className="eyebrow">CURRENT QUESTION</p><strong>{activeQuestion?.title || '활성 질문 없음'}</strong><span>{visibleResponses.length}개 응답 · {participants.length}명 접속</span></div>}
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="btn" type="button" onClick={() => window.open(hostUrl, '_blank', 'noopener,noreferrer')}>실제 Host 화면 열기 ↗</button>
      </article>

      <article className="panel live-operation-card">
        <header><p className="eyebrow">LIVE OPERATIONS</p><h2>진행 컨트롤</h2><p className="muted">앞 화면에 즉시 반영됩니다.</p></header>
        <div className="operation-block"><span>화면 모드</span><button className="btn" disabled={busy} onClick={() => run(questionMode)}>질문 화면으로</button><button className={`btn ${stage.blackout ? 'primary' : ''}`} disabled={busy} onClick={() => run(() => setView({ blackout: !stage.blackout }))}>{stage.blackout ? '화면 다시 표시' : '화면 잠시 가리기'}</button></div>
        {stage.mode === 'artwork' && artwork ? <div className="operation-block"><span>작품 활동</span><button className="btn" disabled={busy} onClick={() => run(() => phase('collect'))}>1. 제목 받기</button><button className="btn" disabled={busy} onClick={() => run(() => phase('vote'))}>2. 투표 열기</button><button className="btn primary" disabled={busy} onClick={() => run(() => phase('reveal'))}>3. 정답 공개</button></div> : null}
        {stage.mode === 'pdf' && deck ? <><div className="operation-block"><span>페이지</span><button className="btn" disabled={busy || page <= 1} onClick={() => run(() => setPage(page - 1))}>← 이전</button><label><input type="number" min="1" max={deck.pageCount} value={page} onChange={(event) => run(() => setPage(Number(event.target.value)))} /> / {deck.pageCount}</label><button className="btn primary" disabled={busy || page >= deck.pageCount} onClick={() => run(() => setPage(page + 1))}>다음 →</button></div><div className="operation-block"><span>보기</span><button className={`btn ${stage.fitMode !== 'width' ? 'primary' : ''}`} onClick={() => run(() => setView({ fitMode: 'fit' }))}>화면 맞춤</button><button className={`btn ${stage.fitMode === 'width' ? 'primary' : ''}`} onClick={() => run(() => setView({ fitMode: 'width' }))}>너비 맞춤</button><button className="btn" onClick={() => run(() => setView({ zoom: Math.max(.6, Number(stage.zoom || 1) - .1) }))}>−</button><b>{Math.round(Number(stage.zoom || 1) * 100)}%</b><button className="btn" onClick={() => run(() => setView({ zoom: Math.min(2, Number(stage.zoom || 1) + .1) }))}>＋</button></div>{pageLinks.length ? <div className="operation-links"><span>현재 페이지 링크</span>{pageLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label || link.url} ↗</a>)}</div> : null}</> : null}
      </article>
    </section> : null}

    <nav className="admin-live-dock" aria-label="라이브 빠른 제어"><button disabled={busy} onClick={() => run(questionMode)}>질문 화면</button>{stage.mode === 'artwork' ? <><button disabled={busy} onClick={() => run(() => phase('collect'))}>제목 받기</button><button disabled={busy} onClick={() => run(() => phase('vote'))}>투표</button><button disabled={busy} onClick={() => run(() => phase('reveal'))}>정답 공개</button></> : null}{stage.mode === 'pdf' && deck ? <><button disabled={busy || page <= 1} onClick={() => run(() => setPage(page - 1))}>← {page - 1}</button><strong>{page}/{deck.pageCount}</strong><button disabled={busy || page >= deck.pageCount} onClick={() => run(() => setPage(page + 1))}>{page + 1} →</button></> : null}<button className={stage.blackout ? 'active' : ''} disabled={busy} onClick={() => run(() => setView({ blackout: !stage.blackout }))}>{stage.blackout ? '화면 켜기' : '화면 가리기'}</button></nav>
  </div>;
}
