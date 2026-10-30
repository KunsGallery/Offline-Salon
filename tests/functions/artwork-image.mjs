import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveArtworkImage } from '../../netlify/functions/artwork-image.mjs';

test('only approved source pages are fetched; their HTTPS preview is recovered', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return new Response('<head><meta content="https://images.metmuseum.org/art.jpg?a=1&amp;b=2" property="og:image"></head>', { headers: { 'content-type': 'text/html' } });
  };
  try {
    assert.equal(await resolveArtworkImage('http://127.0.0.1/private'), '');
    assert.equal(await resolveArtworkImage('https://metmuseum.org.evil.example/art'), '');
    assert.equal(calls, 0);
    assert.equal(await resolveArtworkImage('https://www.metmuseum.org/art/collection/search/1'), 'https://images.metmuseum.org/art.jpg?a=1&b=2');
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
