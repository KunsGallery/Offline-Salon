import React from 'react';

export default function PollChartView({ options, counts }) {
  const total = counts.reduce((sum, count) => sum + count, 0) || 1;
  const rows = options.map((option) => ({
    label: option,
    count: counts[option] || 0,
    percent: Math.round(((counts[option] || 0) / total) * 100),
  }));

  return (
    <section className="visual-panel">
      <div className="panel-header compact">
        <h2>Poll Results</h2>
        <span className="badge">{total} votes</span>
      </div>
      <div className="poll-list">
        {rows.map((row) => (
          <div key={row.label} className="poll-row">
            <div className="row between gap-sm">
              <strong>{row.label}</strong>
              <span className="muted">{row.count} / {row.percent}%</span>
            </div>
            <div className="poll-track">
              <div className="poll-fill" style={{ width: `${row.percent}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
