import { useEffect, useState } from 'react';
import { mode, realtime } from '../lib/realtime';

export function useSessions() {
  const [sessions, setSessions] = useState(() => realtime.listSessions?.() || []);
  const [loading, setLoading] = useState(() => mode === 'firestore');
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setSessions(realtime.listSessions?.() || []);
    setLoading(mode === 'firestore');
    setError(null);

    try {
      const unsubscribe = realtime.subscribeSessions(
        (value) => {
          if (!active) return;
          setSessions(value);
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
  }, []);

  return { sessions, loading, error };
}
