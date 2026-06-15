const WORD_SPLIT = /[\s,./\\|_-]+/g;

export function buildWordCloudEntries(responses) {
  const counts = new Map();

  responses.forEach((response) => {
    const raw = typeof response.value === 'string' ? response.value : Array.isArray(response.value) ? response.value.join(' ') : '';
    raw
      .split(WORD_SPLIT)
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => {
        const normalized = token.toLowerCase();
        counts.set(normalized, (counts.get(normalized) || 0) + 1);
      });
  });

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

export function clampWordSize(count, maxCount) {
  if (!maxCount) return 16;
  return Math.round(14 + (count / maxCount) * 24);
}
