import { expect, test } from '@playwright/test';

async function imageBuffer(page, color = '#cf248d') {
  const dataUrl = await page.evaluate((fill) => {
    const canvas = document.createElement('canvas');
    canvas.width = 48; canvas.height = 48;
    const context = canvas.getContext('2d');
    context.fillStyle = fill; context.fillRect(0, 0, 48, 48);
    context.fillStyle = '#f6b73c'; context.fillRect(24, 0, 24, 24);
    context.fillStyle = '#3a86ff'; context.fillRect(0, 24, 24, 24);
    return canvas.toDataURL('image/png');
  }, color);
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

function pdfBuffer() {
  const stream = 'BT /F1 28 Tf 72 700 Td (Offline Salon PDF) Tj ET';
  const secondStream = 'BT /F1 28 Tf 72 700 Td (Second Page) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 7 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Annots [6 0 R] >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Annot /Subtype /Link /Rect [72 650 280 690] /Border [0 0 0] /A << /S /URI /URI (https://example.com) >> >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 8 0 R >>',
    `<< /Length ${secondStream.length} >>\nstream\n${secondStream}\nendstream`,
  ];
  let source = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(source)); source += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { source += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(source);
}

function koreanCidPdfBuffer() {
  return Buffer.from('JVBERi0xLjMKJZOMi54gUmVwb3J0TGFiIEdlbmVyYXRlZCBQREYgZG9jdW1lbnQgKG9wZW5zb3VyY2UpCjEgMCBvYmoKPDwKL0YxIDIgMCBSIC9GMiAzIDAgUgo+PgplbmRvYmoKMiAwIG9iago8PAovQmFzZUZvbnQgL0hlbHZldGljYSAvRW5jb2RpbmcgL1dpbkFuc2lFbmNvZGluZyAvTmFtZSAvRjEgL1N1YnR5cGUgL1R5cGUxIC9UeXBlIC9Gb250Cj4+CmVuZG9iagozIDAgb2JqCjw8Ci9CYXNlRm9udCAvSFlTTXllb25nSm8tTWVkaXVtIC9EZXNjZW5kYW50Rm9udHMgWyA8PAovQmFzZUZvbnQgL0hZU015ZW9uZ0pvLU1lZGl1bSAvQ0lEU3lzdGVtSW5mbyA8PAovT3JkZXJpbmcgKEtvcmVhMSkgL1JlZ2lzdHJ5IChBZG9iZSkgL1N1cHBsZW1lbnQgMQo+PiAvRFcgMTAwMCAvRm9udERlc2NyaXB0b3IgPDwKL0FzY2VudCA3NTIgL0F2Z1dpZHRoIDUwMCAvQ2FwSGVpZ2h0IDczNyAvRGVzY2VudCAtMjcxIC9GbGFncyA2IC9Gb250QkJveCBbIDAgLTE0OCAxMDAxIDg4MCBdIAogIC9Gb250TmFtZSAvSFlTTXllb25nSm8tTWVkaXVtIC9JdGFsaWNBbmdsZSAwIC9MZWFkaW5nIDE0OCAvTWF4V2lkdGggMTAwMCAvTWlzc2luZ1dpZHRoIDUwMCAvU3RlbUggOTEgCiAgL1N0ZW1WIDU4IC9UeXBlIC9Gb250RGVzY3JpcHRvciAvWEhlaWdodCA1NTMKPj4gL1N1YnR5cGUgL0NJREZvbnRUeXBlMiAvVHlwZSAvRm9udCAKICAvVyBbIDEgWyAzMzMgNDE2IF0gMyBbIDQxNiA4MzMgNjI1IDkxNiA4MzMgMjUwIDUwMCBdIDEwIDExIDUwMCAxMiBbIDgzMyAyOTEgODMzIDI5MSAzNzUgNjI1IF0gMTggCiAgMjYgNjI1IDI3IDI4IDMzMyAyOSAzMCA4MzMgMzEgWyA5MTYgNTAwIDEwMDAgNzkxIDcwOCBdIAogIDM2IFsgNzA4IDc1MCA3MDggNjY2IDc1MCA3OTEgMzc1IDUwMCA3OTEgNjY2IAogIDkxNiA3OTEgNzUwIDY2NiA3NTAgNzA4IDY2NiA3OTEgXSA1NCBbIDc5MSA3NTAgMTAwMCA3MDggXSA1OCBbIDcwOCA2NjYgNTAwIDM3NSA1MDAgXSA2MyA2NCA1MDAgNjUgCiAgWyAzMzMgNTQxIDU4MyA1NDEgNTgzIF0gNzAgWyA1ODMgMzc1IDU4MyBdIDczIFsgNTgzIDI5MSAzMzMgNTgzIDI5MSA4NzUgNTgzIF0gODAgODIgNTgzIDgzIFsgNDU4IDU0MSAzNzUgNTgzIF0gCiAgODcgWyA1ODMgODMzIDYyNSBdIDkwIFsgNjI1IDUwMCA1ODMgXSA5MyA5NCA1ODMgOTUgWyA3NTAgXSBdCj4+IF0gL0VuY29kaW5nIC9VbmlLUy1VQ1MyLUggL05hbWUgL0YyIC9TdWJ0eXBlIC9UeXBlMCAvVHlwZSAvRm9udAo+PgplbmRvYmoKNCAwIG9iago8PAovQ29udGVudHMgOCAwIFIgL01lZGlhQm94IFsgMCAwIDYxMiA3OTIgXSAvUGFyZW50IDcgMCBSIC9SZXNvdXJjZXMgPDwKL0ZvbnQgMSAwIFIgL1Byb2NTZXQgWyAvUERGIC9UZXh0IC9JbWFnZUIgL0ltYWdlQyAvSW1hZ2VJIF0KPj4gL1JvdGF0ZSAwIC9UcmFucyA8PAoKPj4gCiAgL1R5cGUgL1BhZ2UKPj4KZW5kb2JqCjUgMCBvYmoKPDwKL1BhZ2VNb2RlIC9Vc2VOb25lIC9QYWdlcyA3IDAgUiAvVHlwZSAvQ2F0YWxvZwo+PgplbmRvYmoKNiAwIG9iago8PAovQXV0aG9yIChhbm9ueW1vdXMpIC9DcmVhdGlvbkRhdGUgKEQ6MjAyNjA4MDMxNDA2NDArMDknMDAnKSAvQ3JlYXRvciAoYW5vbnltb3VzKSAvS2V5d29yZHMgKCkgL01vZERhdGUgKEQ6MjAyNjA4MDMxNDA2NDArMDknMDAnKSAvUHJvZHVjZXIgKFJlcG9ydExhYiBQREYgTGlicmFyeSAtIFwob3BlbnNvdXJjZVwpKSAKICAvU3ViamVjdCAodW5zcGVjaWZpZWQpIC9UaXRsZSAodW50aXRsZWQpIC9UcmFwcGVkIC9GYWxzZQo+PgplbmRvYmoKNyAwIG9iago8PAovQ291bnQgMSAvS2lkcyBbIDQgMCBSIF0gL1R5cGUgL1BhZ2VzCj4+CmVuZG9iago4IDAgb2JqCjw8Ci9MZW5ndGggNDE0Cj4+CnN0cmVhbQoxIDAgMCAxIDAgMCBjbSAgQlQgL0YxIDEyIFRmIDE0LjQgVEwgRVQKQlQgL0YyIDMyIFRmIDM4LjQgVEwgRVQKQlQgMSAwIDAgMSA3MiA3MDAgVG0gL0YyIDMyIFRmIDM4LjQgVEwgKFwzMDYkXDMyNVwwMDRcMjY3fFwzMDd4XDAwMCBcMzAwXDI2NFwyNzBxXDAwMCBcMzI1XFxcMjU2XDAwMFwwMDAgXDI3MFwwMTRcMjYzVFwyNzFcMzAxKSBUaiBUKiBFVApCVCAvRjIgMjAgVGYgMjQgVEwgRVQKQlQgMSAwIDAgMSA3MiA2NTAgVG0gL0YyIDIwIFRmIDI0IFRMIChcMzAyK1wzMDdcMjIwXDAwMCBcMDAwMVwwMDAyXDAwMDNcMjU0XDM3NFwwMDAgXDMyNVxcXDI1NlwwMDBcMzA3dFwwMDAgXDMyNWhcMjU2XDMzMFwwMDAgXDI3NFwzNjRcMzA1XDM1NFwzMDV8XDAwMCBcMzI1aVwyNjJcMzEwXDI2MlwzNDRcMDAwLikgVGogVCogRVQKIAplbmRzdHJlYW0KZW5kb2JqCnhyZWYKMCA5CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDA2MSAwMDAwMCBuIAowMDAwMDAwMTAyIDAwMDAwIG4gCjAwMDAwMDAyMDkgMDAwMDAgbiAKMDAwMDAxMjQ4IDAwMDAwIG4gCjAwMDAwMDE0NDEgMDAwMDAgbiAKMDAwMDAwMTUwOSAwMDAwMCBuIAowMDAwMDAxNzcwIDAwMDAwIG4gCjAwMDAwMDE4MjkgMDAwMDAgbiAKdHJhaWxlcgo8PAovSUQgCls8ZTIyYzJhOTk5MDM4YzkwODY3N2E5MjVjNmRjZjY3NWQ+PGUyMmMyYTk5OTAzOGM5MDg2NzdhOTI1YzZkY2Y2NzVkPl0KJSBSZXBvcnRMYWIgZ2VuZXJhdGVkIFBERiBkb2N1bWVudCAtLSBkaWdlc3QgKG9wZW5zb3VyY2UpCgovSW5mbyA2IDAgUgovUm9vdCA1IDAgUgovU2l6ZSA5Cj4+CnN0YXJ0eHJlZgoyMjkyCiUlRU9GCg==', 'base64');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('offline-salon:interactive-studio-pro:v1'));
  await page.goto('/admin/session_demo');
});

