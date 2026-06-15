import { useEffect, useState } from 'react';
import { mode, realtime } from '../lib/realtime';

export function useParticipants(sessionId) {
  const [participants, setParticipants] = useState(() => realtime.getParticipants?.(sessionId) || []);
  const [loading, setLoading] = useState(() => mode === 'firestore');
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setParticipants(realtime.getParticipants?.(sessionId) || []);
    setLoading(mode === 'firestore');
    setError(null);

    try {
      const unsubscribe = realtime.subscribeParticipants(
        sessionId,
        (value) => {
          if (!active) return;
          setParticipants(value);
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

  return { participants, loading, error };
}
