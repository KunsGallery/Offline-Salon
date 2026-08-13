import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'offline-salon:interactive-studio-pro:v1';

function roundtableState(responseCount = 8) {
  const participants = {};
  const responses = Array.from({ length: responseCount }, (_, index) => {
    const participantId = `guest_${index + 1}`;
    participants[participantId] = {
      participantId,
      nickname: ['민지', '준호', '소라', '도윤', '하린', '은재', '지우', '서준', '유나', '시우', '예린', '현우'][index],
      joinedAt: new Date(Date.UTC(2026, 7, 3, 10, index)).toISOString(),
      lastSeenAt: new Date(Date.UTC(2026, 7, 3, 10, index)).toISOString(),
    };
    return {
      id: `answer_${index + 1}`,
      questionId: 'question_roundtable',
      participantId,
      nickname: participants[participantId].nickname,
      value: [
        '작품을 함께 바라보는 시간이 오래 기억에 남을 것 같아요.',
        '낯선 사람의 생각이 내 시선을 넓혀 주었습니다.',
        '정답보다 서로 다른 해석을 듣는 일이 좋았습니다.',
      ][index % 3],
      hidden: false,
      likes: index % 5,
      likedBy: {},
      createdAt: new Date(Date.UTC(2026, 7, 3, 10, index)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 7, 3, 10, index)).toISOString(),
    };
  });

  return {
    sessions: {
      session_roundtable: {
        id: 'session_roundtable',
        title: 'UNFRAME ART SALON',
        description: '서로의 시선이 한자리에 모이는 저녁',
        status: 'live',
        currentQuestionId: 'question_roundtable',
        showResults: true,
        allowNickname: true,
        allowMultipleSubmissions: false,
        createdAt: '2026-08-03T09:00:00.000Z',
        updatedAt: '2026-08-03T10:00:00.000Z',
        branding: {
          primaryColor: '#6f4256',
          secondaryColor: '#d1a65a',
          tertiaryColor: '#db857d',
          backgroundColor: '#eee5df',
          backgroundMode: 'dark',
          palette: ['#6f4256', '#d1a65a', '#db857d'],
        },
        stage: { mode: 'questions', page: 1, blackout: false },
        artworks: [],
        artworkSecrets: {},
        decks: [],
        questions: [{
          id: 'question_roundtable',
          title: '오늘 작품을 보며 가장 오래 머문 생각은 무엇인가요?',
          description: '다른 사람의 답을 들으며 내 생각도 천천히 꺼내보세요.',
          type: 'text',
          options: [],
          order: 0,
          isActive: true,
          createdAt: '2026-08-03T09:00:00.000Z',
          updatedAt: '2026-08-03T09:00:00.000Z',
        }],
        responses,
        participants,
      },
    },
  };
}

test('host display presents responses as a single salon roundtable scene', async ({ page }) => {
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key: STORAGE_KEY,
    state: roundtableState(),
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/host/session_roundtable');

  await expect(page.getByTestId('salon-roundtable')).toBeVisible();
  await expect(page.locator('.salon-table h2')).toContainText('가장 오래 머문 생각');
  await expect(page.locator('.salon-seat')).toHaveCount(8);
  await expect(page.locator('.salon-join-card .qr-frame')).toBeVisible();
  await expect(page.locator('.salon-seat.is-popular')).toHaveCount(2);

  const layout = await page.evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    verticalOverflow: document.documentElement.scrollHeight > document.documentElement.clientHeight,
  }));
  expect(layout).toEqual({ horizontalOverflow: false, verticalOverflow: false });
});

test('nickname remains legible when a dark poster theme is active', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key: STORAGE_KEY,
    state: roundtableState(0),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/client/session_roundtable');

  const nickname = page.getByRole('textbox', { name: '닉네임' });
  await nickname.fill('테스트닉네임');
  await expect(nickname).toHaveValue('테스트닉네임');
  const colors = await nickname.evaluate((node) => {
    const style = getComputedStyle(node);
    return { color: style.color, fill: style.webkitTextFillColor };
  });
  expect(colors.color).toBe('rgb(17, 24, 39)');
  expect(colors.fill).toBe('rgb(17, 24, 39)');

  await expect(page.locator('.avatar-builder')).toBeVisible();
  await page.getByRole('button', { name: '모스' }).click();
  await page.getByRole('button', { name: '이 캐릭터로 입장' }).click();
  await expect(page.getByRole('heading', { name: '오늘 작품을 보며 가장 오래 머문 생각은 무엇인가요?' })).toBeVisible();
  expect(consoleErrors.filter((message) => message.includes('Maximum update depth exceeded'))).toEqual([]);
});

