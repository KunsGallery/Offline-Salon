import React from 'react';
import { buildWordCloudEntries, clampWordSize } from '../../lib/wordcloud';

export default function WordCloudView({ responses }) {
  const entries = buildWordCloudEntries(responses);
  const maxCount = entries[0]?.count || 0;

  return (
    <section className="visual-panel">
      <div className="panel-header compact">
        <h2>Word Cloud</h2>
        <span className="badge">{entries.length} words</span>
      </div>
      <div className="word-cloud">
        {entries.length === 0 ? (
          <p className="muted">응답이 들어오면 단어가 커집니다.</p>
        ) : (
          entries.map((entry) => (
            <span key={entry.word} style={{ fontSize: `${clampWordSize(entry.count, maxCount)}px` }} className="word-pill">
              {entry.word}
            </span>
          ))
        )}
      </div>
    </section>
  );
}
