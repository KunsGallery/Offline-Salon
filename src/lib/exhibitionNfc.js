export function buildExhibitionNfcUrl(sessionId, entry = {}, origin = '') {
  const base = String(origin || '').replace(/\/$/, '');
  const entryId = String(entry.id || '').trim();
  const params = entryId
    ? new URLSearchParams({ n: entryId })
    : new URLSearchParams({ add: '1', nfc: '1' });
  // Keep supporting old/manual links that contain their prefill data directly.
  if (!entryId && entry.title?.trim()) params.set('title', entry.title.trim());
  if (!entryId && entry.venue?.trim()) params.set('venue', entry.venue.trim());
  return `${base}/client/${encodeURIComponent(sessionId)}?${params.toString()}`;
}

export function createExhibitionNfcId(existingEntries = []) {
  const existingIds = new Set(existingEntries.map((entry) => String(entry?.id || '')));
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const seed = globalThis.crypto?.randomUUID?.().replaceAll('-', '') || Math.random().toString(36).slice(2);
    const id = seed.slice(0, 8);
    if (id.length >= 6 && !existingIds.has(id)) return id;
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.slice(-8);
}

export function exhibitionNfcUrlBytes(url) {
  return new TextEncoder().encode(String(url || '')).length;
}

export function normalizeExhibitionNfcEntries(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((entry, index) => ({
    id: String(entry.id || `nfc-${index}`),
    title: String(entry.title || '').trim(),
    venue: String(entry.venue || '').trim(),
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
  })).filter((entry) => entry.title);
}
