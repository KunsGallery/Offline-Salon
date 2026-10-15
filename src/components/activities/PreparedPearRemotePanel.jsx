import React from 'react';
import { realtime } from '../../lib/realtime';
import { preparedPearCase, preparedPearStatus } from '../../lib/pearPrepared';

export default function PreparedPearRemotePanel({ session, busy, run }) {
  const items = session.pearPreparedCases || [];
  const stage = session.stage || {};
  const selected = preparedPearCase(session);
  const onScreen = stage.mode === 'pear-play' && stage.pearView === 'case' && selected;
  const updateStage = (patch) => realtime.updateSession(session.id, { currentQuestionId: null, status: 'live', stage: { ...stage, mode: 'pear-play', pearParticipantId: null, blackout: false, ...patch } });
  if (!items.length) return null;
  return <section className="prepared-pear-remote" aria-label="사전 조사 역추리">
    <div className="pear-list-heading"><h3>사전 조사 · 역추리</h3><span>{items.length}건</span></div>
    {onScreen ? <div className="pear-next-step">
      <p className="prepared-pear-onair">{stage.pearPhase === 'artwork-only' ? '작품만 공개 중' : stage.pearPhase === 'connection' ? '연결 이유 공개 중' : '원본 사진과 작품 공개 중'}</p>
      <button className="pear-primary-action" type="button" disabled={busy} onClick={() => run(() => updateStage({ pearPhase: stage.pearPhase === 'artwork-only' ? 'revealed' : stage.pearPhase === 'connection' ? 'artwork-only' : 'connection' }))}>{stage.pearPhase === 'artwork-only' ? '원본 사진 공개' : stage.pearPhase === 'connection' ? '작품만 다시 보기' : '연결 이유 보기'}</button>
      {stage.pearPhase === 'revealed' ? <button className="pear-secondary-action" type="button" disabled={busy} onClick={() => run(() => updateStage({ pearPhase: 'artwork-only' }))}>작품만 다시 보기</button> : null}
      <button className="pear-secondary-action" type="button" disabled={busy} onClick={() => run(() => updateStage({ pearPreparedCaseId: null, pearView: 'wall', pearPhase: 'photo' }))}>전체 코르크 보드로</button>
    </div> : null}
    <div className="pear-remote-people">{items.map((item, index) => {
      const ready = item.pearPairing?.status === 'ready' && item.pearPairing.finalArtwork?.imageUrl;
      return <button type="button" key={item.id} className={onScreen && selected.id === item.id ? 'active' : ''} disabled={busy || !ready} onClick={() => run(() => updateStage({ pearPreparedCaseId: item.id, pearView: 'case', pearPhase: 'artwork-only' }), `사전 사건 ${index + 1}의 작품만 공개했습니다.`)}>
        <img className="pear-list-photo" src={item.pearPairing?.finalArtwork?.imageUrl || item.pearPairing?.photoUrl} alt="" /><span><strong>사건 {index + 1} · {item.title}</strong><small>{preparedPearStatus(item)}</small></span>
      </button>;
    })}</div>
  </section>;
}
