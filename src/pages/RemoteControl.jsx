import React from 'react';
import { useParams } from 'react-router-dom';
import { realtime } from '../lib/realtime';
import { useSession } from '../hooks/useSession';
import { useResponses } from '../hooks/useResponses';
import { sessionThemeStyle } from '../lib/colorPalette';

export default function RemoteControl() {
  const { sessionId } = useParams();
  const { session, loading } = useSession(sessionId);
  const { responses } = useResponses(sessionId, session?.stage?.questionId || session?.currentQuestionId || null);
  if (loading || session === undefined) return <main className="remote-control center-screen"><h1>리모컨 연결 중…</h1></main>;
  if (!session) return <main className="remote-control center-screen"><h1>세션을 찾을 수 없습니다.</h1></main>;
  const stage = session.stage || { mode: 'questions' };
  const artwork = (session.artworks || []).find((item) => item.id === stage.artworkId);
  const deck = (session.decks || []).find((item) => item.id === stage.deckId);
  const page = Math.max(1, Number(stage.page || 1));
  const stop = () => realtime.updateSession(session.id, { stage: { mode: 'questions', page: 1 } });
  const startArtwork = async (item) => {
    const runId = `run_${Date.now().toString(36)}`;
    const question = await Promise.resolve(realtime.createQuestion(session.id, { title: '이 작품에 제목을 붙인다면?', description: '떠오르는 제목을 적어보세요.', type: 'artwork-title', artworkId: item.id, runId, internal: true }));
    await Promise.resolve(realtime.activateQuestion(session.id, question.id));
    await Promise.resolve(realtime.updateSession(session.id, { stage: { mode: 'artwork', artworkId: item.id, phase: 'collect', runId, questionId: question.id, page: 1 }, showResults: false, status: 'live' }));
  };
  return <main className="remote-control" style={sessionThemeStyle(session)}><header><div><p className="eyebrow">OFFLINE SALON REMOTE</p><h1>{session.title}</h1></div><span className="badge">● LIVE</span></header><section className="remote-now"><p className="eyebrow">NOW ON SCREEN</p><h2>{stage.mode === 'pdf' ? 'PDF 발표 중' : stage.mode === 'artwork' ? stage.phase === 'collect' ? '작품 제목 수집' : stage.phase === 'vote' ? '작품 제목 투표' : '작품 정보 공개' : '일반 질문 화면'}</h2>{deck ? <div className="remote-current"><img src={deck.thumbnailUrl} alt="PDF 표지" /><div><strong>{deck.title}</strong><b>{page} / {deck.pageCount}</b></div></div> : artwork ? <div className="remote-current"><img src={artwork.imageUrl} alt="작품" /><div><strong>{artwork.title || '작품'}</strong><b>{responses.length} titles</b></div></div> : <p className="muted">현재 활성 질문과 참여 QR이 표시됩니다.</p>}{stage.mode === 'pdf' && deck ? <div className="remote-page-controls"><button disabled={page <= 1} onClick={() => realtime.updateSession(session.id, { stage: { ...stage, page: page - 1 } })}>← 이전 장</button><strong>{page} / {deck.pageCount}</strong><button disabled={page >= deck.pageCount} onClick={() => realtime.updateSession(session.id, { stage: { ...stage, page: page + 1 } })}>다음 장 →</button></div> : null}{stage.mode === 'artwork' && artwork ? <div className="remote-phase-controls"><button onClick={() => realtime.updateSession(session.id, { stage: { ...stage, phase: 'collect' }, showResults: false })}>제목 받기</button><button onClick={() => realtime.updateSession(session.id, { stage: { ...stage, phase: 'vote' }, showResults: true })}>투표 열기</button><button onClick={() => realtime.updateSession(session.id, { stage: { ...stage, phase: 'reveal' }, showResults: true })}>정답 공개</button></div> : null}</section><section className="remote-assets"><div><p className="eyebrow">ARTWORKS</p><h2>작품 선택</h2></div><div className="remote-asset-grid">{(session.artworks || []).map((item) => <button key={item.id} onClick={() => startArtwork(item)}><img src={item.imageUrl} alt={item.title || '작품'} /><span>{item.title || '제목 미정'}</span></button>)}</div></section><section className="remote-assets"><div><p className="eyebrow">PRESENTATIONS</p><h2>PDF 선택</h2></div><div className="remote-asset-grid">{(session.decks || []).map((item) => <button key={item.id} onClick={() => realtime.updateSession(session.id, { stage: { mode: 'pdf', deckId: item.id, page: 1 }, status: 'live' })}><img src={item.thumbnailUrl} alt={`${item.title} 표지`} /><span>{item.title}</span></button>)}</div></section><footer><button onClick={() => window.open(`${window.location.origin}/host/${session.id}`, '_blank')}>화면 보기</button><button className="remote-home" onClick={stop}>질문 화면</button>{stage.mode === 'pdf' && deck ? <button className="remote-next" disabled={page >= deck.pageCount} onClick={() => realtime.updateSession(session.id, { stage: { ...stage, page: page + 1 } })}>다음 장 →</button> : <button className="remote-next" onClick={stop}>Live Room</button>}</footer></main>;
}
