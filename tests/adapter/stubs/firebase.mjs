// Stand-in for src/lib/firebase.js. Tests point `db` at an emulator context.
export let db = null;
export const app = null;
export const auth = null;

export function useDb(next) {
  db = next;
}
