import { getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  inMemoryPersistence,
  getAuth,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const missingFirebaseConfig = Object.entries(firebaseConfig)
  .filter(([, value]) => !value).map(([key]) => key);

// Initialization must never prevent React from rendering the login/error screen.
let initializedApp = null;
let initializedAuth = null;
let initializedDb = null;
let initializationError = null;
try {
  if (missingFirebaseConfig.length === 0) {
    initializedApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    try {
      initializedAuth = initializeAuth(initializedApp, {
        persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
        popupRedirectResolver: browserPopupRedirectResolver,
      });
    } catch (error) {
      if (error?.code !== 'auth/already-initialized') throw error;
      initializedAuth = getAuth(initializedApp);
    }
    initializedDb = getFirestore(initializedApp);
  }
} catch (error) {
  initializationError = error;
  console.error('[firebase] initialization failed', error);
}

export const app = initializedApp;
export const db = initializedDb;
export const auth = initializedAuth;
export const firebaseInitializationError = initializationError;
