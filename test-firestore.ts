
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

async function test() {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: firebaseConfig.projectId
    });
  }
  const dbId = (firebaseConfig.firestoreDatabaseId || '').trim();
  const db = dbId && dbId !== '(default)' ? getFirestore(admin.app(), dbId) : getFirestore(admin.app());
  
  try {
    const snap = await db.collection('users').limit(1).get();
    console.log("SUCCESS: Firestore is Accessible!");
    console.log("User count found:", snap.size);
  } catch (e) {
    console.log("STILL BLOCKED: ", e.message);
  }
}
test();
