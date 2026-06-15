import React, { useMemo, useState } from 'react';
import { realtime } from '../../lib/realtime';
import { formatCompactTime, safeJoin } from '../../lib/format';

export default function ResponseMonitor({ session, responses, activeQuestion }) {
  const [query, setQuery] = useState('');
  const visibleResponses = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return responses.filter((response) => {
      if (!needle) return true;
      return [response.nickname, safeJoin(response.value)].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [query, responses]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>답변 모니터</h2>
          <p className="muted">현재 활성 질문의 응답을 실시간으로 확인합니다.</p>
        </div>
      </div>

      <label className="field">
        <span>검색</span>
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="닉네임 또는 답변 검색" />
      </label>

      <div className="metrics-row">
        <div className="metric">
          <span>총 응답</span>
          <strong>{responses.length}</strong>
        </div>
        <div className="metric">
          <span>숨김</span>
          <strong>{responses.filter((response) => response.hidden).length}</strong>
        </div>
        <div className="metric">
          <span>질문</span>
          <strong>{activeQuestion?.title || '없음'}</strong>
        </div>
      </div>

      <div className="stack">
        {visibleResponses.length === 0 ? (
          <div className="empty-state">
            <h3>표시할 답변이 없습니다.</h3>
            <p className="muted">응답이 들어오면 여기로 나타납니다.</p>
          </div>
        ) : (
          visibleResponses.map((response) => (
            <article className={`response-card ${response.hidden ? 'hidden' : ''}`} key={response.id}>
              <div className="row between gap-sm">
                <div className="stack gap-xs">
                  <div className="row wrap gap-sm align-center">
                    <strong>{response.nickname || '익명'}</strong>
                    <span className="badge">{formatCompactTime(response.createdAt)}</span>
                  </div>
                  <p>{safeJoin(response.value)}</p>
                </div>
                <span className={`badge ${response.hidden ? 'status-ended' : 'status-live'}`}>{response.hidden ? '숨김' : '노출'}</span>
              </div>
              <div className="row wrap gap-sm">
                <button className="btn" onClick={() => realtime.updateResponse(session.id, response.id, { hidden: !response.hidden })}>
                  {response.hidden ? '복원' : '숨김'}
                </button>
                <button className="btn danger" onClick={() => realtime.deleteResponse(session.id, response.id)}>
                  삭제
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
