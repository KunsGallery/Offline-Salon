export function buildExhibitionNfcUrl(sessionId, entry = {}, origin = '') {
  const base = String(origin || '').replace(/\/$/, '');
  const params = new URLSearchParams({ add: '1', nfc: '1' });
  if (entry.title?.trim()) params.set('title', entry.title.trim());
  if (entry.venue?.trim()) params.set('venue', entry.venue.trim());
  return `${base}/client/${encodeURIComponent(sessionId)}?${params.toString()}`;
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
