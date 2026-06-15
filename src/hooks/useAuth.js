import { useEffect, useState } from 'react';
import { mode } from '../lib/realtime';
import {
  authUnavailableMessage,
  hasFirebaseAuth,
  handleGoogleRedirectResult,
  loginWithGoogle,
  logoutUser,
  subscribeAuth,
} from '../lib/auth';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(mode === 'firestore' && hasFirebaseAuth());
  const [error, setError] = useState(mode === 'firestore' && !hasFirebaseAuth() ? new Error(authUnavailableMessage) : null);

  useEffect(() => {
    if (mode !== 'firestore' || !hasFirebaseAuth()) {
      setUser(null);
      setLoading(false);
      if (mode === 'firestore' && !hasFirebaseAuth()) {
        setError(new Error(authUnavailableMessage));
      }
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        await handleGoogleRedirectResult();
      } catch (reason) {
        if (!active) return;
        const nextError = reason instanceof Error ? reason : new Error(String(reason));
        setError(nextError);
      }
    })();

    const unsubscribe = subscribeAuth(
      (nextUser) => {
        if (!active) return;
        setUser(nextUser);
        setLoading(false);
      },
      (reason) => {
        if (!active) return;
        const nextError = reason instanceof Error ? reason : new Error(String(reason));
        setError(nextError);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const loginWithGoogleAction = async () => {
    if (mode !== 'firestore' || !hasFirebaseAuth()) {
      throw new Error(authUnavailableMessage);
    }
    return loginWithGoogle();
  };

  const logout = async () => {
    if (mode !== 'firestore' || !hasFirebaseAuth()) return undefined;
    return logoutUser();
  };

  return {
    user,
    loading,
    error,
    login: loginWithGoogleAction,
    loginWithGoogle: loginWithGoogleAction,
    logout,
  };
}
