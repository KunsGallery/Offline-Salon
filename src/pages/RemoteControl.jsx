import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { realtime } from '../lib/realtime';
import { useSession } from '../hooks/useSession';
import { useResponses } from '../hooks/useResponses';
import { useArtworkSecrets } from '../hooks/useArtworkSecrets';
import { sessionThemeStyle } from '../lib/colorPalette';
import { createId } from '../lib/ids';
import { PdfPageCanvas } from '../components/media/LiveMediaViews';

export default function RemoteControl() {
  const { sessionId } = useParams();
  const { session, loading, error: sessionError } = useSession(sessionId);
  const { secrets } = useArtworkSecrets(sessionId, Boolean(session));
  const { responses } = useResponses(sessionId, session?.stage?.questionId || session?.currentQuestionId || null);
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

  const stage = session.stage || { mode: 'questions' };
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
  const stop = () => realtime.updateSession(session.id, { stage: { mode: 'questions', page: 1, blackout: false } });
  const startArtwork = async (item) => {
    const runId = createId('run');
    const question = await Promise.resolve(realtime.createQuestion(session.id, { title: '이 작품에 제목을 붙인다면?', description: '떠오르는 제목을 적어보세요.', type: 'artwork-title', artworkId: item.id, runId, internal: true }));
    await Promise.resolve(realtime.activateQuestion(session.id, question.id));
    await Promise.resolve(realtime.updateSession(session.id, { stage: { mode: 'artwork', artworkId: item.id, phase: 'collect', runId, questionId: question.id, page: 1, reveal: null, blackout: false }, showResults: false, status: 'live' }));
  };
  const setPhase = (phase) => realtime.updateSession(session.id, { stage: { ...stage, phase, reveal: phase === 'reveal' ? { title: artwork?.title || '', artist: artwork?.artist || '', description: artwork?.description || '' } : null, blackout: false }, showResults: phase !== 'collect' });
  const setPage = (next) => deck && realtime.updateSession(session.id, { stage: { ...stage, page: Math.min(deck.pageCount, Math.max(1, next)), blackout: false } });
  const setView = (patch) => realtime.updateSession(session.id, { stage: { ...stage, ...patch } });

  return <main className="remote-control remote-v2" style={sessionThemeStyle(session)}>
    <header><div><p className="eyebrow">OFFLINE SALON REMOTE</p><h1>{session.title}</h1></div><div className="remote-connection"><span className={online && !sessionError ? 'online' : 'offline'}>● {online && !sessionError ? '연결됨' : '연결 끊김'}</span><button className={awake ? 'active' : ''} onClick={toggleWakeLock}>{awake ? '화면 유지 중' : '화면 켜두기'}</button></div></header>

    <section className="remote-now"><div className="remote-now-title"><div><p className="eyebrow">NOW ON SCREEN</p><h2>{stage.mode === 'pdf' ? 'PDF 발표' : stage.mode === 'artwork' ? stage.phase === 'collect' ? '작품 제목 수집' : stage.phase === 'vote' ? '작품 제목 투표' : '작품 정보 공개' : '일반 질문 화면'}</h2></div><button className={stage.blackout ? 'active' : ''} disabled={busy} onClick={() => run(() => setView({ blackout: !stage.blackout }))}>{stage.blackout ? '다시 표시' : '화면 가리기'}</button></div>
      <div className={`remote-screen-preview ${stage.blackout ? 'blackout' : ''}`}>{stage.blackout ? <strong>화면 가림</strong> : deck ? <PdfPageCanvas url={deck.fileUrl} pageNumber={page} fitMode={stage.fitMode} zoom={stage.zoom} compact /> : artwork ? <img src={artwork.imageUrl} alt="작품" /> : <div><strong>{session.title}</strong><span>질문과 참여 QR 화면</span></div>}</div>
      {artwork ? <div className="remote-live-metric"><strong>{artwork.title || '작품'}</strong><b>{responses.length}<small> TITLES</small></b></div> : null}
      {deck ? <><div className="remote-page-controls"><button disabled={busy || page <= 1} onClick={() => run(() => setPage(page - 1))}>← 이전 장</button><strong>{page} / {deck.pageCount}</strong><button disabled={busy || page >= deck.pageCount} onClick={() => run(() => setPage(page + 1))}>다음 장 →</button></div><div className="remote-view-controls"><button className={stage.fitMode !== 'width' ? 'active' : ''} onClick={() => run(() => setView({ fitMode: 'fit' }))}>화면 맞춤</button><button className={stage.fitMode === 'width' ? 'active' : ''} onClick={() => run(() => setView({ fitMode: 'width' }))}>너비 맞춤</button><button onClick={() => run(() => setView({ zoom: Math.max(.6, Number(stage.zoom || 1) - .1) }))}>−</button><span>{Math.round(Number(stage.zoom || 1) * 100)}%</span><button onClick={() => run(() => setView({ zoom: Math.min(2, Number(stage.zoom || 1) + .1) }))}>＋</button></div><div className="remote-page-strip">{nearbyPages.map((number) => <button className={number === page ? 'active' : ''} key={number} onClick={() => run(() => setPage(number))}><PdfPageCanvas url={deck.fileUrl} pageNumber={number} compact /><span>{number}</span></button>)}</div>{pageLinks.length ? <div className="remote-links"><strong>현재 페이지 링크</strong>{pageLinks.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label || '링크 열기'} ↗</a>)}</div> : null}</> : null}
      {artwork ? <div className="remote-phase-controls"><button disabled={busy} onClick={() => run(() => setPhase('collect'))}>제목 받기</button><button disabled={busy} onClick={() => run(() => setPhase('vote'))}>투표 열기</button><button disabled={busy} onClick={() => run(() => setPhase('reveal'))}>정답 공개</button></div> : null}
      {error || sessionError ? <p className="remote-error">{error || sessionError.message}</p> : busy ? <p className="remote-command-status">명령 적용 중…</p> : <p className="remote-command-status">마지막 동기화 {new Date(session.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
    </section>

    <section className="remote-assets"><div><p className="eyebrow">ARTWORKS</p><h2>작품 선택</h2></div><div className="remote-asset-grid">{artworks.map((item) => <button disabled={busy} key={item.id} onClick={() => run(() => startArtwork(item))}><img src={item.imageUrl} alt={item.title || '작품'} /><span>{item.title || '제목 미정'}</span></button>)}</div></section>
    <section className="remote-assets"><div><p className="eyebrow">PRESENTATIONS</p><h2>PDF 선택</h2></div><div className="remote-asset-grid">{(session.decks || []).map((item) => <button disabled={busy} key={item.id} onClick={() => run(() => realtime.updateSession(session.id, { stage: { mode: 'pdf', deckId: item.id, page: 1, fitMode: 'fit', zoom: 1, blackout: false }, status: 'live' }))}><img src={item.thumbnailUrl} alt={`${item.title} 표지`} /><span>{item.title}</span></button>)}</div></section>
    <footer><button onClick={() => window.open(`${window.location.origin}/host/${session.id}`, '_blank', 'noopener,noreferrer')}>화면 보기</button><button className="remote-home" disabled={busy} onClick={() => run(stop)}>질문 화면</button>{deck ? <button className="remote-next" disabled={busy || page >= deck.pageCount} onClick={() => run(() => setPage(page + 1))}>다음 장 →</button> : <button className="remote-next" disabled={busy} onClick={() => run(stop)}>Live Room</button>}</footer>
  </main>;
}
