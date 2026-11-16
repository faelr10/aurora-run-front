import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth } from 'firebase/auth';
import { type Firestore, getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export function firebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

function app(): FirebaseApp {
  if (!firebaseConfigured()) throw new Error('Configure o Firebase no arquivo .env.');
  if (getApps().length > 0) return getApp();
  return initializeApp(config);
}

export function firebaseAuth(): Auth {
  return getAuth(app());
}

let firestore: Firestore | null = null;

export function firebaseDb(): Firestore {
  if (firestore) return firestore;
  const firebaseApp = app();
  try {
    firestore = initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    firestore = getFirestore(firebaseApp);
  }
  return firestore;
}
