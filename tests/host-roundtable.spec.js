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

  const nickname = page.getByLabel('닉네임');
  await nickname.fill('테스트닉네임');
  await expect(nickname).toHaveValue('테스트닉네임');
  const colors = await nickname.evaluate((node) => {
    const style = getComputedStyle(node);
    return { color: style.color, fill: style.webkitTextFillColor };
  });
  expect(colors.color).toBe('rgb(17, 24, 39)');
  expect(colors.fill).toBe('rgb(17, 24, 39)');

  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.getByRole('heading', { name: '오늘 작품을 보며 가장 오래 머문 생각은 무엇인가요?' })).toBeVisible();
  expect(consoleErrors.filter((message) => message.includes('Maximum update depth exceeded'))).toEqual([]);
});
