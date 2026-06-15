import React, { useState } from 'react';

export default function JoinForm({ session, onJoin, loading, allowNickname = true }) {
  const [nickname, setNickname] = useState('');

  const submit = (event) => {
    event.preventDefault();
    onJoin(allowNickname ? nickname.trim() || '익명' : '익명');
  };

  return (
    <form className="client-panel stack join-form" onSubmit={submit}>
      <div className="stack gap-sm">
        <p className="eyebrow">JOIN SESSION</p>
        <h1>{session?.title || '세션에 참여합니다'}</h1>
        <p className="muted">{session?.description || '현재 질문에 답변해 주세요.'}</p>
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

      <button className="btn primary large-btn join-submit-button" type="submit" disabled={loading}>
        {loading ? '입장 중...' : '다음'}
      </button>
    </form>
  );
}