test('new sessions enable only the activity modules selected for that gathering', async ({ page }) => {
  await page.goto('/admin');
  await page.getByPlaceholder('예: UNFRAME 6월 살롱').fill('9월 전시 모임');
  await page.locator('.session-module-picker label').filter({ hasText: '전시 포도' }).locator('input').check();
  await page.getByRole('button', { name: '새 세션 만들기' }).click();
  await expect(page).toHaveURL(/\/admin\/session_/);
  const enabledModules = await page.evaluate(() => {
    const sessionId = window.location.pathname.split('/').pop();
    return JSON.parse(localStorage.getItem('offline-salon:interactive-studio-pro:v1')).sessions[sessionId].enabledModules;
  });
  expect(enabledModules).toEqual(['exhibition-grape']);
});

test('exhibition grape sessions replace gallery images with an NFC exhibition builder', async ({ page }) => {
  await page.locator('.session-module-picker label').filter({ hasText: '전시 포도' }).locator('input').check();
  await expect(page.locator('.media-tabs').getByRole('button', { name: /전시 NFC/ })).toBeVisible();
  await expect(page.locator('.media-tabs').getByRole('button', { name: /갤러리 이미지/ })).toHaveCount(0);
  await page.locator('.media-tabs').getByRole('button', { name: /전시 NFC/ }).click();
  await page.getByPlaceholder('예: 마르크 샤갈 특별전').fill('빛이 머무는 자리');
  await page.getByPlaceholder('예: 예술의전당 한가람미술관').fill('아트 스페이스');
  await page.getByRole('button', { name: '전시 NFC 추가' }).click();
  await expect(page.locator('.exhibition-nfc-list article')).toHaveCount(1);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('offline-salon:interactive-studio-pro:v1')).sessions.session_demo.exhibitionNfcEntries[0]);
  expect(stored).toMatchObject({ title: '빛이 머무는 자리', venue: '아트 스페이스' });
  const url = new URL(await page.locator('.exhibition-nfc-list article code').textContent());
  expect(url.searchParams.get('n')).toBe(stored.id);
  expect(url.searchParams.has('title')).toBe(false);
  expect(new TextEncoder().encode(url.toString()).length).toBeLessThanOrEqual(120);
});

