import { guardPost, json } from '../lib/http.mjs';
const HOSTS = ['wikipedia.org', 'metmuseum.org', 'artic.edu', 'tate.org.uk', 'moma.org', 'nga.gov', 'rijksmuseum.nl'];
export async function resolveArtworkImage(sourceUrl) {
  let source;
  try { source = new URL(sourceUrl); } catch { return ''; }
  if (source.protocol !== 'https:' || source.port || source.username || source.password
      || !HOSTS.some((host) => source.hostname === host || source.hostname.endsWith(`.${host}`))) return '';
  const response = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { accept: 'text/html' } });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  let bytes = 0;
  try {
    while (bytes < 512 * 1024) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      html += decoder.decode(value, { stream: true });
      if (html.includes('</head>')) break;
    }
  } finally { await reader.cancel(); }
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (!/(?:property|name)\s*=\s*["'](?:og:image|twitter:image)["']/i.test(tag)) continue;
    const content = tag.match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!content) continue;
    const url = new URL(content.replace(/&amp;/g, '&'), source);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  }
  return '';
}
export default async function handler(request) {
  const { origin, response } = guardPost(request, 'R2_ALLOWED_ORIGINS');
  if (response) return response;
  try {
    const { sourceUrl } = await request.json();
    return json(200, { imageUrl: await resolveArtworkImage(sourceUrl) }, origin);
  } catch { return json(200, { imageUrl: '' }, origin); }
}
