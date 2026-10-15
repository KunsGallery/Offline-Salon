import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'offline-salon:interactive-studio-pro:v1';
const PHOTO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function pearSession() {
  return {
    sessions: {
      session_pear_remote: {
        id: 'session_pear_remote',
        title: 'UNFRAME SALON Vol. 4',
        status: 'live',
        enabledModules: ['pear-play'],
        currentQuestionId: null,
        createdAt: '2026-09-24T09:00:00.000Z',
        updatedAt: '2026-09-24T09:00:00.000Z',
        branding: { primaryColor: '#004AAD', secondaryColor: '#AAD004', tertiaryColor: '#41D8FF', backgroundColor: '#F6F4EE', backgroundMode: 'dark' },
        stage: { mode: 'pear-play', pearView: 'wall', pearPhase: 'photo', deckId: 'previous_pdf', blackout: false },
        artworks: [],
        decks: [{ id: 'previous_pdf', title: '이전 발표', fileUrl: '/previous.pdf', pageCount: 3 }],
        questions: [],
        responses: [],
        participants: {
          guest_one: { participantId: 'guest_one', nickname: '호야', pearPairing: { photoUrl: PHOTO, status: 'uploaded' } },
          guest_two: {
            participantId: 'guest_two',
            nickname: '프링',
            pearPairing: {
              photoUrl: '/pear-play/envelope-open-original.webp',
              status: 'ready',
              finalArtwork: {
                imageUrl: '/pear-play/office-board-original.webp',
                title: '테스트 작품',
                artist: '테스트 작가',
                year: '2026',
                dimensions: '30 × 40 cm',
                materials: '캔버스에 유채',
              },
              analysis: { objects: ['편지', '종이'], colors: ['따뜻한 갈색'] },
              keywords: ['기록', '기억'],
              statement: '두 장면은 기억을 기록합니다.',
              connection: '일상의 편지와 작품의 기록은 사소한 장면을 오래 바라보게 합니다.',
            },
          },
        },
      },
    },
  };
}

function preparedSession() {
  const state = pearSession();
  const session = state.sessions.session_pear_remote;
  session.pearPreparedCases = [{ id: 'prepared_one', title: '관리자 사진', pearPairing: { ...session.participants.guest_two.pearPairing } }];
  return state;
}

test('prepared reverse case shows only artwork until the host reveals the source', async ({ page, context }) => {
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem('offline-salon:participantId:session_pear_remote', 'guest_one');
    localStorage.setItem('offline-salon:nickname:session_pear_remote', '호야');
  }, { key: STORAGE_KEY, state: preparedSession() });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/remote/session_pear_remote');
  const host = await context.newPage();
  await host.setViewportSize({ width: 1440, height: 900 });
  await host.goto('/host/session_pear_remote');
  const client = await context.newPage();
  await client.setViewportSize({ width: 390, height: 844 });
  await client.goto('/client/session_pear_remote');
  let apiCalls = 0;
  await context.route('**/.netlify/functions/pear-play', (route) => { apiCalls += 1; return route.fulfill({ status: 500 }); });
  await page.getByRole('button', { name: /사건 1 · 관리자 사진/ }).click();
  await expect(host.locator('.pear-reverse-artwork img')).toHaveAttribute('src', '/pear-play/office-board-original.webp');
  await expect(host.locator('.pear-board-pair')).toHaveCount(0);
  await expect(client.locator('.pear-reverse-mobile')).toContainText('이 작품은 어떤 사진에서 시작됐을까요?');
  await expect(client.locator('img[src="/pear-play/envelope-open-original.webp"]')).toHaveCount(0);
  await expect(client.locator('.pear-connection')).toHaveCount(0);
  await host.screenshot({ path: 'test-results/prepared-host-artwork.png' });
  await page.screenshot({ path: 'test-results/prepared-remote-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByRole('button', { name: '원본 사진 공개', exact: true }).click();
  await expect(host.locator('.pear-board-pair img')).toHaveCount(2);
  await expect(client.locator('.pear-result-pair img')).toHaveCount(2);
  await expect(host.locator('.pear-board-map')).toHaveCount(0);
  await expect(client.locator('.pear-connection')).toHaveCount(0);
  await page.getByRole('button', { name: '연결 이유 보기', exact: true }).click();
  await expect(host.locator('.pear-board-map')).toContainText('일상의 편지와 작품의 기록');
  await expect(client.locator('.pear-connection')).toContainText('일상의 편지와 작품의 기록');
  await page.getByRole('button', { name: '작품만 다시 보기' }).click();
  await expect(host.locator('.pear-reverse-artwork')).toBeVisible();
  await expect(client.locator('.pear-connection')).toHaveCount(0);
  await page.getByRole('button', { name: /호야 사진 접수 완료/ }).click();
  await expect(host.locator('.pear-reverse-artwork')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '탐정 P의 추리 시작' })).toBeVisible();
  expect(apiCalls).toBe(0);
  await host.close(); await client.close();
});

