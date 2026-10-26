// Lets Node load src/lib/realtime/firestoreAdapter.js as Vite would: extensionless
// relative imports resolve to .js, and the Firebase app/auth modules (which read
// import.meta.env and browser storage) are swapped for test stubs.
import { register } from 'node:module';

register('./hooks.mjs', import.meta.url);
