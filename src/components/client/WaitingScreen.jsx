import React from 'react';
import SalonAvatar from '../participants/SalonAvatar';

export default function WaitingScreen({ title, message = '앞 화면에서 함께 도착한 사람들을 만나보세요.', avatar, nickname, onEditAvatar }) {
  return (
    <section className="client-panel stack center">
      {avatar ? <SalonAvatar avatar={avatar} label={nickname || '나'} /> : null}
      <h1>{title || '테이블에 자리가 마련됐어요.'}</h1>
      <p className="muted">{message}</p>
      {onEditAvatar ? <button className="participant-avatar-edit-button" type="button" onClick={onEditAvatar}>내 캐릭터 수정</button> : null}
    </section>
  );
}