test('prepared cases work with no participant uploads and survive remote reload', async ({ page, context }) => {
  const state = preparedSession();
  state.sessions.session_pear_remote.participants = {};
  state.sessions.session_pear_remote.pearPreparedCases.push({ id: 'unfinished', title: '조사 대기 사진', pearPairing: { photoUrl: PHOTO, status: 'error' } });
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: STORAGE_KEY, state });
  await page.goto('/remote/session_pear_remote');
  await expect(page.getByRole('button', { name: /조사 대기 사진/ })).toBeDisabled();
  await page.getByRole('button', { name: /사건 1 · 관리자 사진/ }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '원본 사진 공개', exact: true })).toBeVisible();
  const host = await context.newPage();
  await host.goto('/host/session_pear_remote');
  await expect(host.locator('.pear-reverse-artwork img')).toBeVisible();
  await host.close();
});

test('admin uploads and retries a prepared investigation without changing the live screen', async ({ page }) => {
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state: pearSession() });
  await page.route('**/src/lib/auth.js', async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace('return auth?.currentUser || null;', 'return { getIdToken: async () => "test-admin-token" };');
    await route.fulfill({ response, body });
  });
  let calls = 0;
  await page.route('**/.netlify/functions/pear-play', (route) => {
    calls += 1;
    if (calls === 1) return route.fulfill({ status: 502, json: { ok: false, error: '테스트 조사 실패' } });
    return route.fulfill({ json: { ok: true, status: 'completed', pairing: pearSession().sessions.session_pear_remote.participants.guest_two.pearPairing } });
  });
  await page.goto('/admin/session_pear_remote');
  const stageBefore = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_pear_remote.stage, STORAGE_KEY);
  await page.getByLabel('사전 조사 사진', { exact: true }).setInputFiles('public/pear-play/envelope-open-original.webp');
  await expect(page.locator('.prepared-pear-item')).toContainText('테스트 조사 실패');
  await page.locator('.prepared-pear-item').getByRole('button', { name: '작품 조사', exact: true }).click();
  await expect(page.locator('.prepared-pear-item')).toContainText('조사 완료');
  await expect(page.locator('.prepared-pear-item img')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/prepared-admin-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.locator('.prepared-pear-admin').screenshot({ path: 'test-results/prepared-admin-mobile.png' });
  const stageAfter = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_pear_remote.stage, STORAGE_KEY);
  expect(stageAfter).toEqual(stageBefore);
  expect(calls).toBe(2);
});

test('deleting the active prepared case resets the stage to the participant board', async ({ page }) => {
  const state = preparedSession();
  state.sessions.session_pear_remote.stage = { mode: 'pear-play', pearView: 'case', pearPreparedCaseId: 'prepared_one', pearPhase: 'artwork-only' };
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state });
  await page.goto('/admin/session_pear_remote');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('.prepared-pear-item').getByRole('button', { name: '삭제', exact: true }).click();
  await expect(page.locator('.prepared-pear-item')).toHaveCount(0);
  const stage = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_pear_remote.stage, STORAGE_KEY);
  expect(stage.pearPreparedCaseId).toBeNull();
  expect(stage.pearView).toBe('wall');
});

test('mobile PEAR remote keeps the next action visible and switches cases without duplicate controls', async ({ page }) => {
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state: pearSession() });
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/remote/session_pear_remote');

  await expect(page.getByRole('heading', { name: 'PEAR PLAY 진행' })).toBeVisible();
  await expect(page.getByRole('button', { name: '현장 사진 공개', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '결과 0' })).toHaveCount(0);
  await expect(page.locator('.remote-page-controls')).toHaveCount(0);
  const layout = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    nextActionTop: document.querySelector('.pear-primary-action')?.getBoundingClientRect().top,
  }));
  expect(layout.overflow).toBe(false);
  expect(layout.nextActionTop).toBeLessThan(700);

  await page.getByRole('button', { name: /호야 사진 접수 완료/ }).click();
  await expect(page.getByRole('heading', { name: '호야의 사건' })).toBeVisible();
  await expect(page.getByRole('button', { name: '탐정 P의 추리 시작' })).toBeVisible();
  await page.getByRole('button', { name: /프링 작품 분석 완료/ }).click();
  await expect(page.getByRole('button', { name: '찾은 작품 공개' })).toBeVisible();
  await page.getByRole('button', { name: '찾은 작품 공개' }).click();
  await expect(page.getByRole('button', { name: '연결 이유 보기' })).toBeVisible();
  await page.getByRole('button', { name: '연결 이유 보기' }).click();
  await expect(page.getByRole('button', { name: '전체 코르크 보드 보기' })).toBeVisible();
});

