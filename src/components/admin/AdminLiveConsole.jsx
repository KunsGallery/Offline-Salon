import React, { useMemo, useState } from 'react';
import { realtime } from '../../lib/realtime';
import { useArtworkSecrets } from '../../hooks/useArtworkSecrets';
import { PdfPageCanvas, PdfZoomSelect } from '../media/LiveMediaViews';

function stageName(stage) {
  if (stage?.mode === 'pdf') return 'PDF 발표';
  if (stage?.mode === 'artwork') return stage.phase === 'collect' ? '작품 제목 수집' : stage.phase === 'vote' ? '작품 제목 투표' : '작품 제목 공개';
  if (stage?.mode === 'gallery') return '채택 작품 갤러리';
  if (stage?.mode === 'lobby') return '참여자 대기방';
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
  const adoptedCount = (session.artworks || []).filter((item) => item.adoptedTitle).length;
  const artworkCount = (session.artworks || []).length;
  const galleryReady = artworkCount > 0;

  const run = async (action) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await Promise.resolve(action()); } catch (reason) { setError(reason.message || '화면 명령을 적용하지 못했습니다.'); } finally { setBusy(false); }
  };
  const phase = (next) => realtime.updateSession(session.id, { stage: { ...stage, phase: next, reveal: next === 'reveal' ? { title: artworkSecret.title || '', artist: artworkSecret.artist || '', description: artworkSecret.description || '' } : null, blackout: false }, showResults: next !== 'collect' });
  const setPage = (next) => deck && realtime.updateSession(session.id, { stage: { ...stage, page: Math.min(deck.pageCount, Math.max(1, next)), blackout: false } });
  const setView = (patch) => realtime.updateSession(session.id, { stage: { ...stage, ...patch } });
  const showLobby = () => realtime.updateSession(session.id, { currentQuestionId: null, stage: { mode: 'lobby', page: 1, blackout: false } });
  const showGallery = () => realtime.updateSession(session.id, { currentQuestionId: null, stage: { mode: 'gallery', page: 1, blackout: false } });
  const adoptTitle = async (response) => {
    if (!artwork || !response) return;
    const adoptedTitle = Array.isArray(response.value) ? response.value.join(' ') : String(response.value || '').trim();
    await realtime.updateArtwork(session.id, artwork.id, { adoptedTitle, adoptedResponseId: response.id, adoptedQuestionId: response.questionId || stage.questionId || null, adoptedLikes: Number(response.likes || 0), adoptedAt: new Date().toISOString() });
    await realtime.updateSession(session.id, { stage: { ...stage, phase: 'reveal', reveal: { title: adoptedTitle, artist: artworkSecret.artist || '', description: artworkSecret.description || '' }, blackout: false }, showResults: true });
  };

  return <div className={`admin-live-console ${showPanel ? '' : 'dock-only'}`}>
    {showPanel ? <section className="live-console-grid">
      <article className="panel stage-preview-card">
        <header><div><p className="eyebrow">ON AIR PREVIEW</p><h2>{stageName(stage)}</h2></div><span className={`connection-dot status-${session.status}`}>● {session.status}</span></header>
        <div className={`stage-preview stage-${stage.mode} ${stage.blackout ? 'blackout' : ''}`}>
          {stage.blackout ? <strong>화면 가림</strong> : stage.mode === 'pdf' && deck ? <><PdfPageCanvas url={deck.fileUrl} pageNumber={page} fitMode={stage.fitMode} zoom={stage.zoom} compact /><span>{page} / {deck.pageCount}</span></> : stage.mode === 'artwork' && artwork ? <><img src={artwork.imageUrl} alt="현재 작품" /><div><strong>{artwork.adoptedTitle || artworkSecret.title || '작품 제목 비공개'}</strong><span>{visibleResponses.length}개 제목 도착</span></div></> : stage.mode === 'gallery' ? <div><strong>채택 작품 갤러리</strong><span>{adoptedCount}개 작품명 채택 완료</span></div> : stage.mode === 'lobby' ? <div><strong>참여자 대기방</strong><span>{participants.length}명이 테이블에 앉았습니다.</span></div> : <div><strong>{activeQuestion?.title || '참여자 대기방'}</strong><span>{visibleResponses.length}개 응답 · {participants.length}명 접속</span></div>}
        </div>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="btn" type="button" onClick={() => window.open(hostUrl, '_blank', 'noopener,noreferrer')}>실제 Host 화면 열기 ↗</button>
      </article>

      <article className="panel live-operation-card">
        <header><p className="eyebrow">LIVE OPERATIONS</p><h2>진행 컨트롤</h2><p className="muted">앞 화면에 즉시 반영됩니다.</p></header>
        <div className="operation-block"><span>화면 모드</span><button className="btn" disabled={busy} onClick={() => run(showLobby)}>대기방</button><button className="btn" disabled={busy || !galleryReady} title={galleryReady ? '' : '등록된 작품이 없습니다.'} onClick={() => run(showGallery)}>전체 갤러리 ({adoptedCount}/{artworkCount})</button><button className={`btn ${stage.blackout ? 'primary' : ''}`} disabled={busy} onClick={() => run(() => setView({ blackout: !stage.blackout }))}>{stage.blackout ? '화면 다시 표시' : '화면 잠시 가리기'}</button></div>
        {stage.mode === 'artwork' && artwork ? <div className="operation-block"><span>작품 활동</span><button className="btn" disabled={busy} onClick={() => run(() => phase('collect'))}>1. 제목 받기</button><button className="btn primary" disabled={busy} onClick={() => run(() => phase('vote'))}>2. 투표 열기</button><button className="btn" disabled={busy} onClick={() => run(() => phase('reveal'))}>원제 참고</button></div> : null}
        {stage.mode === 'artwork' && artwork && visibleResponses.length ? <div className="caption-adoption"><div><strong>최종 작품명 채택</strong><span>좋아요 순위를 참고해 제목 하나를 선택하세요.</span></div>{[...visibleResponses].sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0)).map((response) => <button className={artwork.adoptedResponseId === response.id ? 'selected' : ''} disabled={busy} key={response.id} onClick={() => run(() => adoptTitle(response))}><span>{Array.isArray(response.value) ? response.value.join(' ') : response.value}</span><b>♥ {response.likes || 0}</b><em>{artwork.adoptedResponseId === response.id ? '채택됨' : '채택'}</em></button>)}</div> : null}
        {stage.mode === 'pdf' && deck ? <><div className="operation-block"><span>페이지</span><button className="btn" disabled={busy || page <= 1} onClick={() => run(() => setPage(page - 1))}>← 이전</button><label><input type="number" min="1" max={deck.pageCount} value={page} onChange={(event) => run(() => setPage(Number(event.target.value)))} /> / {deck.pageCount}</label><button className="btn primary" disabled={busy || page >= deck.pageCount} onClick={() => run(() => setPage(page + 1))}>다음 →</button></div><div className="operation-block"><span>보기</span><button className={`btn ${stage.fitMode !== 'width' ? 'primary' : ''}`} onClick={() => run(() => setView({ fitMode: 'fit' }))}>화면 맞춤</button><button className={`btn ${stage.fitMode === 'width' ? 'primary' : ''}`} onClick={() => run(() => setView({ fitMode: 'width' }))}>너비 맞춤</button><PdfZoomSelect value={stage.zoom} onChange={(nextZoom) => run(() => setView({ zoom: nextZoom }))} /></div>{pageLinks.length ? <div className="operation-links"><span>현재 페이지 링크</span>{pageLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label || link.url} ↗</a>)}</div> : null}</> : null}
      </article>
    </section> : null}

    <nav className="admin-live-dock" aria-label="라이브 빠른 제어"><button disabled={busy} onClick={() => run(showLobby)}>대기방</button><button disabled={busy || !galleryReady} onClick={() => run(showGallery)}>갤러리 {adoptedCount}/{artworkCount}</button>{stage.mode === 'artwork' ? <><button disabled={busy} onClick={() => run(() => phase('collect'))}>제목 받기</button><button disabled={busy} onClick={() => run(() => phase('vote'))}>투표</button></> : null}{stage.mode === 'pdf' && deck ? <><button disabled={busy || page <= 1} onClick={() => run(() => setPage(page - 1))}>← {page - 1}</button><strong>{page}/{deck.pageCount}</strong><button disabled={busy || page >= deck.pageCount} onClick={() => run(() => setPage(page + 1))}>{page + 1} →</button></> : null}<button className={stage.blackout ? 'active' : ''} disabled={busy} onClick={() => run(() => setView({ blackout: !stage.blackout }))}>{stage.blackout ? '화면 켜기' : '화면 가리기'}</button></nav>
  </div>;
}
