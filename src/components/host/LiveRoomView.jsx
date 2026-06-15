import React, { useMemo } from 'react';
import ParticipantAvatar from './ParticipantAvatar';
import ResponseNote from './ResponseNote';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildRingLayout(items, radiusX, radiusY, offset = -Math.PI / 2) {
  const total = items.length || 1;
  return items.map((item, index) => {
    const angle = offset + (index / total) * Math.PI * 2;
    const x = Math.cos(angle) * radiusX;
    const y = Math.sin(angle) * radiusY;
    return {
      ...item,
      style: {
        '--ring-x': `${x}px`,
        '--ring-y': `${y}px`,
        '--ring-rotate': `${Math.round((index / total) * 16) - 8}deg`,
      },
    };
  });
}

export default function LiveRoomView({ question, responses = [], participants = [], session, likeEffects = [] }) {
  const activeResponses = useMemo(() => responses.filter((response) => response.hidden !== true), [responses]);
  const responseDeck = useMemo(() => {
    const sorted = [...activeResponses].sort((a, b) => {
      const updatedDiff = new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      if (updatedDiff !== 0) return updatedDiff;
      return (b.likes || 0) - (a.likes || 0);
    });
    return buildRingLayout(sorted.slice(0, 10), 280, 160);
  }, [activeResponses]);
  const avatarRing = useMemo(() => buildRingLayout(participants.slice(0, 8), 340, 210, -Math.PI / 3), [participants]);
  const totalLikes = activeResponses.reduce((sum, response) => sum + (response.likes || 0), 0);
  const overflowCount = Math.max(0, activeResponses.length - responseDeck.length);

  const noteEffects = useMemo(
    () =>
      likeEffects.reduce((accumulator, effect) => {
        accumulator[effect.responseId] = accumulator[effect.responseId] || [];
        accumulator[effect.responseId].push(effect);
        return accumulator;
      }, {}),
    [likeEffects],
  );

  return (
    <section className="live-room panel">
      <header className="live-room-header">
        <div className="stack gap-xs">
          <p className="eyebrow">UNFRAME LIVE ROOM</p>
          <h2>{question?.title || session?.title || '질문을 준비 중입니다.'}</h2>
          <p className="muted">
            {question?.description || '관리자가 질문을 활성화하면 메모와 좋아요가 테이블 위로 올라옵니다.'}
          </p>
        </div>
        <div className="row wrap gap-sm live-room-stats">
          <span className="badge">응답 {activeResponses.length}</span>
          <span className="badge">좋아요 {totalLikes}</span>
          <span className="badge">참여자 {participants.length}</span>
          <span className={`badge status-${session?.status || 'draft'}`}>{session?.status || 'draft'}</span>
        </div>
      </header>

      <div className="live-room-stage">
        <div className="room-glow room-glow-a" />
        <div className="room-glow room-glow-b" />
        <div className="table-shadow" />

        <div className="room-table">
          <div className="room-table-core">
            <p className="table-kicker">Conversation Table</p>
            <h3>{session?.title || '테이블 중심의 살롱'}</h3>
            <p className="muted">
              {question
                ? '참여자들의 조각이 테이블 위에 놓이고, 좋아요가 들어오면 살짝 반짝입니다.'
                : '질문이 시작되면 이 자리로 메모가 모입니다.'}
            </p>
          </div>
        </div>

        <div className="avatar-ring" aria-hidden="true">
          {avatarRing.length === 0 ? (
            <div className="empty-chair-row">
              {Array.from({ length: 4 }, (_, index) => (
                <span key={index} className="empty-chair" />
              ))}
            </div>
          ) : (
            avatarRing.map((participant, index) => (
              <div key={participant.participantId} className="ring-item avatar-item" style={participant.style}>
                <ParticipantAvatar participant={participant} index={index} />
              </div>
            ))
          )}
        </div>

        <div className="note-ring">
          {responseDeck.length === 0 ? (
            <div className="response-empty">
              <p className="eyebrow">MEMO BOARD</p>
              <h3>첫 답변이 올라오면 여기서 살아납니다.</h3>
              <p className="muted">참여자들의 짧은 메모가 테이블 주변에 쌓입니다.</p>
            </div>
          ) : (
            responseDeck.map((response, index) => (
              <div key={response.id} className="ring-item note-item" style={response.style}>
                <ResponseNote
                  response={response}
                  participantId={null}
                  burstCount={noteEffects[response.id]?.reduce((sum, effect) => sum + effect.burstCount, 0) || 0}
                  emphasis={index === 0}
                />
              </div>
            ))
          )}
        </div>
      </div>

      {overflowCount > 0 ? (
        <p className="tiny muted">
          추가 메모 {clamp(overflowCount, 0, 99)}개는 최신 순으로 정리됩니다.
        </p>
      ) : null}
    </section>
  );
}
