// Security rules tests for firestore.rules.auth.example.
// Run with `npm run test:rules` (needs Java for the Firestore emulator).
// Write payloads mirror src/lib/realtime/firestoreAdapter.js so rule changes that would
// break the app fail here.

import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteDoc, deleteField, doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

const ADMIN_EMAIL = 'your-admin-email@example.com';
const SESSION = 'sessions/s1';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-offline-salon',
    firestore: { rules: readFileSync(new URL('../../firestore.rules.auth.example', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, SESSION), { title: 'Salon', stage: { mode: 'lobby' }, checkinApplications: [{ id: 'a1', name: 'Legacy' }] });
    await setDoc(doc(db, `${SESSION}/questions/q-like`), { title: 'Q', type: 'text', likesEnabled: true });
    await setDoc(doc(db, `${SESSION}/questions/q-plain`), { title: 'Q', type: 'text', likesEnabled: false });
    await setDoc(doc(db, `${SESSION}/participants/p-alice`), { uid: 'alice', nickname: 'Alice' });
    await setDoc(doc(db, `${SESSION}/participants/p-bob`), { uid: 'bob', nickname: 'Bob' });
    await setDoc(doc(db, `${SESSION}/participants/p-legacy`), { nickname: 'Legacy' });
    await setDoc(doc(db, `${SESSION}/responses/r-alice`), { questionId: 'q-like', participantId: 'p-alice', nickname: 'Alice', value: 'hello', hidden: false, likes: 0, likedBy: {} });
    await setDoc(doc(db, `${SESSION}/responses/r-alice-plain`), { questionId: 'q-plain', participantId: 'p-alice', nickname: 'Alice', value: 'hi', hidden: false, likes: 0, likedBy: {} });
    await setDoc(doc(db, `${SESSION}/checkins/a1`), { id: 'a1', name: '홍길동', email: 'hong@example.com', phoneLast4: '1234' });
  });
});

