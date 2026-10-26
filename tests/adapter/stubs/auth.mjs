// Stand-in for src/lib/auth.js. Tests choose the signed-in user; the matching emulator
// context carries the same uid and token, so security rules see the same identity.
let currentUser = null;

export function useUser(user) {
  currentUser = user;
}

export function getCurrentUser() {
  return currentUser;
}

export async function ensureParticipantUser() {
  if (!currentUser) throw new Error('No signed-in test user.');
  return currentUser;
}

export function requireAdminUser() {
  if (!currentUser || currentUser.isAnonymous) throw new Error('Admin authentication required.');
  return currentUser;
}
