import { localAdapter } from './localAdapter';
import { firestoreAdapter } from './firestoreAdapter';

const mode = import.meta.env.VITE_REALTIME_MODE || 'local';

export const realtime = mode === 'firestore' ? firestoreAdapter : localAdapter;
export { mode };

