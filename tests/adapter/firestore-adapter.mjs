// Runs src/lib/realtime/firestoreAdapter.js against the Firestore emulator with
// firestore.rules.auth.example loaded, so every adapter write must pass the real rules.
// Run with `npm run test:rules` (needs Java for the Firestore emulator).

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore';
import { useDb } from './stubs/firebase.mjs';
import { useUser } from './stubs/auth.mjs';

const { firestoreAdapter: adapter } = await import('../../src/lib/realtime/firestoreAdapter.js');

const ADMIN_EMAIL = 'your-admin-email@example.com';

let env;
const contexts = {};

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-offline-salon',
    firestore: { rules: readFileSync(new URL('../../firestore.rules.auth.example', import.meta.url), 'utf8') },
  });
  await env.clearFirestore();
  contexts.admin = env.authenticatedContext('admin-uid', { email: ADMIN_EMAIL, email_verified: true }).firestore();
  contexts.alice = env.authenticatedContext('alice', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  contexts.bob = env.authenticatedContext('bob', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
  contexts.guest = env.unauthenticatedContext().firestore();
});

after(async () => {
  await env?.cleanup();
});

function as(name) {
  useDb(contexts[name]);
  if (name === 'guest') useUser(null);
  else useUser({ uid: name === 'admin' ? 'admin-uid' : name, isAnonymous: name !== 'admin', email: name === 'admin' ? ADMIN_EMAIL : null });
  return contexts[name];
}

function seed(path, data) {
  return env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), path), data));
}

async function raw(path) {
  let data;
  await env.withSecurityRulesDisabled(async (context) => {
    const snap = await getDoc(doc(context.firestore(), path));
    data = snap.exists() ? snap.data() : null;
  });
  return data;
}

async function rawIds(path) {
  let ids;
  await env.withSecurityRulesDisabled(async (context) => {
    ids = (await getDocs(collection(context.firestore(), path))).docs.map((item) => item.id).sort();
  });
  return ids;
}

