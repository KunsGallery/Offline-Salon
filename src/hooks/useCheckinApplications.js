import { useEffect, useState } from 'react';
import { mode, realtime } from '../lib/realtime';

export function useCheckinApplications(sessionId) {
  const initial = realtime.getCheckinApplications?.(sessionId);
  const [applications, setApplications] = useState(() => initial || []);
  const [loading, setLoading] = useState(() => mode === 'firestore' && initial === undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const current = realtime.getCheckinApplications?.(sessionId);
    setApplications(current || []);
    setLoading(mode === 'firestore' && current === undefined);
    setError(null);

    try {
      const unsubscribe = realtime.subscribeCheckinApplications(
        sessionId,
        (value) => {
          if (!active) return;
          setApplications(value || []);
          setLoading(false);
        },
        (reason) => {
          if (!active) return;
          setError(reason instanceof Error ? reason : new Error(String(reason)));
          setLoading(false);
        },
      );
      return () => {
        active = false;
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    } catch (reason) {
      if (active) {
        setError(reason instanceof Error ? reason : new Error(String(reason)));
        setLoading(false);
      }
      return undefined;
    }
  }, [sessionId]);

  return { applications, loading, error };
}
