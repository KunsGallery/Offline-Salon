import { useEffect, useState } from 'react';
import { realtime } from '../lib/realtime';

export function useArtworkSecrets(sessionId, enabled = true) {
  const [secrets, setSecrets] = useState(() => realtime.getArtworkSecrets?.(sessionId) || {});
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !realtime.subscribeArtworkSecrets) return undefined;
    setError(null);
    return realtime.subscribeArtworkSecrets(
      sessionId,
      (value) => setSecrets(value || {}),
      (reason) => setError(reason instanceof Error ? reason : new Error(String(reason))),
    );
  }, [enabled, sessionId]);

  return { secrets, error };
}