const admin = () => env.authenticatedContext('admin-uid', { email: ADMIN_EMAIL, email_verified: true }).firestore();
const google = () => env.authenticatedContext('stranger-uid', { email: 'someone@example.com', email_verified: true }).firestore();
const alice = () => env.authenticatedContext('alice', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const bob = () => env.authenticatedContext('bob', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const carol = () => env.authenticatedContext('carol', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const guest = () => env.unauthenticatedContext().firestore();

describe('sessions', () => {
  test('anyone can read the session document', async () => {
    await assertSucceeds(getDoc(doc(guest(), SESSION)));
  });

  test('only allowlisted admins can update the session', async () => {
    await assertSucceeds(updateDoc(doc(admin(), SESSION), { title: 'New', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(google(), SESSION), { title: 'New' }));
    await assertFails(updateDoc(doc(alice(), SESSION), { title: 'New' }));
  });

  test('admin can remove the legacy roster from the session document', async () => {
    await assertSucceeds(updateDoc(doc(admin(), SESSION), { checkinApplications: deleteField() }));
  });

  test('unverified admin email is not an admin', async () => {
    const unverified = env.authenticatedContext('x', { email: ADMIN_EMAIL, email_verified: false }).firestore();
    await assertFails(updateDoc(doc(unverified, SESSION), { title: 'New' }));
  });
});

describe('checkins', () => {
  test('roster is unreadable by guests, participants and non-admin Google users', async () => {
    await assertFails(getDoc(doc(guest(), `${SESSION}/checkins/a1`)));
    await assertFails(getDoc(doc(alice(), `${SESSION}/checkins/a1`)));
    await assertFails(getDoc(doc(google(), `${SESSION}/checkins/a1`)));
  });

  test('roster is writable only by admins', async () => {
    await assertSucceeds(getDoc(doc(admin(), `${SESSION}/checkins/a1`)));
    await assertSucceeds(setDoc(doc(admin(), `${SESSION}/checkins/a2`), { id: 'a2', name: '김철수', checkedIn: true }));
    await assertFails(setDoc(doc(alice(), `${SESSION}/checkins/a3`), { id: 'a3', name: 'Fake', checkedIn: true }));
  });
});

describe('participants', () => {
  const joinPayload = (uid) => ({ lastSeenAt: serverTimestamp(), uid, nickname: 'Carol', avatar: { version: 3, species: 'rat' }, joinedAt: serverTimestamp() });

  test('participant joins with their own uid', async () => {
    await assertSucceeds(setDoc(doc(carol(), `${SESSION}/participants/p-carol`), joinPayload('carol'), { merge: true }));
  });

  test('participant cannot join with someone else\'s uid or extra fields', async () => {
    await assertFails(setDoc(doc(carol(), `${SESSION}/participants/p-carol`), joinPayload('alice'), { merge: true }));
    await assertFails(setDoc(doc(carol(), `${SESSION}/participants/p-carol`), { ...joinPayload('carol'), role: 'admin' }, { merge: true }));
    await assertFails(setDoc(doc(guest(), `${SESSION}/participants/p-guest`), { lastSeenAt: serverTimestamp(), nickname: 'Guest' }, { merge: true }));
  });

  test('owner updates their document; others cannot', async () => {
    await assertSucceeds(setDoc(doc(alice(), `${SESSION}/participants/p-alice`), { lastSeenAt: serverTimestamp(), uid: 'alice', nickname: 'Alice 2' }, { merge: true }));
    await assertFails(setDoc(doc(bob(), `${SESSION}/participants/p-alice`), { lastSeenAt: serverTimestamp(), uid: 'bob', nickname: 'Hacked' }, { merge: true }));
    await assertFails(setDoc(doc(bob(), `${SESSION}/participants/p-alice`), { nickname: 'Hacked' }, { merge: true }));
  });

  test('owner cannot hand their document to another uid', async () => {
    await assertFails(setDoc(doc(alice(), `${SESSION}/participants/p-alice`), { lastSeenAt: serverTimestamp(), uid: 'bob' }, { merge: true }));
  });

  test('participant without a stored uid cannot be claimed', async () => {
    await assertFails(setDoc(doc(alice(), `${SESSION}/participants/p-legacy`), { lastSeenAt: serverTimestamp(), uid: 'alice' }, { merge: true }));
  });

  const uploaded = {
    status: 'uploaded', photoUrl: 'https://assets.example.com/sessions/s1/pear/p/photo.jpg', photoPath: null,
    analysis: null, candidates: [], finalArtwork: null, connection: '', statement: '', keywords: [], error: '',
    createdAt: '2026-10-26T00:00:00.000Z', updatedAt: '2026-10-26T00:00:00.000Z',
  };

  test('participant hands in one PEAR photo but cannot forge results', async () => {
    const ref = doc(alice(), `${SESSION}/participants/p-alice`);
    await assertFails(setDoc(ref, { lastSeenAt: serverTimestamp(), uid: 'alice', pearPairing: { ...uploaded, status: 'ready', finalArtwork: { title: 'Fake' } } }, { merge: true }));
    await assertSucceeds(setDoc(ref, { lastSeenAt: serverTimestamp(), uid: 'alice', nickname: 'Alice', pearPairing: uploaded }, { merge: true }));
    await assertFails(setDoc(ref, { lastSeenAt: serverTimestamp(), uid: 'alice', pearPairing: { ...uploaded, photoUrl: 'https://assets.example.com/sessions/s1/pear/p/other.jpg' } }, { merge: true }));
  });

  test('admin records the analysis and the owner can still check in', async () => {
    await assertSucceeds(setDoc(doc(alice(), `${SESSION}/participants/p-alice`), { lastSeenAt: serverTimestamp(), uid: 'alice', pearPairing: uploaded }, { merge: true }));
    const result = { ...uploaded, status: 'ready', finalArtwork: { title: 'Real' }, candidates: [{ id: 'c1' }] };
    await assertSucceeds(setDoc(doc(admin(), `${SESSION}/participants/p-alice`), { lastSeenAt: serverTimestamp(), nickname: 'Alice', pearPairing: result }, { merge: true }));
    await assertSucceeds(setDoc(doc(alice(), `${SESSION}/participants/p-alice`), { lastSeenAt: serverTimestamp(), uid: 'alice' }, { merge: true }));
    await assertFails(setDoc(doc(alice(), `${SESSION}/participants/p-alice`), { lastSeenAt: serverTimestamp(), uid: 'alice', pearPairing: null }, { merge: true }));
  });

  test('participant may hand in again after a failed analysis', async () => {
    await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), `${SESSION}/participants/p-alice`), { pearPairing: { ...uploaded, status: 'error', error: 'failed' } }, { merge: true }));
    await assertSucceeds(setDoc(doc(alice(), `${SESSION}/participants/p-alice`), { lastSeenAt: serverTimestamp(), uid: 'alice', pearPairing: uploaded }, { merge: true }));
  });

  test('only admins delete participants', async () => {
    await assertFails(deleteDoc(doc(alice(), `${SESSION}/participants/p-alice`)));
    await assertSucceeds(deleteDoc(doc(admin(), `${SESSION}/participants/p-alice`)));
  });
});

