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
          likesEnabled: true,
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

test('core result gallery groups every included result by participant and supports generic likes', async ({ page }) => {
  const state = roundtableState(0);
  const session = state.sessions.session_roundtable;
  session.currentQuestionId = null;
  session.stage = { mode: 'gallery', page: 1, blackout: false };
  session.questions = [
    { id: 'core_reflection', title: '오늘의 한 문장', description: '', type: 'text', options: [], order: 0, isActive: false, likesEnabled: true, includeInGallery: true },
    { id: 'core_choice', title: '내가 고른 키워드', description: '', type: 'poll', options: ['연결', '발견'], order: 1, isActive: false, likesEnabled: false, includeInGallery: true },
    { id: 'not_in_gallery', title: '비공개 회고', description: '', type: 'text', options: [], order: 2, isActive: false, likesEnabled: true, includeInGallery: false },
  ];
  session.participants = {
    guest_1: { participantId: 'guest_1', nickname: '민지', avatar: { shape: 'round', color: 'berry' }, joinedAt: '2026-08-03T09:00:00.000Z', lastSeenAt: '2026-08-03T09:10:00.000Z' },
    guest_2: { participantId: 'guest_2', nickname: '준호', avatar: { shape: 'diamond', color: 'moss' }, joinedAt: '2026-08-03T09:01:00.000Z', lastSeenAt: '2026-08-03T09:11:00.000Z' },
  };
  session.responses = [
    { id: 'core_1', questionId: 'core_reflection', participantId: 'guest_1', nickname: '민지', value: '서로의 관점을 발견했다.', likes: 2, likedBy: {}, hidden: false, createdAt: '2026-08-03T09:20:00.000Z' },
    { id: 'core_2', questionId: 'core_choice', participantId: 'guest_1', nickname: '민지', value: '발견', likes: 7, likedBy: {}, hidden: false, createdAt: '2026-08-03T09:21:00.000Z' },
    { id: 'core_3', questionId: 'core_reflection', participantId: 'guest_2', nickname: '준호', value: '다음 대화를 기대하게 됐다.', likes: 0, likedBy: {}, hidden: false, createdAt: '2026-08-03T09:22:00.000Z' },
    { id: 'private_1', questionId: 'not_in_gallery', participantId: 'guest_2', nickname: '준호', value: '갤러리에 나오면 안 됨', likes: 5, likedBy: {}, hidden: false, createdAt: '2026-08-03T09:23:00.000Z' },
  ];
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('offline-salon:participantId:session_roundtable', 'guest_1');
    localStorage.setItem('offline-salon:nickname:session_roundtable', '민지');
  }, { key: STORAGE_KEY, value: state });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/host/session_roundtable');
  await expect(page.locator('.result-gallery-stage')).toBeVisible();
  await expect(page.locator('.participant-result-card')).toHaveCount(2);
  await expect(page.locator('.participant-result-card').filter({ hasText: '민지' }).locator('.participant-result-entry')).toHaveCount(2);
  await expect(page.locator('.participant-result-card').filter({ hasText: '민지' }).locator('header > b')).toHaveText('♥ 2');
  await expect(page.locator('.participant-result-entry').filter({ hasText: '내가 고른 키워드' }).locator('b')).toHaveCount(0);
  await expect(page.getByText('갤러리에 나오면 안 됨')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/client/session_roundtable');
  const junhoResults = page.locator('.mobile-result-groups > section').filter({ hasText: '준호' });
  await expect(page.locator('.mobile-result-groups article').filter({ hasText: '내가 고른 키워드' }).locator('button')).toHaveCount(0);
  await expect(junhoResults).toContainText('다음 대화를 기대하게 됐다.');
  await junhoResults.getByRole('button', { name: '♡ 0' }).click();
  await expect(junhoResults.getByRole('button', { name: '♥ 1' })).toBeVisible();
});

