import { test, expect } from '@playwright/test';

async function firestoreMode(page) {
  await page.route(/\/src\/lib\/realtime(?:\/index\.js)?(?:\?.*)?$/, (route) => route.fulfill({ contentType: 'text/javascript', body: "export const mode = 'firestore'; export const realtime = {};" }));
}

async function anonymousAuth(page, { stalled = false } = {}) {
  await firestoreMode(page);
  await page.route(/\/src\/lib\/firebase\.js(?:\?.*)?$/, (route) => route.fulfill({ contentType: 'text/javascript', body: "export const auth = { currentUser: { uid: 'guest', isAnonymous: true } }; export const missingFirebaseConfig = []; export const firebaseInitializationError = null;" }));
  await page.route(/\/node_modules\/\.vite\/deps\/firebase_auth\.js(?:\?.*)?$/, (route) => route.fulfill({ contentType: 'text/javascript', body: `
    export class GoogleAuthProvider { setCustomParameters() {} }
    export const getRedirectResult = async () => null;
    export const onAuthStateChanged = (auth, callback) => { ${stalled ? '' : 'queueMicrotask(() => callback(auth.currentUser));'} return () => {}; };
    export const signInAnonymously = async () => ({});
    export const signInWithPopup = async () => { window.popupCalls = (window.popupCalls || 0) + 1; throw Object.assign(new Error('Firebase: Error (auth/popup-closed-by-user).'), { code: 'auth/popup-closed-by-user' }); };
    export const signInWithRedirect = async () => { window.redirectCalls = (window.redirectCalls || 0) + 1; };
    export const signOut = async () => {};
  ` }));
}

test('anonymous participant reaches a stable admin login and can reopen the Google popup', async ({ page }) => {
  await anonymousAuth(page);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
  const button = page.getByRole('button', { name: 'Google로 로그인', exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.locator('.error-text')).toContainText('auth/popup-closed-by-user');
  await button.click();
  await expect.poll(() => page.evaluate(() => window.popupCalls)).toBe(2);
  expect(await page.evaluate(() => window.redirectCalls || 0)).toBe(0);
  await expect(page).toHaveURL(/\/login$/);
});

test('a stalled auth observer releases the login button instead of waiting forever', async ({ page }) => {
  await page.clock.install();
  await anonymousAuth(page, { stalled: true });
  await page.goto('/login');
  await expect(page.getByText('로그인 상태를 확인하는 중입니다.')).toBeVisible();
  await page.clock.fastForward(13000);
  await expect(page.getByRole('button', { name: 'Google로 로그인', exact: true })).toBeEnabled();
  await expect(page.locator('.error-text')).toContainText('로그인 상태 확인이 지연');
});

test('invalid Firebase initialization renders the login error screen rather than crashing React', async ({ page }) => {
  await firestoreMode(page);
  await page.route(/\/src\/lib\/firebase\.js(?:\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/(?:export )?const firebaseConfig = \{[\s\S]*?\};/, `export const firebaseConfig = { apiKey: 'invalid:key', authDomain: 'demo.firebaseapp.com', projectId: 'demo', messagingSenderId: '1', appId: 'demo' };`);
    await route.fulfill({ response, body });
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '관리자 로그인', exact: true })).toBeVisible();
  await expect(page.locator('.error-text')).toContainText('auth/invalid-api-key');
  expect(errors).toEqual([]);
});
