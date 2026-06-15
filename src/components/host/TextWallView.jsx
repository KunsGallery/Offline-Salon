import React from 'react';
import { formatCompactTime, safeJoin } from '../../lib/format';

export default function TextWallView({ responses }) {
  return (
    <section className="visual-panel">
      <div className="panel-header compact">
        <h2>Text Wall</h2>
        <span className="badge">{responses.length} responses</span>
      </div>
      <div className="text-wall">
        {responses.length === 0 ? (
          <p className="muted">새 카드가 여기 쌓입니다.</p>
        ) : (
          responses.map((response) => (
            <article key={response.id} className="text-card">
              <p>{safeJoin(response.value)}</p>
              <footer>
                <span>{response.nickname || '익명'}</span>
                <span>{formatCompactTime(response.createdAt)}</span>
              </footer>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
