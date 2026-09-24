import React, { useEffect, useRef, useState } from 'react';
import QRJoinCard from './QRJoinCard';
import SalonAvatar from '../participants/SalonAvatar';
import { hasSessionModule } from '../../lib/sessionModules';

const LOBBY_SLOTS = [
  [14, 61], [21, 55], [29, 50], [37, 47], [45, 45],
  [55, 45], [63, 47], [71, 50], [79, 55], [86, 61],
  [86, 79], [79, 76], [71, 79], [63, 81], [55, 82],
  [45, 82], [37, 81], [29, 79], [21, 76], [14, 79],
];

const seenBySession = new Map();

export default function LobbyHostView({ session, participants = [], sessionId }) {
  const seated = [...participants].sort((a, b) =>
    String(a.joinedAt || '').localeCompare(String(b.joinedAt || ''))
    || String(a.participantId).localeCompare(String(b.participantId))).slice(0, LOBBY_SLOTS.length);
  const isPearPlay = hasSessionModule(session, 'pear-play');
  const isGrape = hasSessionModule(session, 'exhibition-grape');
  const caseCount = participants.filter((participant) => participant.pearPairing?.photoUrl).length;
  const [arrivingIds, setArrivingIds] = useState([]);
  const seenRef = useRef(null);

  if (!seenRef.current) {
    if (!seenBySession.has(sessionId)) {
      seenBySession.set(sessionId, new Set(seated.map((participant) => participant.participantId)));
    }
    seenRef.current = seenBySession.get(sessionId);
  }

  useEffect(() => {
    const arrivals = seated.map((participant) => participant.participantId)
      .filter((id) => !seenRef.current.has(id));
    if (!arrivals.length) return undefined;
    arrivals.forEach((id) => seenRef.current.add(id));
    setArrivingIds((current) => [...new Set([...current, ...arrivals])]);
    const timer = window.setTimeout(() => {
      setArrivingIds((current) => current.filter((id) => !arrivals.includes(id)));
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [participants]);

  return (
    <section className={`salon-lobby ${isPearPlay ? 'is-pear-play' : isGrape ? 'is-grape' : ''}`} data-testid="salon-lobby">
      <div className="salon-lobby-room">
        <header className="lobby-heading">
          <span>UNFRAME SALON</span>
          <h2>모두의 자리가<br />준비됐어요.</h2>
          <p>휴대폰으로 캐릭터를 만들면 이곳에 자리가 생깁니다.</p>
          <strong>{participants.length}<small>명 자리 등록</small></strong>
        </header>
        <div className="lobby-board-note" aria-live="polite">
          {isPearPlay ? <><span>PEAR PLAY</span><strong>사건 파일 접수 중</strong><small>사진 {caseCount}건 도착</small></>
            : isGrape ? <><span>EXHIBITION GRAPE</span><strong>우리의 전시가 시작됩니다</strong><small>참가자와 함께 채워지는 공간</small></>
              : <><span>SALON</span><strong>{session.title}</strong><small>함께할 사람들을 기다립니다</small></>}
        </div>
        <aside className="lobby-join"><QRJoinCard sessionId={sessionId} title="휴대폰 참여" /></aside>
        <div className="lobby-table" aria-hidden="true"><div className="lobby-table-top"><span>UNFRAME</span><strong>{session.title}</strong></div></div>
        <div className="lobby-people" aria-label={`${seated.length}명 자리 등록`}>
          {LOBBY_SLOTS.map(([x, y], index) => {
            const participant = seated[index];
            return <div className={`lobby-seat ${participant ? 'is-occupied' : ''}`} key={index} style={{ '--person-x': `${x}%`, '--person-y': `${y}%` }}>
              <span className="lobby-chair" aria-hidden="true" />
              {participant ? <div className={`lobby-person ${arrivingIds.includes(participant.participantId) ? 'is-arriving' : ''}`}><SalonAvatar avatar={participant.avatar} label={participant.nickname || '익명'} compact /></div> : null}
            </div>;
          })}
        </div>
        {participants.length > LOBBY_SLOTS.length ? <span className="lobby-overflow">+{participants.length - LOBBY_SLOTS.length}명 자리 등록</span> : null}
      </div>
    </section>
  );
}
