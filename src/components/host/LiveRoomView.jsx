import React, { useMemo } from 'react';
import ParticipantAvatar from './ParticipantAvatar';
import ResponseNote from './ResponseNote';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const ROOM_SLOTS_BY_COUNT = {
  1: [{ x: 50, y: 66 }],
  2: [
    { x: 36, y: 58 },
    { x: 64, y: 58 },
  ],
  3: [
    { x: 32, y: 58 },
    { x: 68, y: 58 },
    { x: 50, y: 74 },
  ],
  4: [
    { x: 28, y: 54 },
    { x: 72, y: 54 },
    { x: 38, y: 74 },
    { x: 62, y: 74 },
  ],
};

const ROOM_SLOTS_DEFAULT = [
  { x: 28, y: 54 },
  { x: 72, y: 54 },
  { x: 38, y: 74 },
  { x: 62, y: 74 },
  { x: 20, y: 66 },
  { x: 80, y: 66 },
  { x: 34, y: 42 },
  { x: 66, y: 42 },
  { x: 50, y: 82 },
  { x: 50, y: 46 },
];

function getResponseParticipant(response, participants) {
  const participant = participants.find(
    (item) => String(item.id || item.participantId) === String(response.participantId),
  );

  return (
    participant || {
      participantId: response.participantId,
      nickname: response.nickname || '익명',
    }
  );
}

function getCreatedTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

export default function LiveRoomView({ question, responses = [], participants = [], session, likeEffects = [] }) {
  const visibleResponses = useMemo(() => [...responses].filter((response) => response.hidden !== true), [responses]);
  const stableResponses = useMemo(
    () =>
      [...visibleResponses].sort(
        (a, b) => getCreatedTime(a.createdAt) - getCreatedTime(b.createdAt) || String(a.id).localeCompare(String(b.id)),
      ),
    [visibleResponses],
  );
  const slots = useMemo(() => ROOM_SLOTS_BY_COUNT[stableResponses.length] || ROOM_SLOTS_DEFAULT, [stableResponses.length]);
  const positionedResponses = useMemo(
    () =>
      stableResponses.map((response, index) => ({
        response,
        slot: slots[index % slots.length],
        participant: getResponseParticipant(response, participants),
      })),
    [participants, slots, stableResponses],
  );
  const totalLikes = stableResponses.reduce((sum, response) => sum + (response.likes || 0), 0);
  const overflowCount = Math.max(0, stableResponses.length - slots.length);
  const activeLikeIds = useMemo(() => new Set(likeEffects.map((effect) => effect.responseId)), [likeEffects]);
  const latestLikeTokenById = useMemo(
    () =>
      likeEffects.reduce((accumulator, effect) => {
        accumulator[effect.responseId] = effect.token;
        return accumulator;
      }, {}),
    [likeEffects],
  );
  const burstById = useMemo(
    () =>
      likeEffects.reduce((accumulator, effect) => {
        accumulator[effect.responseId] = accumulator[effect.responseId] || 0;
        accumulator[effect.responseId] += effect.burstCount || 1;
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
          <span className="badge">응답 {stableResponses.length}</span>
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

        <div className="note-ring">
          {positionedResponses.length === 0 ? (
            <div className="response-empty">
              <p className="eyebrow">MEMO BOARD</p>
              <h3>첫 답변이 올라오면 여기서 살아납니다.</h3>
              <p className="muted">참여자들의 짧은 메모가 테이블 주변에 쌓입니다.</p>
            </div>
          ) : (
            positionedResponses.map(({ response, slot, participant }, index) => {
              const displayNickname = participant.nickname || participant.name || response.nickname || '익명';
              const reactionToken = latestLikeTokenById[response.id] || 'stable';
              return (
                <div
                  key={`${response.id}:${reactionToken}`}
                  className="live-room-seat seat-cluster note-slot-item"
                  style={{
                    '--slot-x': `${slot.x}%`,
                    '--slot-y': `${slot.y}%`,
                    '--slot-rotate': `${((slot.x + slot.y) % 12) - 6}deg`,
                  }}
                >
                  <ResponseNote
                    response={response}
                    participantId={participant.participantId || response.participantId || null}
                    nickname={displayNickname}
                    burstCount={burstById[response.id] || 0}
                    emphasis={false}
                    highlighted={activeLikeIds.has(response.id)}
                    popular={(response.likes || 0) >= 3}
                    reactionToken={reactionToken}
                  />
                  <div className="seat-cluster-person">
                    <ParticipantAvatar
                      participant={participant}
                      nickname={displayNickname}
                      participantId={participant.participantId || response.participantId || ''}
                      index={index}
                    />
                    <div className="seat-cluster-line" aria-hidden="true" />
                  </div>
                </div>
              );
            })
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