test('artwork reveal and connection stay on the rabbit detective board', async ({ page, context }) => {
  const state = pearSession();
  state.sessions.session_pear_remote.stage = { mode: 'pear-play', pearView: 'case', pearPhase: 'found', pearParticipantId: 'guest_two', blackout: false };
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/remote/session_pear_remote');
  const host = await context.newPage();
  await host.setViewportSize({ width: 1440, height: 900 });
  await host.goto('/host/session_pear_remote');

  await page.getByRole('button', { name: '찾은 작품 공개' }).click();
  await expect(host.locator('.pear-host-selected')).toBeVisible();
  await expect(host.locator('.pear-board-pair img')).toHaveCount(2);
  const pinPosition = await host.locator('.pear-board-image').first().evaluate((element) => {
    const box = element.getBoundingClientRect();
    const pinTop = Number.parseFloat(getComputedStyle(element, '::before').top);
    return { imageTop: box.top, pinTop: box.top + pinTop };
  });
  expect(pinPosition.pinTop).toBeGreaterThan(pinPosition.imageTop);
  await expect(host.locator('.pear-board-artwork figcaption')).toContainText('30 × 40 cm');
  await expect(host.locator('.pear-board-artwork figcaption')).toContainText('캔버스에 유채');
  await expect(host.locator('.pear-host-reveal-stage')).toHaveCount(0);
  await expect(host.locator('.pear-evidence-wall-layer')).toHaveClass(/is-hidden/);
  await expect(host.locator('.pear-board-map')).toHaveCount(0);

  await page.getByRole('button', { name: '연결 이유 보기' }).click();
  await expect(host.locator('.pear-host-selected')).toBeVisible();
  await expect(host.locator('.pear-board-pair img')).toHaveCount(2);
  await expect(host.locator('.pear-board-map')).toContainText('일상의 편지와 작품의 기록');
  await expect(host.locator('.pear-board-map')).toContainText('사진의 단서');
  await expect(host.locator('.pear-board-map')).toContainText('작품의 단서');
  const captionBottom = await host.locator('.pear-board-artwork figcaption').evaluate((element) => element.getBoundingClientRect().bottom);
  const mapTop = await host.locator('.pear-board-map').evaluate((element) => element.getBoundingClientRect().top);
  expect(captionBottom).toBeLessThan(mapTop);
  const mapBottom = await host.locator('.pear-board-map').evaluate((element) => element.getBoundingClientRect().bottom);
  expect(mapBottom).toBeLessThan(900 * .75);
  await expect.poll(() => host.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight)).toBe(false);
  await host.close();
});

test('submitted participant cannot replace the photo and sees Detective P during investigation', async ({ page }) => {
  const state = pearSession();
  state.sessions.session_pear_remote.stage = { mode: 'pear-play', pearView: 'case', pearPhase: 'investigating', pearInvestigationStep: 'verifying', pearInvestigationClue: '편지 · 따뜻한 갈색', pearParticipantId: 'guest_one' };
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('offline-salon:participantId:session_pear_remote', 'guest_one');
    localStorage.setItem('offline-salon:nickname:session_pear_remote', '호야');
  }, { key: STORAGE_KEY, value: state });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/client/session_pear_remote');
  await expect(page.locator('.pear-investigation-detective')).toBeVisible();
  await expect(page.locator('.pear-investigation-mobile')).toContainText('편지 · 따뜻한 갈색');
  await expect(page.getByRole('button', { name: /다른 사진|새 사진/ })).toHaveCount(0);
  await expect(page.locator('.pear-investigation-mobile .pear-detective-mark')).toHaveCount(0);
});

test('submitted photo remains read-only while waiting for host', async ({ page }) => {
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('offline-salon:participantId:session_pear_remote', 'guest_one');
    localStorage.setItem('offline-salon:nickname:session_pear_remote', '호야');
  }, { key: STORAGE_KEY, value: pearSession() });
  await page.goto('/client/session_pear_remote');
  await expect(page.getByRole('heading', { name: /사진이 사건 보관함에/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /다른 사진|새 사진|사진 접수하기/ })).toHaveCount(0);
  await expect(page.locator('.pear-participant-waiting')).toContainText('접수된 사진은 변경할 수 없습니다');
});

