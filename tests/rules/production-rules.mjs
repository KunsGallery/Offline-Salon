import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteField, doc, getDoc, getDocs, runTransaction, setDoc } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-offline-salon',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
  await env.clearFirestore();
});
after(async () => { await env?.cleanup(); });

test('both production admins can migrate legacy check-ins and open session collections', async () => {
  for (const email of ['gallerykuns@gmail.com', 'sylove887@gmail.com']) {
    const db = env.authenticatedContext(email, { email, email_verified: true }).firestore();
    const session = doc(db, 'sessions', email);
    const checkin = doc(collection(session, 'checkins'), 'legacy');
    await assertSucceeds(setDoc(session, { checkinApplications: [{ id: 'legacy', name: 'Guest' }] }));
    await assertSucceeds(runTransaction(db, async (tx) => {
      const old = await tx.get(session);
      const existing = await tx.get(checkin);
      if (!existing.exists()) tx.set(checkin, old.data().checkinApplications[0]);
      tx.update(session, { checkinApplications: deleteField() });
    }));
    await assertSucceeds(getDocs(collection(session, 'checkins')));
    await assertSucceeds(getDocs(collection(session, 'pearCases')));
    await assertSucceeds(setDoc(doc(collection(session, 'pearCases'), 'prepared'), { title: 'Case' }));
  }
});

test('public and non-admin users cannot access check-in rosters or edit prepared cases', async () => {
  for (const db of [
    env.unauthenticatedContext().firestore(),
    env.authenticatedContext('participant', { email: 'guest@example.com' }).firestore(),
  ]) {
    const session = doc(db, 'sessions/gallerykuns@gmail.com');
    await assertFails(getDoc(doc(collection(session, 'checkins'), 'legacy')));
    await assertFails(getDocs(collection(session, 'checkins')));
    await assertFails(setDoc(doc(collection(session, 'checkins'), 'other'), { name: 'Guest' }));
    await assertSucceeds(getDocs(collection(session, 'pearCases')));
    await assertFails(setDoc(doc(collection(session, 'pearCases'), 'other'), { title: 'Case' }));
  }
});