describe('responses', () => {
  const newResponse = (participantId, overrides = {}) => ({
    questionId: 'q-like', participantId, nickname: 'x', value: 'answer', hidden: false, likes: 0, likedBy: {},
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...overrides,
  });

  test('participant answers as themselves', async () => {
    await assertSucceeds(setDoc(doc(bob(), `${SESSION}/responses/r-new`), newResponse('p-bob')));
  });

  test('participant cannot answer as someone else or preset moderation and likes', async () => {
    await assertFails(setDoc(doc(bob(), `${SESSION}/responses/r-new`), newResponse('p-alice')));
    await assertFails(setDoc(doc(carol(), `${SESSION}/responses/r-new`), newResponse('p-carol')));
    await assertFails(setDoc(doc(bob(), `${SESSION}/responses/r-new`), newResponse('p-bob', { likes: 5 })));
    await assertFails(setDoc(doc(bob(), `${SESSION}/responses/r-new`), newResponse('p-bob', { likedBy: { 'p-alice': true } })));
    await assertFails(setDoc(doc(bob(), `${SESSION}/responses/r-new`), newResponse('p-bob', { hidden: true })));
    await assertFails(setDoc(doc(guest(), `${SESSION}/responses/r-new`), newResponse('p-bob')));
  });

  test('owner edits the answer only', async () => {
    const ref = doc(alice(), `${SESSION}/responses/r-alice`);
    await assertSucceeds(updateDoc(ref, { value: 'edited', nickname: 'Alice', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { hidden: true, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { likes: 99, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(ref, { participantId: 'p-bob', updatedAt: serverTimestamp() }));
  });

  test('others cannot edit the answer', async () => {
    await assertFails(updateDoc(doc(bob(), `${SESSION}/responses/r-alice`), { value: 'hacked', updatedAt: serverTimestamp() }));
  });

  test('participant toggles exactly their own like', async () => {
    const ref = doc(bob(), `${SESSION}/responses/r-alice`);
    await assertSucceeds(updateDoc(ref, { likedBy: { 'p-bob': true }, likes: 1, likeActor: 'p-bob', updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { likedBy: {}, likes: 0, likeActor: 'p-bob', updatedAt: serverTimestamp() }));
  });

  test('like forgery is rejected', async () => {
    const ref = doc(bob(), `${SESSION}/responses/r-alice`);
    // Someone else's key.
    await assertFails(updateDoc(ref, { likedBy: { 'p-carol': true }, likes: 1, likeActor: 'p-bob', updatedAt: serverTimestamp() }));
    // Acting as a participant bob does not own.
    await assertFails(updateDoc(ref, { likedBy: { 'p-carol': true }, likes: 1, likeActor: 'p-carol', updatedAt: serverTimestamp() }));
    // Several likes at once.
    await assertFails(updateDoc(ref, { likedBy: { 'p-bob': true, 'p-carol': true }, likes: 2, likeActor: 'p-bob', updatedAt: serverTimestamp() }));
    // Inflated count.
    await assertFails(updateDoc(ref, { likedBy: { 'p-bob': true }, likes: 50, likeActor: 'p-bob', updatedAt: serverTimestamp() }));
    // Sneaking an answer change into a like.
    await assertFails(updateDoc(ref, { likedBy: { 'p-bob': true }, likes: 1, likeActor: 'p-bob', value: 'hacked', updatedAt: serverTimestamp() }));
  });

  test('self likes and likes on questions without voting are rejected', async () => {
    await assertFails(updateDoc(doc(alice(), `${SESSION}/responses/r-alice`), { likedBy: { 'p-alice': true }, likes: 1, likeActor: 'p-alice', updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(bob(), `${SESSION}/responses/r-alice-plain`), { likedBy: { 'p-bob': true }, likes: 1, likeActor: 'p-bob', updatedAt: serverTimestamp() }));
  });

  test('admin moderates and deletes responses', async () => {
    await assertSucceeds(updateDoc(doc(admin(), `${SESSION}/responses/r-alice`), { hidden: true, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(bob(), `${SESSION}/responses/r-alice`)));
    await assertSucceeds(deleteDoc(doc(admin(), `${SESSION}/responses/r-alice`)));
  });
});

describe('admin-only collections', () => {
  test('artwork secrets stay private', async () => {
    await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), `${SESSION}/artworkSecrets/w1`), { title: 'Secret' }));
    await assertFails(getDoc(doc(guest(), `${SESSION}/artworkSecrets/w1`)));
    await assertFails(getDoc(doc(alice(), `${SESSION}/artworkSecrets/w1`)));
    await assertSucceeds(getDoc(doc(admin(), `${SESSION}/artworkSecrets/w1`)));
  });

  test('participants cannot write questions', async () => {
    await assertFails(setDoc(doc(alice(), `${SESSION}/questions/q-new`), { title: 'Spam' }));
  });

  test('prepared PEAR cases are public to read and admin-only to write', async () => {
    const pearCase = { title: 'Case', pearPairing: { status: 'uploaded', photoUrl: 'https://r2.example.com/sessions/s1/pear/a.jpg' } };
    await assertSucceeds(setDoc(doc(admin(), `${SESSION}/pearCases/c1`), pearCase));
    await assertSucceeds(getDoc(doc(guest(), `${SESSION}/pearCases/c1`)));
    await assertFails(setDoc(doc(alice(), `${SESSION}/pearCases/c2`), pearCase));
    await assertFails(updateDoc(doc(google(), `${SESSION}/pearCases/c1`), { title: 'Forged' }));
    await assertFails(deleteDoc(doc(alice(), `${SESSION}/pearCases/c1`)));
    await assertSucceeds(deleteDoc(doc(admin(), `${SESSION}/pearCases/c1`)));
  });
});
