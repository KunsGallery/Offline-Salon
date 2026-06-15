import React from 'react';

export default function RankingView({ options, counts }) {
  const sorted = options
    .map((label) => ({ label, count: counts[label] || 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const total = sorted.reduce((sum, item) => sum + item.count, 0) || 1;

  return (
    <section className="visual-panel">
      <div className="panel-header compact">
        <h2>Ranking</h2>
        <span className="badge">Top choices</span>
      </div>
      <div className="ranking-list">
        {sorted.map((item, index) => (
          <div key={item.label} className={`ranking-row ${index === 0 ? 'winner' : ''}`}>
            <div className="ranking-index">{index + 1}</div>
            <div className="ranking-body">
              <div className="row between gap-sm">
                <strong>{item.label}</strong>
                <span className="muted">
                  {item.count} votes · {Math.round((item.count / total) * 100)}%
                </span>
              </div>
              <div className="poll-track">
                <div className="poll-fill" style={{ width: `${Math.max(8, Math.round((item.count / total) * 100))}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
