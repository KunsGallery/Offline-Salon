import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

async function prepare(page, options) {
  return page.evaluate(async ({ bytes, type = '', name = 'photo', large = false, fallback = false }) => {
    const { prepareParticipantPhoto } = await import('/src/lib/participantPhoto.js');
    let parts = [new Uint8Array(bytes || [])];
    if (large) {
      const canvas = document.createElement('canvas');
      canvas.width = 6000; canvas.height = 4000;
      canvas.getContext('2d').fillRect(0, 0, 6000, 4000);
      parts = [await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg'))];
      canvas.width = canvas.height = 0;
    }
    if (fallback) {
      const create = URL.createObjectURL.bind(URL);
      let first = true;
      URL.createObjectURL = (blob) => {
        if (first) { first = false; return create(new Blob(['invalid'])); }
        return create(blob);
      };
    }
    const photo = await prepareParticipantPhoto(new File(parts, name, { type }));
    const decoded = await createImageBitmap(photo);
    const result = { type: photo.type, size: photo.size, width: decoded.width, height: decoded.height };
    decoded.close();
    return result;
  }, options);
}

test.beforeEach(async ({ page }) => { await page.goto('/login'); });

test('large Android photo with missing MIME becomes a bounded JPEG', async ({ page }) => {
  const photo = await prepare(page, { large: true, name: 'camera.jpg' });
  expect(photo.type).toBe('image/jpeg');
  expect(photo.width).toBe(1440);
  expect(photo.height).toBe(960);
  expect(photo.size).toBeLessThan(2 * 1024 * 1024);
});

test('HEIC bytes with generic MIME and no extension use the fallback decoder', async ({ page }) => {
  const photo = await prepare(page, { bytes: [...readFileSync('tests/fixtures/photo.heic')], type: 'application/octet-stream', fallback: true });
  expect(photo.type).toBe('image/jpeg');
  expect(photo.width).toBe(32);
  expect(photo.height).toBe(20);
});

test('corrupt files give an actionable error', async ({ page }) => {
  await expect(prepare(page, { bytes: [1, 2, 3], type: 'image/jpeg' })).rejects.toThrow('사진을 읽지 못했습니다');
});

test('participant upload retries a temporary storage error with the same signed key', async ({ page }) => {
  const source = readFileSync('src/lib/media.js', 'utf8')
    .replace("import { mode } from './realtime';", "const mode = 'firestore';")
    .replace("import { ensureParticipantUser, getCurrentUser } from './auth';", "const user = { getIdToken: async () => 'test-token' }; const getCurrentUser = () => user; const ensureParticipantUser = async () => user;");
  await page.route('**/src/lib/media.js?retry-test', (route) => route.fulfill({ contentType: 'text/javascript', body: source }));
  let signs = 0;
  let puts = 0;
  await page.route('**/.netlify/functions/r2-media', async (route) => {
    signs += 1;
    await route.fulfill({ json: { uploadUrl: 'http://127.0.0.1:5173/test-photo-upload', key: 'same-photo', publicUrl: '/photo.jpg' } });
  });
  await page.route('**/test-photo-upload', async (route) => {
    puts += 1;
    await route.fulfill({ status: puts === 1 ? 503 : 200 });
  });
  const result = await page.evaluate(async () => {
    const { uploadParticipantPhoto } = await import('/src/lib/media.js?retry-test');
    return uploadParticipantPhoto('session', 'photo', new File(['test'], 'photo.jpg', { type: 'image/jpeg' }));
  });
  expect(result.path).toBe('same-photo');
  expect(signs).toBe(1);
  expect(puts).toBe(2);
});
