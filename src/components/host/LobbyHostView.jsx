import React from 'react';
import QRJoinCard from './QRJoinCard';
import SalonAvatar from '../participants/SalonAvatar';

const LOBBY_SLOTS = [
  [50, 10], [70, 14], [86, 29], [89, 55], [78, 78], [57, 88],
  [35, 87], [15, 73], [10, 48], [17, 24], [34, 13], [50, 91],
];

export default function LobbyHostView({ session, participants = [], sessionId }) {
  const seated = participants.slice(0, LOBBY_SLOTS.length);
  return (
    <section className="salon-lobby" data-testid="salon-lobby">
      <header><div><h2>어서 오세요. 자리를 골라 앉아주세요.</h2><p>휴대폰에서 닉네임과 캐릭터를 만들면 이 테이블에 함께 앉게 됩니다.</p></div><strong>{participants.length}<span>명 입장</span></strong></header>
      <div className="salon-lobby-room">
        <div className="lobby-table"><div><span>{session.title}</span><h1>우리의 자리가<br />하나씩 채워지고 있어요.</h1><p>{seated.length ? `${seated.length}명이 먼저 도착했습니다.` : '첫 번째 손님을 기다리고 있습니다.'}</p></div></div>
        <div className="lobby-people">
          {seated.map((participant, index) => <div className="lobby-person" key={participant.participantId} style={{ '--person-x': `${LOBBY_SLOTS[index][0]}%`, '--person-y': `${LOBBY_SLOTS[index][1]}%`, '--person-delay': `${index * 70}ms` }}><SalonAvatar avatar={participant.avatar} label={participant.nickname || '익명'} compact /></div>)}
        </div>
        <aside className="lobby-join"><QRJoinCard sessionId={sessionId} title="QR을 찍고 자리에 앉기" /></aside>
        {participants.length > LOBBY_SLOTS.length ? <span className="lobby-overflow">+{participants.length - LOBBY_SLOTS.length}명도 함께 있어요</span> : null}
      </div>
    </section>
  );
}