// Resolves with the first callback value that satisfies `predicate`.
function waitFor(subscribe, predicate) {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    let done = false;
    const timer = setTimeout(() => {
      done = true;
      unsubscribe();
      reject(new Error('Timed out waiting for subscription value.'));
    }, 5000);
    unsubscribe = subscribe((value) => {
      if (done || !predicate(value)) return;
      done = true;
      clearTimeout(timer);
      queueMicrotask(() => unsubscribe());
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

describe('sessions', () => {
  test('new sessions keep the roster and prepared cases out of the session document', async () => {
    as('admin');
    await adapter.createSession({ id: 'new-session', title: 'Salon' });
    const data = await raw('sessions/new-session');
    assert.equal(data.title, 'Salon');
    assert.equal('checkinApplications' in data, false);
    assert.equal('pearPreparedCases' in data, false);
  });
});

describe('check-in roster', () => {
  test('legacy roster moves into the admin-only subcollection', async () => {
    await seed('sessions/legacy-roster', {
      title: 'Legacy',
      stage: { mode: 'lobby' },
      checkinApplications: [{ id: 'a1', name: '홍길동', email: 'hong@example.com', checkinToken: 'SALON-A1' }],
    });
    await seed('sessions/legacy-roster/checkins/a2', { id: 'a2', name: '김철수' });
    as('admin');
    const roster = await waitFor(
      (cb, onError) => adapter.subscribeCheckinApplications('legacy-roster', cb, onError),
      (items) => items.length === 2,
    );
    assert.deepEqual(roster.map((item) => item.id).sort(), ['a1', 'a2']);
    assert.equal('checkinApplications' in (await raw('sessions/legacy-roster')), false);
  });

  test('admin adds, checks in, undoes and deletes applications', async () => {
    await seed('sessions/roster', { title: 'Roster', stage: { mode: 'lobby' } });
    as('admin');
    const application = await adapter.upsertCheckinApplication('roster', { id: 'app_1', name: '이영희', email: 'lee@example.com' });
    assert.ok(application.checkinToken);

    const first = await adapter.checkInApplication('roster', application.checkinToken);
    assert.equal(first.status, 'checked-in');
    const second = await adapter.checkInApplication('roster', application.checkinToken);
    assert.equal(second.status, 'already');
    assert.equal((await raw('sessions/roster/checkins/app_1')).checkedIn, true);

    await adapter.undoCheckInApplication('roster', 'app_1');
    assert.equal((await raw('sessions/roster/checkins/app_1')).checkedIn, false);

    await adapter.deleteCheckinApplication('roster', 'app_1');
    assert.deepEqual(await rawIds('sessions/roster/checkins'), []);
  });

  test('participants cannot subscribe to the roster', async () => {
    await seed('sessions/roster-private', { title: 'Private', stage: { mode: 'lobby' } });
    await seed('sessions/roster-private/checkins/a1', { id: 'a1', name: '홍길동' });
    as('alice');
    await assert.rejects(waitFor(
      (cb, onError) => adapter.subscribeCheckinApplications('roster-private', cb, onError),
      () => true,
    ), /permission/i);
  });
});

describe('participants and responses', () => {
  before(async () => {
    await seed('sessions/live', { title: 'Live', stage: { mode: 'questions' }, allowMultipleSubmissions: false });
    as('admin');
    await setDoc(doc(contexts.admin, 'sessions/live/questions/q-like'), { title: 'Q', type: 'text', likesEnabled: true, order: 0 });
  });

  test('participants join, answer, edit and like through the adapter', async () => {
    as('alice');
    await adapter.upsertParticipant('live', 'p-alice', { nickname: 'Alice' });
    assert.equal((await raw('sessions/live/participants/p-alice')).uid, 'alice');
    const response = await adapter.createResponse('live', { questionId: 'q-like', participantId: 'p-alice', nickname: 'Alice', value: 'first' });

    const resubmitted = await adapter.createResponse('live', { questionId: 'q-like', participantId: 'p-alice', nickname: 'Alice', value: 'second' });
    assert.equal(resubmitted.id, response.id);
    await adapter.updateOwnResponse('live', response.id, 'p-alice', { value: 'third' });
    assert.equal((await raw(`sessions/live/responses/${response.id}`)).value, 'third');

    as('bob');
    await adapter.upsertParticipant('live', 'p-bob', { nickname: 'Bob' });
    await adapter.toggleResponseLike('live', response.id, 'p-bob');
    let stored = await raw(`sessions/live/responses/${response.id}`);
    assert.equal(stored.likes, 1);
    assert.deepEqual(stored.likedBy, { 'p-bob': true });
    await adapter.toggleResponseLike('live', response.id, 'p-bob');
    stored = await raw(`sessions/live/responses/${response.id}`);
    assert.equal(stored.likes, 0);
  });

  test('a participant cannot act through someone else\'s participant document', async () => {
    as('bob');
    await assert.rejects(adapter.upsertParticipant('live', 'p-alice', { nickname: 'Not Alice' }), /permission/i);
    await assert.rejects(adapter.createResponse('live', { questionId: 'q-like', participantId: 'p-alice', value: 'forged' }), /permission/i);
  });

  test('admin writes the PEAR analysis onto a participant', async () => {
    as('alice');
    await adapter.upsertParticipant('live', 'p-alice', { pearPairing: { status: 'uploaded', photoUrl: 'https://r2.example.com/sessions/live/pear/a.jpg' } });
    as('admin');
    await adapter.upsertParticipant('live', 'p-alice', { pearPairing: { status: 'ready', photoUrl: 'https://r2.example.com/sessions/live/pear/a.jpg', finalArtwork: { title: 'Work' } } }, { admin: true });
    const stored = await raw('sessions/live/participants/p-alice');
    assert.equal(stored.pearPairing.status, 'ready');
    assert.equal(stored.uid, 'alice');
  });
});

describe('prepared PEAR cases', () => {
  const ready = (title) => ({ status: 'ready', photoUrl: 'https://r2.example.com/p.jpg', finalArtwork: { title, imageUrl: 'https://r2.example.com/w.jpg' } });

  test('legacy cases migrate and the session shows subcollection cases', async () => {
    await seed('sessions/pear', {
      title: 'Pear',
      stage: { mode: 'pear-play', pearPreparedCaseId: 'case-old' },
      pearPreparedCases: [{ id: 'case-old', title: 'Old', pearPairing: ready('Old work'), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
    });
    as('admin');
    const created = await adapter.upsertPreparedPearCase('pear', { title: 'New', pearPairing: ready('New work') });
    assert.deepEqual(await rawIds('sessions/pear/pearCases'), [created.id, 'case-old'].sort());
    assert.equal('pearPreparedCases' in (await raw('sessions/pear')), false);

    as('guest');
    const session = await waitFor(
      (cb, onError) => adapter.subscribeSession('pear', cb, onError),
      (value) => value?.pearPreparedCases?.length === 2,
    );
    assert.deepEqual(session.pearPreparedCases.map((item) => item.title), ['Old', 'New']);
  });

  test('deleting the case on screen resets the stage', async () => {
    as('admin');
    await adapter.deletePreparedPearCase('pear', 'case-old');
    assert.equal(await raw('sessions/pear/pearCases/case-old'), null);
    const stage = (await raw('sessions/pear')).stage;
    assert.equal(stage.pearPreparedCaseId, null);
    assert.equal(stage.pearView, 'wall');
  });

  test('participants cannot prepare cases', async () => {
    as('alice');
    await assert.rejects(adapter.upsertPreparedPearCase('pear', { title: 'Forged' }), /Admin authentication required/);
    // Even if the client-side admin check is bypassed, the rules reject the write.
    useUser({ uid: 'alice', isAnonymous: false });
    await assert.rejects(adapter.upsertPreparedPearCase('pear', { title: 'Forged' }), /permission/i);
  });
});
