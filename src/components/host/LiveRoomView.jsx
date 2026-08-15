import React, { useMemo } from 'react';
import QRJoinCard from './QRJoinCard';
import LikeBurst from './LikeBurst';
import { formatCompactTime, safeJoin } from '../../lib/format';

const MAX_VISIBLE_SEATS = 10;

const SLOT_SETS = {
  1: [{ x: 50, y: 83, rotate: 0 }],
  2: [{ x: 28, y: 79, rotate: -2 }, { x: 72, y: 79, rotate: 2 }],
  3: [{ x: 15, y: 55, rotate: -2 }, { x: 85, y: 55, rotate: 2 }, { x: 50, y: 84, rotate: 0 }],
  4: [{ x: 18, y: 34, rotate: -2 }, { x: 82, y: 34, rotate: 2 }, { x: 27, y: 81, rotate: 2 }, { x: 73, y: 81, rotate: -2 }],
  5: [{ x: 17, y: 32, rotate: -2 }, { x: 83, y: 32, rotate: 2 }, { x: 13, y: 72, rotate: 2 }, { x: 50, y: 86, rotate: 0 }, { x: 87, y: 72, rotate: -2 }],
};

const DEFAULT_SLOTS = [
  { x: 18, y: 20, rotate: -2 },
  { x: 50, y: 14, rotate: 0 },
  { x: 82, y: 20, rotate: 2 },
  { x: 12, y: 48, rotate: -1 },
  { x: 88, y: 48, rotate: 1 },
  { x: 13, y: 73, rotate: 2 },
  { x: 87, y: 73, rotate: -2 },
  { x: 27, y: 87, rotate: 2 },
  { x: 50, y: 90, rotate: 0 },
  { x: 73, y: 87, rotate: -2 },
];

function getCreatedTime(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function getParticipant(response, participants) {
  return participants.find((item) => String(item.id || item.participantId) === String(response.participantId)) || null;
}

function getInitial(value) {
  return String(value || '익').trim().charAt(0).toUpperCase() || '익';
}

export default function LiveRoomView({ question, responses = [], participants = [], session, sessionId, likeEffects = [] }) {
  const stableResponses = useMemo(
    () => [...responses]
      .filter((response) => response.hidden !== true)
      .sort((a, b) => getCreatedTime(a.createdAt) - getCreatedTime(b.createdAt) || String(a.id).localeCompare(String(b.id))),
    [responses],
  );
  const featuredResponses = useMemo(() => stableResponses.slice(-MAX_VISIBLE_SEATS), [stableResponses]);
  const slots = SLOT_SETS[featuredResponses.length] || DEFAULT_SLOTS;
  const likesEnabled = question?.likesEnabled === true;
  const totalLikes = likesEnabled ? stableResponses.reduce((sum, response) => sum + Number(response.likes || 0), 0) : 0;
  const hiddenCount = Math.max(0, stableResponses.length - featuredResponses.length);
  const activeLikeIds = useMemo(() => new Set(likeEffects.map((effect) => effect.responseId)), [likeEffects]);
  const burstById = useMemo(() => likeEffects.reduce((result, effect) => {
    result[effect.responseId] = (result[effect.responseId] || 0) + (effect.burstCount || 1);
    return result;
  }, {}), [likeEffects]);

  return (
    <section className="salon-roundtable" data-testid="salon-roundtable">
      <header className="salon-roundtable-intro">
        <div>
          <p className="eyebrow">OPEN CONVERSATION · LIVE</p>
          <p className="salon-roundtable-description">
            {question?.description || '질문이 시작되면 참여자들의 생각이 테이블 둘레에 모입니다.'}
          </p>
        </div>
        <div className="salon-roundtable-metrics" aria-label="실시간 참여 현황">
          <span><b>{participants.length}</b> people</span>
          <span><b>{stableResponses.length}</b> answers</span>
          {likesEnabled ? <span><b>{totalLikes}</b> hearts</span> : null}
        </div>
      </header>

      <div className="salon-roundtable-stage">
        <div className="salon-room-light salon-room-light-left" />
        <div className="salon-room-light salon-room-light-right" />
        <div className="salon-table-shadow" />
        <div className="salon-table" aria-label="오늘의 질문">
          <div className="salon-table-inlay">
            <span>QUESTION ON THE TABLE</span>
            <h2>{question?.title || session?.title || '질문을 준비하고 있습니다.'}</h2>
            <i aria-hidden="true" />
            <p>{stableResponses.length ? `${stableResponses.length}개의 생각이 한자리에 모였습니다.` : '첫 번째 이야기를 기다리고 있습니다.'}</p>
          </div>
        </div>

        <div className="salon-seat-layer">
          {featuredResponses.map((response, index) => {
            const slot = slots[index] || DEFAULT_SLOTS[index];
            const participant = getParticipant(response, participants);
            const nickname = participant?.nickname || response.nickname || '익명';
            const likes = likesEnabled ? Number(response.likes || 0) : 0;
            const highlighted = likesEnabled && activeLikeIds.has(response.id);
            return (
              <article
                className={`salon-seat ${highlighted ? 'is-liked-now' : ''} ${likes >= 3 ? 'is-popular' : ''}`}
                key={response.id}
                style={{
                  '--seat-x': `${slot.x}%`,
                  '--seat-y': `${slot.y}%`,
                  '--seat-rotate': `${slot.rotate}deg`,
                  '--seat-delay': `${Math.min(index * 55, 360)}ms`,
                }}
              >
                {likesEnabled && burstById[response.id] ? <LikeBurst count={burstById[response.id]} /> : null}
                <header>
                  <span className="salon-seat-avatar">{getInitial(nickname)}</span>
                  <div><strong>{nickname}</strong><small>{formatCompactTime(response.createdAt)}</small></div>
                  {likesEnabled ? <b className="salon-seat-likes">♥ {likes}</b> : null}
                </header>
                <p>{safeJoin(response.value)}</p>
                <footer><span>SEAT {String(index + 1).padStart(2, '0')}</span><i /></footer>
              </article>
            );
          })}
        </div>

        {featuredResponses.length === 0 ? (
          <div className="salon-empty-seat">
            <span>01</span>
            <div><strong>첫 번째 자리가 비어 있어요.</strong><p>QR을 스캔하고 이야기를 시작해 주세요.</p></div>
          </div>
        ) : null}

        <aside className="salon-join-card">
          <QRJoinCard sessionId={sessionId} title="SCAN TO JOIN" />
          <span>salon.unframe.kr</span>
        </aside>

        {hiddenCount > 0 ? <div className="salon-overflow-count">+ {hiddenCount}개의 이전 답변</div> : null}
      </div>
    </section>
  );
}