test('returning from artwork mode clears the hidden activity question when no public question exists', async ({ page, context }) => {
  const state = roundtableState(0);
  const session = state.sessions.session_roundtable;
  session.currentQuestionId = 'artwork_activity_question';
  session.questions = [{
    id: 'artwork_activity_question',
    title: '이 작품에 제목을 붙인다면?',
    description: '떠오르는 제목을 적어보세요.',
    type: 'artwork-title',
    options: [],
    order: 0,
    isActive: true,
    internal: true,
    artworkId: 'artwork_1',
    runId: 'run_1',
    createdAt: '2026-08-03T09:00:00.000Z',
    updatedAt: '2026-08-03T09:00:00.000Z',
  }];
  session.artworks = [{ id: 'artwork_1', imageUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==' }];
  session.stage = { mode: 'questions', page: 1, blackout: false };
  session.participants = {
    idle_guest: { participantId: 'idle_guest', nickname: '대기자', joinedAt: '2026-08-03T09:00:00.000Z', lastSeenAt: '2026-08-03T09:00:00.000Z' },
  };

  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('offline-salon:participantId:session_roundtable', 'idle_guest');
    localStorage.setItem('offline-salon:nickname:session_roundtable', '대기자');
  }, { key: STORAGE_KEY, value: state });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/remote/session_roundtable');
  await page.locator('footer .remote-home').click();

  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_roundtable.currentQuestionId, STORAGE_KEY)).toBeNull();
  const participantPage = await context.newPage();
  await participantPage.setViewportSize({ width: 390, height: 844 });
  await participantPage.goto('/client/session_roundtable');
  await expect(participantPage.getByRole('heading', { name: '대기자님의 자리가 준비됐어요.' })).toBeVisible();
  await expect(participantPage.getByText('이 작품에 제목을 붙인다면?')).toHaveCount(0);
  await participantPage.close();
});

test('lobby seats joined participants as chosen vector characters', async ({ page }) => {
  const state = roundtableState(0);
  const session = state.sessions.session_roundtable;
  session.currentQuestionId = null;
  session.questions = [];
  session.stage = { mode: 'lobby', page: 1, blackout: false };
  session.participants = {
    guest_1: { participantId: 'guest_1', nickname: '모스', avatar: { shape: 'diamond', color: 'moss' }, joinedAt: '2026-08-03T09:00:00.000Z', lastSeenAt: '2026-08-03T09:00:00.000Z' },
    guest_2: { participantId: 'guest_2', nickname: '코발트', avatar: { shape: 'arch', color: 'cobalt' }, joinedAt: '2026-08-03T09:01:00.000Z', lastSeenAt: '2026-08-03T09:01:00.000Z' },
  };
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/host/session_roundtable');
  await expect(page.getByTestId('salon-lobby')).toBeVisible();
  await expect(page.locator('.lobby-person')).toHaveCount(2);
  await expect(page.getByText('질문이 시작되면')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth || document.documentElement.scrollHeight > document.documentElement.clientHeight);
  expect(overflow).toBe(false);
});

test('admin adopts a submitted title and opens the final artwork gallery', async ({ page, context }) => {
  const state = roundtableState(0);
  const session = state.sessions.session_roundtable;
  session.currentQuestionId = 'art_title_question';
  session.stage = { mode: 'artwork', artworkId: 'work_1', phase: 'vote', questionId: 'art_title_question', blackout: false };
  session.artworks = [
    { id: 'work_1', imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="800"%3E%3Crect width="40" height="800" fill="navy"/%3E%3C/svg%3E', order: 0 },
    { id: 'work_2', imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="40"%3E%3Crect width="800" height="40" fill="maroon"/%3E%3C/svg%3E', order: 1, adoptedTitle: '먼저 채택된 제목', adoptedResponseId: 'caption_previous' },
  ];
  session.artworkSecrets = { work_1: { id: 'work_1', title: '비공개 원제', artist: '작가' } };
  session.questions = [{ id: 'art_title_question', title: '이 작품에 제목을 붙인다면?', type: 'artwork-title', internal: true, isActive: true, artworkId: 'work_1', order: 0 }];
  session.responses = [
    { id: 'caption_1', questionId: 'art_title_question', participantId: 'guest_1', nickname: '하린', value: '달이 머문 자리', likes: 4, likedBy: {}, hidden: false, createdAt: '2026-08-03T09:00:00.000Z', updatedAt: '2026-08-03T09:00:00.000Z' },
    { id: 'caption_2', questionId: 'art_title_question', participantId: 'guest_2', nickname: '지우', value: '푸른 침묵', likes: 2, likedBy: {}, hidden: false, createdAt: '2026-08-03T09:01:00.000Z', updatedAt: '2026-08-03T09:01:00.000Z' },
  ];
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/remote/session_roundtable');
  const captionButton = page.locator('.remote-caption-picker button').filter({ hasText: '달이 머문 자리' });
  await captionButton.click();
  await expect(captionButton).toContainText('채택됨');
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_roundtable.artworks[0].adoptedTitle, STORAGE_KEY)).toBe('달이 머문 자리');
  await page.locator('footer .remote-next').click();
  const hostPage = await context.newPage();
  await hostPage.setViewportSize({ width: 1440, height: 900 });
  await hostPage.goto('/host/session_roundtable');
  await expect(hostPage.locator('.artwork-gallery-stage')).toBeVisible();
  await expect(hostPage.locator('.artwork-gallery-grid figure')).toHaveCount(2);
  const galleryFrames = await hostPage.locator('.artwork-gallery-grid figure > div').evaluateAll((frames) => frames.map((frame) => {
    const frameRect = frame.getBoundingClientRect();
    const imageRect = frame.querySelector('img').getBoundingClientRect();
    return {
      square: Math.abs(frameRect.width - frameRect.height) < 1,
      contained: imageRect.left >= frameRect.left && imageRect.top >= frameRect.top && imageRect.right <= frameRect.right && imageRect.bottom <= frameRect.bottom,
    };
  }));
  expect(galleryFrames.every(({ square, contained }) => square && contained)).toBe(true);
  await expect(hostPage.getByRole('heading', { name: '달이 머문 자리' })).toBeVisible();
  await expect(hostPage.getByRole('heading', { name: '먼저 채택된 제목' })).toBeVisible();
  await hostPage.close();
});