test('photo intake shows progress and locks the accepted upload', async ({ page }) => {
  const state = pearSession();
  state.sessions.session_pear_remote.participants.guest_one.pearPairing = null;
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('offline-salon:participantId:session_pear_remote', 'guest_one');
    localStorage.setItem('offline-salon:nickname:session_pear_remote', '호야');
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function delayedToBlob(callback, ...args) {
      return toBlob.call(this, (blob) => window.setTimeout(() => callback(blob), 900), ...args);
    };
  }, { key: STORAGE_KEY, value: state });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/client/session_pear_remote');
  await page.locator('.pear-upload-panel input[type=file]').first().setInputFiles('public/pear-play/envelope-open-original.webp');
  await expect(page.locator('.pear-envelope-front-layer')).toBeVisible();
  await page.getByRole('button', { name: '사진 접수하기' }).click();
  await expect(page.getByRole('status')).toContainText('사진을 준비하고 있어요');
  await expect(page.getByRole('progressbar', { name: '사진 업로드 진행률' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /사진이 사건 보관함에/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /다른 사진|새 사진|사진 접수하기/ })).toHaveCount(0);
});

test('opening the participant page does not change the live host stage', async ({ page }) => {
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state: pearSession() });
  await page.goto('/remote/session_pear_remote');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: '참가자 화면 보기' }).click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/client\/session_pear_remote/);
  await popup.close();
  await expect(page.getByRole('heading', { name: '전체 코르크 보드' })).toBeVisible();
  const stage = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_pear_remote.stage, STORAGE_KEY);
  expect(stage.pearView).toBe('wall');
});

test('offline commands explain why the live screen did not change', async ({ page, context }) => {
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state: pearSession() });
  await page.goto('/remote/session_pear_remote');
  await context.setOffline(true);
  await page.getByRole('button', { name: '현장 사진 공개', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('인터넷 연결이 끊겼습니다');
  await context.setOffline(false);
});

test('new evidence is pinned by the assistant once and remains on the wall after case navigation', async ({ page, context }) => {
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state: pearSession() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/host/session_pear_remote');
  await expect(page.locator('.pear-evidence-note.is-pinned')).toHaveCount(2);
  await expect(page.locator('.pear-board-assistant:not(.is-pinning)')).toBeVisible();
  await expect(page.locator('.pear-pinning-action')).toHaveCount(0);

  const writer = await context.newPage();
  await writer.goto('/remote/session_pear_remote');
  await writer.evaluate(({ key, photo }) => {
    const state = JSON.parse(localStorage.getItem(key));
    state.sessions.session_pear_remote.participants.guest_three = {
      participantId: 'guest_three', nickname: '새 손님', pearPairing: { photoUrl: photo, status: 'uploaded' },
    };
    state.sessions.session_pear_remote.participants.guest_four = {
      participantId: 'guest_four', nickname: '다음 손님', pearPairing: { photoUrl: photo, status: 'uploaded' },
    };
    localStorage.setItem(key, JSON.stringify(state));
  }, { key: STORAGE_KEY, photo: PHOTO });
  await expect(page.locator('.pear-board-assistant.is-pinning.is-left')).toBeVisible();
  await expect(page.locator('.pear-board-assistant-held-photo')).toBeVisible();
  await expect(page.locator('.pear-evidence-note.is-pinning')).toHaveCount(1);
  await page.waitForTimeout(650);
  const leftReach = await page.evaluate(() => {
    const card = document.querySelector('.pear-evidence-note.is-pinning').getBoundingClientRect();
    const held = document.querySelector('.pear-board-assistant-held-photo').getBoundingClientRect();
    return Math.hypot(card.left + card.width / 2 - (held.left + held.width / 2), card.top - held.top);
  });
  expect(leftReach).toBeLessThan(70);
  await expect(page.locator('.pear-evidence-note.is-pinned')).toHaveCount(3);
  await expect(page.locator('.pear-board-assistant.is-pinning.is-right')).toBeVisible();
  await expect(page.locator('.pear-evidence-note.is-pinning')).toHaveCount(1);
  await page.waitForTimeout(650);
  const rightReach = await page.evaluate(() => {
    const card = document.querySelector('.pear-evidence-note.is-pinning').getBoundingClientRect();
    const held = document.querySelector('.pear-board-assistant-held-photo').getBoundingClientRect();
    return Math.hypot(card.left + card.width / 2 - (held.left + held.width / 2), card.top - held.top);
  });
  expect(rightReach).toBeLessThan(70);
  await expect(page.locator('.pear-evidence-note.is-pinned')).toHaveCount(4);
  await expect(page.locator('.pear-board-assistant:not(.is-pinning)')).toBeVisible();

  await writer.reload();
  await writer.getByRole('button', { name: /호야 사진 접수 완료/ }).click();
  await expect(page.locator('.pear-host-selected')).toBeVisible();
  await writer.getByRole('button', { name: '전체 코르크 보드', exact: true }).click();
  await expect(page.locator('.pear-host-wall')).toBeVisible();
  await expect(page.locator('.pear-evidence-note.is-pinned')).toHaveCount(4);
  await expect(page.locator('.pear-evidence-note.is-pinning')).toHaveCount(0);
  await writer.close();
});
