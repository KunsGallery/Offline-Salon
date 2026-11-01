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

    const timer = window.setTimeout(() => {
      if (!active) return;
      setLoading(false);
      setError(new Error('로그인 상태 확인이 지연되고 있습니다. 연결 상태를 확인한 뒤 Google 로그인을 다시 시도해 주세요.'));
    }, 12000);

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
        window.clearTimeout(timer);
        setUser(nextUser);
        setError(null);
        setLoading(false);
      },
      (reason) => {
        if (!active) return;
        window.clearTimeout(timer);
        const nextError = reason instanceof Error ? reason : new Error(String(reason));
        setError(nextError);
        setLoading(false);
      },
    );

    return () => {
      active = false;
      window.clearTimeout(timer);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const loginWithGoogleAction = async () => {
    if (mode !== 'firestore' || !hasFirebaseAuth()) {
      throw new Error(authUnavailableMessage);
    }
    setError(null);
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
