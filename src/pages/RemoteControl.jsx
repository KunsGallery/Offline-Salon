import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { realtime } from '../lib/realtime';
import { useSession } from '../hooks/useSession';
import { useAllResponses, useResponses } from '../hooks/useResponses';
import { useArtworkSecrets } from '../hooks/useArtworkSecrets';
import { sessionThemeStyle } from '../lib/colorPalette';
import { createId } from '../lib/ids';
import { artworkReveal, findArtworkActivityQuestion } from '../lib/artworkActivity';
import { PdfPageCanvas, PdfZoomSelect } from '../components/media/LiveMediaViews';

export default function RemoteControl() {
  const { sessionId } = useParams();
  const [reviewArtworkId, setReviewArtworkId] = useState(null);
  const { session, loading, error: sessionError } = useSession(sessionId);
  const { secrets } = useArtworkSecrets(sessionId, Boolean(session));
  const { responses } = useResponses(sessionId, session?.stage?.questionId || session?.currentQuestionId || null);
  const reviewArtworkBase = (session?.artworks || []).find((item) => item.id === reviewArtworkId) || null;
  const reviewArtwork = reviewArtworkBase ? { ...reviewArtworkBase, ...(secrets[reviewArtworkBase.id] || {}) } : null;
  const reviewQuestions = (session?.questions || []).filter((question) => question.type === 'artwork-title' && question.artworkId === reviewArtwork?.id);
  const { responses: allReviewResponses, loading: reviewLoading, error: reviewError } = useAllResponses(sessionId, Boolean(reviewArtwork));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const [awake, setAwake] = useState(false);
  const wakeLock = useRef(null);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener('online', sync); window.addEventListener('offline', sync);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);
  useEffect(() => () => wakeLock.current?.release?.(), []);

  const toggleWakeLock = async () => {
    try {
      if (wakeLock.current) { await wakeLock.current.release(); wakeLock.current = null; setAwake(false); return; }
      if (!navigator.wakeLock) throw new Error('이 브라우저는 화면 켜짐 유지를 지원하지 않습니다.');
      wakeLock.current = await navigator.wakeLock.request('screen');
      wakeLock.current.addEventListener('release', () => { wakeLock.current = null; setAwake(false); });
      setAwake(true);
    } catch (reason) { setError(reason.message); }
  };

  if (loading || session === undefined) return <main className="remote-control center-screen"><h1>리모컨 연결 중…</h1></main>;
  if (!session) return <main className="remote-control center-screen"><h1>세션을 찾을 수 없습니다.</h1></main>;

  const stage = session.stage || { mode: 'lobby' };
  const artworks = (session.artworks || []).map((item) => ({ ...item, ...(secrets[item.id] || {}) }));
  const artwork = artworks.find((item) => item.id === stage.artworkId);
  const deck = (session.decks || []).find((item) => item.id === stage.deckId);
  const page = Math.max(1, Number(stage.page || 1));
  const pageLinks = deck?.linksByPage?.[page] || [];
  const nearbyPages = deck ? Array.from({ length: Math.min(5, deck.pageCount) }, (_, index) => Math.min(deck.pageCount, Math.max(1, page - 2) + index)).filter((value, index, list) => list.indexOf(value) === index) : [];
  const run = async (action) => {
    if (busy || !online) return;
    setBusy(true); setError('');
    try { await Promise.resolve(action()); } catch (reason) { setError(reason.message || '명령을 적용하지 못했습니다.'); } finally { setBusy(false); }
  };
  const startArtwork = async (item) => {
    const existingQuestion = findArtworkActivityQuestion(session, item);
    if (existingQuestion || item.adoptedTitle) {
      if (existingQuestion) await Promise.resolve(realtime.activateQuestion(session.id, existingQuestion.id));
      await Promise.resolve(realtime.updateSession(session.id, {
        currentQuestionId: existingQuestion?.id || null,
        stage: { mode: 'artwork', artworkId: item.id, phase: item.adoptedTitle ? 'reveal' : 'collect', runId: existingQuestion?.runId || null, questionId: existingQuestion?.id || null, page: 1, reveal: item.adoptedTitle ? artworkReveal(item, item) : null, blackout: false },
        showResults: Boolean(item.adoptedTitle),
        status: 'live',
      }));
      return;
    }
    const runId = createId('run');
    const question = await Promise.resolve(realtime.createQuestion(session.id, { title: '이 작품에 제목을 붙인다면?', description: '떠오르는 제목을 적어보세요.', type: 'artwork-title', artworkId: item.id, runId, internal: true }));
    await Promise.resolve(realtime.activateQuestion(session.id, question.id));
    await Promise.resolve(realtime.updateSession(session.id, { stage: { mode: 'artwork', artworkId: item.id, phase: 'collect', runId, questionId: question.id, page: 1, reveal: null, blackout: false }, showResults: false, status: 'live' }));
  };
  const setPhase = (phase) => realtime.updateSession(session.id, { stage: { ...stage, phase, reveal: phase === 'reveal' ? { title: artwork?.title || '', artist: artwork?.artist || '', description: artwork?.description || '' } : null, blackout: false }, showResults: phase !== 'collect' });
  const setPage = (next) => deck && realtime.updateSession(session.id, { stage: { ...stage, page: Math.min(deck.pageCount, Math.max(1, next)), blackout: false } });
  const setGalleryPosition = (next) => realtime.updateSession(session.id, { stage: { ...stage, page: Math.min(Math.max(1, artworkCount), Math.max(1, next)), blackout: false } });
  const setView = (patch) => realtime.updateSession(session.id, { stage: { ...stage, ...patch } });
  const showLobby = () => realtime.updateSession(session.id, { currentQuestionId: null, stage: { mode: 'lobby', page: 1, blackout: false } });
  const showGallery = () => realtime.updateSession(session.id, { currentQuestionId: null, stage: { mode: 'gallery', page: 1, blackout: false } });
  const adoptTitle = async (response) => {
    if (!artwork || !response) return;
    const adoptedTitle = Array.isArray(response.value) ? response.value.join(' ') : String(response.value || '').trim();
    await realtime.updateArtwork(session.id, artwork.id, { adoptedTitle, adoptedResponseId: response.id, adoptedQuestionId: response.questionId || stage.questionId || null, adoptedLikes: Number(response.likes || 0), adoptedAt: new Date().toISOString() });
    await realtime.updateSession(session.id, { stage: { ...stage, phase: 'reveal', reveal: { title: adoptedTitle, artist: artwork.artist || '', description: artwork.description || '' }, blackout: false }, showResults: true });
  };
  const deleteTitleResponse = (response, targetArtwork) => {
    if (!response || !targetArtwork) return;
    const responseTitle = Array.isArray(response.value) ? response.value.join(' ') : String(response.value || '').trim();
    const isAdopted = targetArtwork.adoptedResponseId === response.id;
    const warning = isAdopted
      ? `“${responseTitle}” 제목을 삭제할까요?\n최종 채택도 함께 취소되며 복구할 수 없습니다.`
      : `“${responseTitle}” 제목을 삭제할까요?\n삭제한 제목은 복구할 수 없습니다.`;
    if (!window.confirm(warning)) return;
    run(async () => {
      const isOnScreen = isAdopted && stage.mode === 'artwork' && stage.artworkId === targetArtwork.id;
      await realtime.deleteArtworkTitleResponse(session.id, response.id, targetArtwork.id, {
        clearAdoption: isAdopted,
        sessionPatch: isOnScreen ? {
          stage: { ...stage, phase: 'vote', reveal: null, blackout: false },
          showResults: true,
        } : null,
      });
    });
  };
  const adoptedCount = (session.artworks || []).filter((item) => item.adoptedTitle).length;
  const artworkCount = (session.artworks || []).length;
  const galleryReady = artworkCount > 0;
  const reviewQuestionIds = new Set(reviewQuestions.map((question) => question.id));
  const archivedReviewResponses = allReviewResponses.filter((response) => reviewQuestionIds.has(response.questionId)).sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  return <main className="remote-control remote-v2" style={sessionThemeStyle(session)}>
    <header><div><p className="eyebrow">OFFLINE SALON REMOTE</p><h1>{session.title}</h1></div><div className="remote-connection"><span className={online && !sessionError ? 'online' : 'offline'}>● {online && !sessionError ? '연결됨' : '연결 끊김'}</span><button className={awake ? 'active' : ''} onClick={toggleWakeLock}>{awake ? '화면 유지 중' : '화면 켜두기'}</button></div></header>

    <section className="remote-now"><div className="remote-now-title"><div><p className="eyebrow">NOW ON SCREEN</p><h2>{stage.mode === 'pdf' ? 'PDF 발표' : stage.mode === 'artwork' ? stage.phase === 'collect' ? '작품 제목 수집' : stage.phase === 'vote' ? '작품 제목 투표' : '채택 제목 공개' : stage.mode === 'gallery' ? '전체 작품 갤러리' : stage.mode === 'lobby' ? '참여자 대기방' : '일반 질문 화면'}</h2></div><button className={stage.blackout ? 'active' : ''} disabled={busy} onClick={() => run(() => setView({ blackout: !stage.blackout }))}>{stage.blackout ? '다시 표시' : '화면 가리기'}</button></div>
      <div className={`remote-screen-preview ${stage.blackout ? 'blackout' : ''}`}>{stage.blackout ? <strong>화면 가림</strong> : deck ? <PdfPageCanvas url={deck.fileUrl} pageNumber={page} fitMode={stage.fitMode} zoom={stage.zoom} compact /> : artwork ? <img src={artwork.imageUrl} alt="작품" /> : <div><strong>{stage.mode === 'gallery' ? `${adoptedCount}개 작품의 갤러리` : session.title}</strong><span>{stage.mode === 'gallery' ? '작품과 채택된 제목을 함께 표시 중' : '참여자 캐릭터 대기방'}</span></div>}</div>
      {stage.mode === 'gallery' ? <div className="remote-gallery-controls" aria-label="갤러리 화면 이동"><button disabled={busy || page <= 1} onClick={() => run(() => setGalleryPosition(1))}>맨 위</button><button disabled={busy || page <= 1} onClick={() => run(() => setGalleryPosition(page - 1))}>↑ 위로</button><button disabled={busy || page >= artworkCount} onClick={() => run(() => setGalleryPosition(page + 1))}>아래로 ↓</button></div> : null}
      {artwork ? <div className="remote-live-metric"><strong>{artwork.title || '작품'}</strong><b>{responses.length}<small> TITLES</small></b></div> : null}
      {deck ? <><div className="remote-page-controls"><button disabled={busy || page <= 1} onClick={() => run(() => setPage(page - 1))}>← 이전 장</button><strong>{page} / {deck.pageCount}</strong><button disabled={busy || page >= deck.pageCount} onClick={() => run(() => setPage(page + 1))}>다음 장 →</button></div><div className="remote-view-controls"><button className={stage.fitMode !== 'width' ? 'active' : ''} onClick={() => run(() => setView({ fitMode: 'fit' }))}>화면 맞춤</button><button className={stage.fitMode === 'width' ? 'active' : ''} onClick={() => run(() => setView({ fitMode: 'width' }))}>너비 맞춤</button><PdfZoomSelect value={stage.zoom} onChange={(nextZoom) => run(() => setView({ zoom: nextZoom }))} /></div><div className="remote-page-strip">{nearbyPages.map((number) => <button className={number === page ? 'active' : ''} key={number} onClick={() => run(() => setPage(number))}><PdfPageCanvas url={deck.fileUrl} pageNumber={number} compact /><span>{number}</span></button>)}</div>{pageLinks.length ? <div className="remote-links"><strong>현재 페이지 링크</strong>{pageLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label || '링크 열기'} ↗</a>)}</div> : null}</> : null}
      {artwork ? <div className="remote-phase-controls"><button disabled={busy} onClick={() => run(() => setPhase('collect'))}>제목 받기</button><button disabled={busy} onClick={() => run(() => setPhase('vote'))}>투표 열기</button><button disabled={busy} onClick={() => run(() => setPhase('reveal'))}>원제 참고</button></div> : null}
      {artwork && responses.length ? <div className="remote-caption-picker"><strong>최종 작품명 선택</strong><span>제목을 눌러 채택하거나, 잘못 들어온 제목을 삭제할 수 있습니다.</span>{[...responses].filter((item) => !item.hidden).sort((a, b) => Number(b.likes || 0) - Number(a.likes || 0)).map((response) => {
        const responseTitle = Array.isArray(response.value) ? response.value.join(' ') : response.value;
        const isAdopted = artwork.adoptedResponseId === response.id;
        return <div className={`remote-caption-row ${isAdopted ? 'selected' : ''}`} key={response.id}><button className="remote-caption-choice" type="button" disabled={busy} onClick={() => run(() => adoptTitle(response))}><span>{responseTitle}</span><b>♥ {response.likes || 0}</b><em>{isAdopted ? '채택됨' : '채택'}</em></button><button className="remote-caption-delete" type="button" disabled={busy} onClick={() => deleteTitleResponse(response, artwork)} aria-label={`“${responseTitle}” 제목 삭제`}>삭제</button></div>;
      })}</div> : null}
      {error || sessionError ? <p className="remote-error">{error || sessionError.message}</p> : busy ? <p className="remote-command-status">명령 적용 중…</p> : <p className="remote-command-status">마지막 동기화 {new Date(session.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
    </section>

    <section className="remote-assets"><div><p className="eyebrow">ARTWORKS</p><h2>작품 선택</h2></div>{reviewArtwork ? <section className="remote-title-archive" aria-label={`${reviewArtwork.adoptedTitle || reviewArtwork.title || '작품'} 제목 기록`}><header><div><span>제목 기록</span><h3>{reviewArtwork.adoptedTitle || reviewArtwork.title || '제목 미정'}</h3></div><button type="button" onClick={() => setReviewArtworkId(null)} aria-label="제목 기록 닫기">닫기</button></header>{reviewArtwork.adoptedTitle ? <p className="remote-title-adopted"><span>최종 채택</span><strong>{reviewArtwork.adoptedTitle}</strong></p> : null}<div className="remote-title-archive-summary"><strong>{archivedReviewResponses.length}</strong><span>개의 제출 제목 전체 기록입니다.</span></div>{reviewLoading ? <p className="remote-title-archive-state">기록을 불러오는 중…</p> : reviewError ? <p className="remote-title-archive-state error">기록을 불러오지 못했습니다. 잠시 후 다시 열어주세요.</p> : !reviewQuestions.length ? <p className="remote-title-archive-state">이 작품에 연결된 제목 활동 기록이 없습니다.</p> : archivedReviewResponses.length ? <ol>{archivedReviewResponses.map((response) => {
      const responseTitle = Array.isArray(response.value) ? response.value.join(' ') : response.value;
      const isAdopted = reviewArtwork.adoptedResponseId === response.id;
      return <li className={isAdopted ? 'adopted' : ''} key={response.id}><div className="remote-title-response-copy"><strong>{responseTitle}</strong><span>{response.nickname || '익명 참여자'}{response.hidden ? ' · 숨김 처리됨' : ''}</span></div><div className="remote-title-response-actions"><b>{isAdopted ? '채택 · ' : ''}♥ {response.likes || 0}</b><button type="button" disabled={busy} onClick={() => deleteTitleResponse(response, reviewArtwork)} aria-label={`“${responseTitle}” 제목 삭제`}>삭제</button></div></li>;
    })}</ol> : <p className="remote-title-archive-state">제출된 제목이 없습니다.</p>}</section> : null}<div className="remote-asset-grid">{artworks.map((item) => { const hasHistory = Boolean(findArtworkActivityQuestion(session, item) || item.adoptedTitle); return <article className="remote-asset-card" key={item.id}><button className="remote-asset-present" disabled={busy} onClick={() => run(() => startArtwork(item))}><img src={item.imageUrl} alt={item.title || '작품'} /><span>{item.adoptedTitle || item.title || '제목 미정'}{item.adoptedTitle ? ' · 채택 완료' : ''}</span></button>{hasHistory ? <button className="remote-asset-history" type="button" aria-expanded={reviewArtworkId === item.id} onClick={() => setReviewArtworkId((current) => current === item.id ? null : item.id)}>제목 기록</button> : null}</article>; })}</div></section>
    <section className="remote-assets"><div><p className="eyebrow">PRESENTATIONS</p><h2>PDF 선택</h2></div><div className="remote-asset-grid">{(session.decks || []).map((item) => <button disabled={busy} key={item.id} onClick={() => run(() => realtime.updateSession(session.id, { stage: { mode: 'pdf', deckId: item.id, page: 1, fitMode: 'fit', zoom: 1, blackout: false }, status: 'live' }))}><img src={item.thumbnailUrl} alt={`${item.title} 표지`} /><span>{item.title}</span></button>)}</div></section>
    <footer><button onClick={() => window.open(`${window.location.origin}/host/${session.id}`, '_blank', 'noopener,noreferrer')}>화면 보기</button><button className="remote-home" disabled={busy} onClick={() => run(showLobby)}>대기방</button>{deck ? <button className="remote-next" disabled={busy || page >= deck.pageCount} onClick={() => run(() => setPage(page + 1))}>다음 장 →</button> : <button className="remote-next" disabled={busy || !galleryReady} title={galleryReady ? '' : '등록된 작품이 없습니다.'} onClick={() => run(showGallery)}>갤러리 {adoptedCount}/{artworkCount}</button>}</footer>
  </main>;
}
