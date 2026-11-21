import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

export const FIREBASE_CONFIG = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'quentin-apps-hub',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:249016348389:web:59deb2bca6520d029cee0c',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'quentin-apps-hub.firebasestorage.app',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCuYM0tMpd1f1jDYz27OhCaPpcAWhI3i48',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'quentin-apps-hub.firebaseapp.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '249016348389',
};

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function initFirebaseSafely() {
  if (appInstance) return;
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return;
  }
  try {
    appInstance = initializeApp(FIREBASE_CONFIG);
    const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY as string | undefined;
    if (appCheckSiteKey && typeof window !== 'undefined') {
      initializeAppCheck(appInstance, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
    authInstance = getAuth(appInstance);
    dbInstance = initializeFirestore(appInstance, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch (err) {
    console.warn('Firebase SDK indisponible (mode hors-ligne local):', err);
    appInstance = null;
    authInstance = null;
    dbInstance = null;
  }
}

initFirebaseSafely();

export const isFirebaseConfigured = Boolean(appInstance && authInstance && dbInstance);
export const app = appInstance as unknown as FirebaseApp;
export const auth = authInstance as unknown as Auth;
export const db = dbInstance as unknown as Firestore;

export function cleanForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? null : v))) as T;
}