test('exhibition grape opens an NFC-linked poster, saves a rating and updates host counts', async ({ page }) => {
  const state = roundtableState(0);
  const session = state.sessions.session_roundtable;
  session.currentQuestionId = null;
  session.stage = { mode: 'exhibition-grape', view: 'live', page: 1, blackout: false };
  session.artworks = [
    { id: 'exhibition_1', displayTitle: '빛이 머무는 자리', imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="420"%3E%3Crect width="300" height="420" fill="%236d3478"/%3E%3C/svg%3E', order: 0 },
    { id: 'exhibition_2', displayTitle: '여름의 표면', imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="420"%3E%3Crect width="300" height="420" fill="%2378983f"/%3E%3C/svg%3E', order: 1 },
  ];
  session.participants = {
    guest_1: { participantId: 'guest_1', nickname: '민지', avatar: { shape: 'round', color: 'berry' }, grapeSelections: {}, joinedAt: '2026-08-03T09:00:00.000Z', lastSeenAt: '2026-08-03T09:10:00.000Z' },
  };
  await page.addInitScript(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
    localStorage.setItem('offline-salon:participantId:session_roundtable', 'guest_1');
    localStorage.setItem('offline-salon:nickname:session_roundtable', '민지');
  }, { key: STORAGE_KEY, value: state });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/client/session_roundtable?exhibition=exhibition_1');
  await expect(page.locator('.grape-rating-editor')).toContainText('빛이 머무는 자리');
  await page.getByRole('button', { name: '보고 왔어요' }).click();
  await page.locator('.grape-rating-range input').fill('9');
  await page.getByRole('button', { name: '내 포도에 한 알 추가' }).click();
  await expect(page.locator('.exhibition-grape.filled')).toHaveCount(1);
  await expect(page.locator('.exhibition-grape.filled')).toHaveAttribute('aria-label', /9점/);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    window.history.pushState({}, '', '/host/session_roundtable');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('.grape-host-live')).toBeVisible();
  await expect(page.locator('.grape-host-live article').filter({ hasText: '빛이 머무는 자리' }).locator('.exhibition-flip-number')).toHaveText('01');

  await page.evaluate(() => { window.history.pushState({}, '', '/remote/session_roundtable'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await page.locator('.grape-remote-people > button').filter({ hasText: '민지' }).click();
  await page.evaluate(() => { window.history.pushState({}, '', '/host/session_roundtable'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.locator('.grape-host-person')).toBeVisible();

  await page.evaluate(() => { window.history.pushState({}, '', '/remote/session_roundtable'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await page.getByRole('button', { name: '전체 포도밭' }).click();
  await page.evaluate(() => { window.history.pushState({}, '', '/host/session_roundtable'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await expect(page.locator('.grape-host-collective')).toBeVisible();
});

test('admin adopts a submitted title and opens the final artwork gallery', async ({ page, context }) => {
  const state = roundtableState(0);
  const session = state.sessions.session_roundtable;
  session.currentQuestionId = 'art_title_question';
  session.stage = { mode: 'artwork', artworkId: 'work_1', phase: 'vote', questionId: 'art_title_question', blackout: false };
  session.artworks = [
    { id: 'work_1', imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="800"%3E%3Crect width="40" height="800" fill="navy"/%3E%3C/svg%3E', order: 0 },
    { id: 'work_2', imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="40"%3E%3Crect width="800" height="40" fill="maroon"/%3E%3C/svg%3E', order: 1, adoptedTitle: '먼저 채택된 제목', adoptedResponseId: 'caption_previous' },
    { id: 'work_3', imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="teal"/%3E%3C/svg%3E', order: 2 },
    ...Array.from({ length: 8 }, (_, index) => ({ id: `work_${index + 4}`, imageUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="slategray"/%3E%3C/svg%3E', order: index + 3 })),
  ];
  session.artworkSecrets = {
    work_1: { id: 'work_1', title: '비공개 원제', artist: '작가' },
    work_2: { id: 'work_2', title: '두 번째 원제', artist: '작가' },
    work_3: { id: 'work_3', title: '세 번째 원제', artist: '작가' },
  };
  session.questions = [
    { id: 'old_art_title_question', title: '이 작품에 제목을 붙인다면?', type: 'artwork-title', internal: true, isActive: false, artworkId: 'work_1', order: 0 },
    { id: 'art_title_question', title: '이 작품에 제목을 붙인다면?', type: 'artwork-title', internal: true, isActive: true, artworkId: 'work_1', order: 1 },
  ];
  session.responses = [
    { id: 'caption_1', questionId: 'art_title_question', participantId: 'guest_1', nickname: '하린', value: '달이 머문 자리', likes: 4, likedBy: {}, hidden: false, createdAt: '2026-08-03T09:00:00.000Z', updatedAt: '2026-08-03T09:00:00.000Z' },
    { id: 'caption_2', questionId: 'old_art_title_question', participantId: 'guest_2', nickname: '지우', value: '푸른 침묵', likes: 2, likedBy: {}, hidden: true, createdAt: '2026-08-03T09:01:00.000Z', updatedAt: '2026-08-03T09:01:00.000Z' },
    { id: 'caption_previous', questionId: 'missing_legacy_question', participantId: 'guest_3', nickname: '민서', value: '먼저 채택된 제목', likes: 3, likedBy: {}, hidden: false, createdAt: '2026-08-03T08:00:00.000Z', updatedAt: '2026-08-03T08:00:00.000Z' },
    { id: 'caption_previous_alt', questionId: 'missing_legacy_question', participantId: 'guest_4', nickname: '도윤', value: '오래된 다른 제목', likes: 1, likedBy: {}, hidden: false, createdAt: '2026-08-03T08:01:00.000Z', updatedAt: '2026-08-03T08:01:00.000Z' },
  ];
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: STORAGE_KEY, value: state });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/remote/session_roundtable');
  const captionButton = page.locator('.remote-caption-choice').filter({ hasText: '달이 머문 자리' });
  await captionButton.click();
  await expect(captionButton).toContainText('채택됨');
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_roundtable.artworks[0].adoptedTitle, STORAGE_KEY)).toBe('달이 머문 자리');
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_roundtable.artworks[0].adoptedQuestionId, STORAGE_KEY)).toBe('art_title_question');
  await page.locator('footer .remote-next').click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_roundtable.stage.mode, STORAGE_KEY)).toBe('gallery');
  const hostPage = await context.newPage();
  await hostPage.setViewportSize({ width: 1440, height: 900 });
  await hostPage.goto('/host/session_roundtable');
  await expect(hostPage.locator('.artwork-gallery-stage')).toBeVisible();
  await expect(hostPage.getByRole('heading', { name: '서로의 시선이 머문 자리' })).toBeVisible();
  await expect(hostPage.getByText('오늘 이 자리에서 발견된 시선과 언어를 한곳에 모았습니다.')).toHaveCount(0);
  await expect(hostPage.locator('.artwork-gallery-stage > header strong')).toHaveCount(0);
  await expect(hostPage.locator('.artwork-gallery-grid figure')).toHaveCount(11);
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
  await expect(hostPage.getByRole('heading', { name: '제목 채택 대기' }).first()).toBeVisible();
  await page.getByRole('button', { name: '아래로 ↓' }).click();
  await expect.poll(() => hostPage.locator('.artwork-gallery-grid').evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
  await page.getByRole('button', { name: '맨 위' }).click();
  await expect.poll(() => hostPage.locator('.artwork-gallery-grid').evaluate((node) => Math.round(node.scrollTop))).toBe(0);
  await hostPage.close();

  const adoptedArtworkCard = page.locator('.remote-asset-card').filter({ hasText: '달이 머문 자리' });
  await adoptedArtworkCard.getByRole('button', { name: '지난 제목 기록' }).click();
  const titleArchive = page.getByRole('region', { name: '달이 머문 자리 제목 기록' });
  await expect(titleArchive).toBeVisible();
  await expect(titleArchive.locator('li')).toHaveCount(2);
  await expect(titleArchive.locator('li.adopted')).toContainText('달이 머문 자리');
  await expect(titleArchive.locator('li.adopted')).toContainText('♥ 4');
  await expect(titleArchive.getByText('지우 · 숨김 처리됨')).toBeVisible();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_roundtable.stage.mode, STORAGE_KEY)).toBe('gallery');
  page.once('dialog', (dialog) => dialog.accept());
  await titleArchive.getByRole('button', { name: '“푸른 침묵” 제목 삭제' }).click();
  await expect(titleArchive.locator('li')).toHaveCount(1);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_roundtable.responses.map((item) => item.id), STORAGE_KEY)).toEqual(['caption_1', 'caption_previous', 'caption_previous_alt']);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).sessions.session_roundtable.stage.mode, STORAGE_KEY)).toBe('gallery');
  await titleArchive.getByRole('button', { name: '제목 기록 닫기' }).click();
  await expect(titleArchive).toHaveCount(0);

  const legacyArtworkCard = page.locator('.remote-asset-card').filter({ hasText: '먼저 채택된 제목' });
  await legacyArtworkCard.getByRole('button', { name: '지난 제목 기록' }).click();
  const legacyTitleArchive = page.getByRole('region', { name: '먼저 채택된 제목 제목 기록' });
  await expect(legacyTitleArchive.locator('li')).toHaveCount(2);
  await expect(legacyTitleArchive.locator('li.adopted')).toContainText('먼저 채택된 제목');
  await expect(legacyTitleArchive.getByText('오래된 다른 제목', { exact: true })).toBeVisible();
  await legacyTitleArchive.getByRole('button', { name: '제목 기록 닫기' }).click();

  await adoptedArtworkCard.getByRole('button', { name: '지난 제목 기록' }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('region', { name: '달이 머문 자리 제목 기록' }).getByRole('button', { name: '“달이 머문 자리” 제목 삭제' }).click();
  await expect.poll(() => page.evaluate((key) => {
    const current = JSON.parse(localStorage.getItem(key)).sessions.session_roundtable;
    return { mode: current.stage.mode, responseCount: current.responses.length, adoptedTitle: current.artworks[0].adoptedTitle, adoptedResponseId: current.artworks[0].adoptedResponseId };
  }, STORAGE_KEY)).toEqual({ mode: 'gallery', responseCount: 2, adoptedTitle: null, adoptedResponseId: null });
});
