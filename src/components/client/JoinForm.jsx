import React, { useState } from 'react';
import SalonAvatar, { AVATAR_COLORS, AVATAR_SHAPES, DEFAULT_AVATAR } from '../participants/SalonAvatar';

export default function JoinForm({ session, onJoin, loading, allowNickname = true }) {
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState(DEFAULT_AVATAR);
  const canJoin = allowNickname ? Boolean(nickname.trim()) : true;

  const submit = (event) => {
    event.preventDefault();
    onJoin(allowNickname ? nickname.trim() || '익명' : '익명', avatar);
  };

  return (
    <form className="client-panel stack join-form" onSubmit={submit}>
      <div className="stack gap-sm">
        <h1>{session?.title || '세션에 참여합니다'}</h1>
        <p className="muted">닉네임과 캐릭터를 만들고 테이블에 함께 앉아주세요.</p>
      </div>

      {allowNickname ? (
        <label className="field">
          <span>닉네임</span>
          <input
            className="input large"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="관객 이름"
            autoComplete="nickname"
          />
        </label>
      ) : (
        <p className="muted">이 세션은 닉네임 없이 참여할 수 있습니다.</p>
      )}

      <fieldset className="avatar-builder">
        <legend>내 캐릭터</legend>
        <div className="avatar-builder-preview"><SalonAvatar avatar={avatar} label={nickname.trim() || '나'} /></div>
        <div className="avatar-choice-row" aria-label="캐릭터 모양">{AVATAR_SHAPES.map((shape) => <button type="button" aria-pressed={avatar.shape === shape.id} className={avatar.shape === shape.id ? 'active' : ''} key={shape.id} onClick={() => setAvatar((current) => ({ ...current, shape: shape.id }))}>{shape.label}</button>)}</div>
        <div className="avatar-color-row" aria-label="캐릭터 색상">{AVATAR_COLORS.map((color) => <button type="button" aria-pressed={avatar.color === color.id} className={avatar.color === color.id ? 'active' : ''} key={color.id} onClick={() => setAvatar((current) => ({ ...current, color: color.id }))} aria-label={color.label} style={{ '--swatch': color.value }} />)}</div>
      </fieldset>

      <button className="client-primary-button join-submit-button" type="submit" disabled={loading || !canJoin}>
        {loading ? '자리 준비 중…' : '이 캐릭터로 입장'}
      </button>
    </form>
  );
}