test('poster palette is saved and applied to the session theme', async ({ page }) => {
  const before = await page.locator('main.admin-session').evaluate((node) => node.style.getPropertyValue('--accent'));
  await page.locator('.poster-zone input[type="file"]').setInputFiles({ name: 'poster.png', mimeType: 'image/png', buffer: await imageBuffer(page) });
  await expect(page.locator('.palette-row i')).toHaveCount(3);
  await page.getByRole('button', { name: '포스터와 테마 적용' }).click();
  await expect.poll(() => page.locator('main.admin-session').evaluate((node) => node.style.getPropertyValue('--accent'))).not.toBe(before);
  await expect(page.locator('.theme-live-preview')).toBeVisible();
});

test('question activities can enable generic likes and participant result gallery', async ({ page }) => {
  await page.locator('.admin-workspace-tabs').getByRole('button', { name: /라이브 진행/ }).click();
  await page.locator('.question-card').first().getByRole('button', { name: '수정' }).click();
  await page.locator('.question-feature-toggles input[type="checkbox"]').nth(0).check();
  await page.locator('.question-feature-toggles input[type="checkbox"]').nth(1).check();
  await page.getByRole('button', { name: '질문 저장' }).click();
  await expect(page.locator('.question-card').first()).toContainText('♡ 좋아요');
  await expect(page.locator('.question-card').first()).toContainText('▦ 결과 갤러리');
  await expect.poll(() => page.evaluate(() => {
    const question = JSON.parse(localStorage.getItem('offline-salon:interactive-studio-pro:v1')).sessions.session_demo.questions[0];
    return { likesEnabled: question.likesEnabled, includeInGallery: question.includeInGallery };
  })).toEqual({ likesEnabled: true, includeInGallery: true });
});

