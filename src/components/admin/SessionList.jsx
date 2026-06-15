import React, { useMemo, useState } from 'react';
import { realtime } from '../../lib/realtime';
import { formatDateTime } from '../../lib/format';

export default function SessionList({ sessions, onOpen }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const sortedSessions = useMemo(() => sessions || [], [sessions]);

  const handleCreate = async (event) => {
    event.preventDefault();
    const next = await Promise.resolve(
      realtime.createSession({
        title: title.trim() || '새 세션',
        description: description.trim() || '실시간 인터랙티브 세션',
      }),
    );
    setTitle('');
    setDescription('');
    onOpen(next.id);
  };

  const confirmDelete = (sessionId, sessionTitle) => {
    const ok = window.confirm(`세션 "${sessionTitle}"을 삭제할까요? 이 작업은 되돌릴 수 없습니다.`);
    if (ok) {
      realtime.deleteSession(sessionId);
    }
  };

  return (
    <div className="stack gap-xl">
      <section className="hero panel">
        <div className="hero-copy">
          <p className="eyebrow">Interactive Studio Pro</p>
          <h1>세션을 만들고, 질문을 띄우고, 관객 반응을 바로 받습니다.</h1>
          <p className="muted">
            관리자 패널, 호스트 디스플레이, 모바일 참여 앱이 하나의 실시간 세션으로 연결됩니다.
          </p>
        </div>

        <form className="stack" onSubmit={handleCreate}>
          <label className="field">
            <span>세션 제목</span>
            <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예: UNFRAME 6월 살롱" />
          </label>
          <label className="field">
            <span>설명</span>
            <textarea
              className="textarea"
              rows="3"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="세션의 목적이나 간단한 메모"
            />
          </label>
          <button className="btn primary" type="submit">
            새 세션 만들기
          </button>
        </form>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>세션 목록</h2>
            <p className="muted">기존 세션을 다시 열거나 제목을 수정할 수 있습니다.</p>
          </div>
        </div>

        <div className="session-list">
          {sortedSessions.length === 0 ? (
            <div className="empty-state">
              <h3>아직 세션이 없습니다.</h3>
              <p className="muted">첫 번째 세션을 만들어 시작해 보세요.</p>
            </div>
          ) : (
            sortedSessions.map((session) => (
              <article className="session-item" key={session.id}>
                <div>
                  <div className="row align-center gap-sm">
                    <input
                      className="input session-title-input"
                      value={session.title}
                      onChange={(event) => realtime.updateSession(session.id, { title: event.target.value })}
                    />
                    <span className={`badge status-${session.status}`}>{session.status}</span>
                  </div>
                  <p className="muted">{session.description}</p>
                  <p className="tiny muted">업데이트 {formatDateTime(session.updatedAt)}</p>
                </div>

                <div className="row wrap gap-sm">
                  <button type="button" className="btn" onClick={() => onOpen(session.id)}>
                    열기
                  </button>
                  <button type="button" className="btn ghost" onClick={() => confirmDelete(session.id, session.title)}>
                    삭제
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
