import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase';

export const authUnavailableMessage =
  'Firebase Auth is unavailable. Check VITE_FIREBASE_* env vars and VITE_REALTIME_MODE=firestore.';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account',
});

export function hasFirebaseAuth() {
  return Boolean(auth);
}

export function getCurrentUser() {
  return auth?.currentUser || null;
}

export function subscribeAuth(callback, onError) {
  if (!auth) {
    callback(null);
    return () => {};
  }

  return onAuthStateChanged(auth, callback, (error) => {
    console.error('[auth] onAuthStateChanged error', error);
    onError?.(error);
  });
}

export function subscribeAuthState(callback, onError) {
  return subscribeAuth(callback, onError);
}

export async function loginWithGoogle() {
  if (!auth) {
    throw new Error(authUnavailableMessage);
  }

  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    console.warn('[auth] popup login failed, fallback to redirect', error);

    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      return signInWithRedirect(auth, provider);
    }

    throw error;
  }
}

export async function handleGoogleRedirectResult() {
  if (!auth) {
    return null;
  }

  try {
    return await getRedirectResult(auth);
  } catch (error) {
    console.error('[auth] redirect result error', error);
    throw error;
  }
}

export async function logoutUser() {
  if (!auth) return undefined;
  return signOut(auth);
}

export async function logout() {
  return logoutUser();
}

export function requireAdminUser() {
  if (!auth?.currentUser) {
    throw new Error('Admin authentication required.');
  }
  return auth.currentUser;
}
