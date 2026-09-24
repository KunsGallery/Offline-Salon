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
          guest_two: { participantId: 'guest_two', nickname: '프링', pearPairing: { photoUrl: PHOTO, status: 'ready', artwork: { title: '테스트 작품' } } },
        },
      },
    },
  };
}

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
  await expect(page.getByRole('button', { name: '연결 이유 보여주기' })).toBeVisible();
  await page.getByRole('button', { name: '연결 이유 보여주기' }).click();
  await expect(page.getByRole('button', { name: '전체 코르크 보드 보기' })).toBeVisible();
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
