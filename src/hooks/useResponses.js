import { useEffect, useState } from 'react';
import { mode, realtime } from '../lib/realtime';

export function useResponses(sessionId, questionId = null) {
  const [responses, setResponses] = useState(() =>
    questionId ? realtime.getResponsesByQuestion?.(sessionId, questionId) || [] : [],
  );
  const [loading, setLoading] = useState(() => mode === 'firestore' && Boolean(questionId));
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setResponses(questionId ? realtime.getResponsesByQuestion?.(sessionId, questionId) || [] : []);
    setLoading(mode === 'firestore' && Boolean(questionId));
    setError(null);

    if (questionId) {
      try {
        const unsubscribe = realtime.subscribeResponsesByQuestion(
          sessionId,
          questionId,
          (value) => {
            if (!active) return;
            setResponses(value);
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
    }
    setResponses([]);
    setLoading(false);
    return undefined;
  }, [sessionId, questionId]);

  return { responses, loading, error };
}

export function useAllResponses(sessionId, enabled = true) {
  const [responses, setResponses] = useState(() => enabled ? realtime.getResponses?.(sessionId) || [] : []);
  const [loading, setLoading] = useState(() => mode === 'firestore' && enabled);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setResponses(enabled ? realtime.getResponses?.(sessionId) || [] : []);
    setLoading(mode === 'firestore' && enabled);
    setError(null);
    if (!enabled) return undefined;

    try {
      const unsubscribe = realtime.subscribeResponses(
        sessionId,
        (value) => {
          if (!active) return;
          setResponses(value);
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
  }, [enabled, sessionId]);

  return { responses, loading, error };
}
