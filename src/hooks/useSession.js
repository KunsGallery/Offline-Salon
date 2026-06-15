import { useEffect, useState } from 'react';
import { mode, realtime } from '../lib/realtime';

export function useSession(sessionId) {
  const initialSession = realtime.getSession?.(sessionId);
  const [session, setSession] = useState(() => initialSession);
  const [loading, setLoading] = useState(() => mode === 'firestore' && initialSession === undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const current = realtime.getSession?.(sessionId);
    setSession(current);
    setLoading(mode === 'firestore' && current === undefined);
    setError(null);

    try {
      const unsubscribe = realtime.subscribeSession(
        sessionId,
        (value) => {
          if (!active) return;
          setSession(value);
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
    } catch (reason) {
      if (active) {
        const nextError = reason instanceof Error ? reason : new Error(String(reason));
        setError(nextError);
        setLoading(false);
      }
      return undefined;
    }
  }, [sessionId]);

  return { session, loading, error };
}