test('gallery image is registered and presented without creating a title activity', async ({ page }) => {
  await page.locator('.media-tabs').getByRole('button', { name: /갤러리 이미지/ }).click();
  await page.locator('.media-upload-form input[type="file"]').setInputFiles({ name: 'artwork.png', mimeType: 'image/png', buffer: await imageBuffer(page, '#614ad9') });
  await page.getByPlaceholder('이미지 이름 (필수)').fill('테스트 이미지');
  await page.getByPlaceholder('작성자·출처 (선택)').fill('테스트 출처');
  await page.getByPlaceholder('이미지 설명').fill('테스트 설명');
  await page.getByRole('button', { name: '이미지 등록' }).click();
  const card = page.locator('.asset-card').filter({ hasText: '테스트 이미지' });
  await expect(card).toBeVisible();
  const data = await page.evaluate(() => JSON.parse(localStorage.getItem('offline-salon:interactive-studio-pro:v1')));
  const artwork = data.sessions.session_demo.artworks[0];
  expect(artwork.title).toBeUndefined();
  expect(artwork.displayTitle).toBe('테스트 이미지');
  expect(data.sessions.session_demo.artworkSecrets[artwork.id].title).toBe('테스트 이미지');
  await card.getByRole('button', { name: '화면에 띄우기' }).click();
  await page.locator('.admin-workspace-tabs').getByRole('button', { name: /라이브 진행/ }).click();
  await expect(page.locator('.stage-preview.stage-image')).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('offline-salon:interactive-studio-pro:v1')).sessions.session_demo;
    return { mode: session.stage.mode, artworkTitleQuestions: session.questions.filter((question) => question.type === 'artwork-title').length };
  })).toEqual({ mode: 'image', artworkTitleQuestions: 0 });
});

