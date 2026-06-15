import { useEffect, useState } from 'react';
import { mode, realtime } from '../lib/realtime';

export function useQuestions(sessionId) {
  const [questions, setQuestions] = useState(() => realtime.getQuestions?.(sessionId) || []);
  const [loading, setLoading] = useState(() => mode === 'firestore');
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setQuestions(realtime.getQuestions?.(sessionId) || []);
    setLoading(mode === 'firestore');
    setError(null);

    try {
      const unsubscribe = realtime.subscribeQuestions(
        sessionId,
        (value) => {
          if (!active) return;
          setQuestions(value);
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

  return { questions, loading, error };
}