test('PDF is analyzed, linked and registered', async ({ page, context }) => {
  await page.locator('.media-tabs').getByRole('button', { name: /PDF/ }).click();
  await page.locator('.media-upload-form input[type="file"]').setInputFiles({ name: 'salon.pdf', mimeType: 'application/pdf', buffer: pdfBuffer() });
  await page.getByPlaceholder('발표 자료명').fill('살롱 발표 자료');
  await page.getByRole('button', { name: 'PDF 등록' }).click();
  const card = page.locator('.asset-card').filter({ hasText: '살롱 발표 자료' });
  await expect(card).toContainText('2 pages');
  await expect(card).toContainText('링크 1개');
  await card.getByRole('button', { name: '발표 시작' }).click();
  await page.locator('.admin-workspace-tabs').getByRole('button', { name: /라이브 진행/ }).click();
  await expect(page.locator('.stage-preview.stage-pdf')).toBeVisible();
  await expect(page.locator('.stage-preview.stage-pdf .salon-pdf-canvas')).toHaveClass(/ready/);
  await expect(page.locator('.operation-links').getByRole('link')).toHaveAttribute('href', 'https://example.com/');
  const previewCanvases = page.locator('.stage-preview.stage-pdf .salon-pdf-canvas canvas');
  await expect(previewCanvases).toHaveCount(2);
  const activeBefore = await previewCanvases.evaluateAll((canvases) => canvases.findIndex((canvas) => canvas.classList.contains('active')));
  const canvasStyle = await page.locator('.stage-preview.stage-pdf .salon-pdf-canvas canvas.active').evaluate((canvas) => ({ background: getComputedStyle(canvas).backgroundColor, transition: getComputedStyle(canvas).transitionDuration }));
  expect(canvasStyle.background).toBe('rgba(0, 0, 0, 0)');
  expect(canvasStyle.transition).not.toBe('0s');
  await page.locator('.live-operation-card').getByLabel('PDF 확대 배율').selectOption('3');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('offline-salon:interactive-studio-pro:v1')).sessions.session_demo.stage.zoom)).toBe(3);
  await page.locator('.live-operation-card').getByRole('button', { name: '다음 →' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('offline-salon:interactive-studio-pro:v1')).sessions.session_demo.stage.page)).toBe(2);
  await expect.poll(() => previewCanvases.evaluateAll((canvases) => canvases.findIndex((canvas) => canvas.classList.contains('active')))).not.toBe(activeBefore);

  await page.evaluate(() => {
    const key = 'offline-salon:interactive-studio-pro:v1';
    const state = JSON.parse(localStorage.getItem(key));
    state.sessions.session_demo.decks[0].title = '아주긴파일명이라도화면밖으로절대넘어가지않는오프라인살롱발표자료테스트';
    localStorage.setItem(key, JSON.stringify(state));
    localStorage.setItem('offline-salon:participantId:session_demo', 'pdf_mobile_guest');
    localStorage.setItem('offline-salon:nickname:session_demo', 'PDF 점검');
  });
  const clientPage = await context.newPage();
  await clientPage.setViewportSize({ width: 390, height: 844 });
  await clientPage.goto('/client/session_demo');
  await expect(clientPage.locator('.pdf-companion-card')).toBeVisible();
  const mobileLayout = await clientPage.evaluate(() => {
    const heading = document.querySelector('.pdf-companion-copy h1');
    const style = getComputedStyle(heading);
    return {
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      headingWidth: heading.getBoundingClientRect().width,
      viewportWidth: document.documentElement.clientWidth,
      fontSize: Number.parseFloat(style.fontSize),
      lineHeight: Number.parseFloat(style.lineHeight),
    };
  });
  expect(mobileLayout.horizontalOverflow).toBe(false);
  expect(mobileLayout.headingWidth).toBeLessThan(mobileLayout.viewportWidth);
  expect(mobileLayout.lineHeight).toBeGreaterThan(mobileLayout.fontSize);
  await clientPage.close();
});

test('Korean CID PDF has a bundled character map and renders', async ({ page, request }) => {
  await page.locator('.media-tabs').getByRole('button', { name: /PDF/ }).click();
  const cmapResponse = await request.get('/pdfjs/cmaps/UniKS-UCS2-H.bcmap');
  expect(cmapResponse.status()).toBe(200);
  await page.locator('.media-upload-form input[type="file"]').setInputFiles({
    name: 'korean-cid.pdf',
    mimeType: 'application/pdf',
    buffer: koreanCidPdfBuffer(),
  });
  await page.getByPlaceholder('발표 자료명').fill('한글 PDF 점검');
  await page.getByRole('button', { name: 'PDF 등록' }).click();
  const card = page.locator('.asset-card').filter({ hasText: '한글 PDF 점검' });
  await expect(card).toContainText('1 pages');
  await card.getByRole('button', { name: '발표 시작' }).click();
  await page.locator('.admin-workspace-tabs').getByRole('button', { name: /라이브 진행/ }).click();
  await expect(page.locator('.stage-preview.stage-pdf .salon-pdf-canvas')).toHaveClass(/ready/);
});

test('admin sections and mobile remote have no horizontal overflow', async ({ page }) => {
  for (const name of ['라이브 진행', '참여 현황', '접속·QR']) {
    await page.locator('.admin-workspace-tabs').getByRole('button', { name: new RegExp(name) }).click();
    await expect(page.locator('.admin-live-dock')).toBeVisible();
  }
  await expect(page.locator('.admin-qr-grid .qr-card')).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/remote/session_demo');
  await expect(page.getByText('연결됨')).toBeVisible();
  await expect(page.locator('.grape-remote-panel')).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
