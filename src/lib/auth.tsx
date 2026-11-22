import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, db, isFirebaseConfigured } from './firebase';
import { upsertUserProfile } from './db';
import {
  clearAuthAccessCache,
  resolveUserAccessWithCache,
  type AccessStatus,
} from './accessControl';
import {
  activerSyncCloud,
  arreterListenersFirestore,
  forcerSyncCloud,
  getCloudSnapshot,
  reinitialiserEtatCloud,
  subscribeStore,
  type CloudState,
} from './store';

const APP_ID = 'app-voyage';

interface AuthState {
  user: User | null;
  email: string | null;
  loading: boolean;
  accessStatus: AccessStatus | null;
  offlineUnverified: boolean;
  cloud: CloudState;
  modalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  recheckAccess: () => Promise<void>;
  forceSyncNow: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);
  const [offlineUnverified, setOfflineUnverified] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [cloud, setCloud] = useState<CloudState>(() => getCloudSnapshot());

  useEffect(() => {
    return subscribeStore(() => {
      setCloud(getCloudSnapshot());
    });
  }, []);

  const verifyAndSyncUser = useCallback(async (u: User) => {
    const result = await resolveUserAccessWithCache(db, APP_ID, u.uid, u.email);
    setAccessStatus(result.access);
    setOfflineUnverified(result.offlineUnverified);
    if (result.access.hasAppAccess) {
      upsertUserProfile(u).catch(() => {
        // Silencieux si hors-ligne au démarrage
      });
      activerSyncCloud(u);
    } else {
      arreterListenersFirestore();
      reinitialiserEtatCloud();
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    let active = true;
    getRedirectResult(auth).catch((e) => console.warn('Redirect result', e));
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!active) return;
      setUser(u);
      if (u) {
        setLoading(true);
        try {
          await verifyAndSyncUser(u);
        } finally {
          if (active) setLoading(false);
        }
      } else {
        clearAuthAccessCache(APP_ID);
        setAccessStatus(null);
        setOfflineUnverified(false);
        arreterListenersFirestore();
        reinitialiserEtatCloud();
        setLoading(false);
      }
    });
    return () => {
      active = false;
      unsub();
      arreterListenersFirestore();
    };
  }, [verifyAndSyncUser]);

  useEffect(() => {
    if (!user) return;
    const handleOnline = () => {
      verifyAndSyncUser(user).catch(() => {});
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [user, verifyAndSyncUser]);

  const recheckAccess = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      await verifyAndSyncUser(user);
    } finally {
      setLoading(false);
    }
  }, [user, verifyAndSyncUser]);

  const login = async () => {
    if (!isFirebaseConfigured || !auth) throw new Error('Firebase indisponible hors-ligne.');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      if (code.includes('popup-blocked') || code.includes('operation-not-supported')) {
        await signInWithRedirect(auth, provider);
      } else if (!code.includes('popup-closed') && !code.includes('cancelled-popup')) {
        throw e;
      }
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !auth) throw new Error('Firebase indisponible hors-ligne.');
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };

  const registerWithEmail = async (email: string, password: string, displayName?: string) => {
    if (!isFirebaseConfigured || !auth) throw new Error('Firebase indisponible hors-ligne.');
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName && displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    upsertUserProfile(cred.user).catch(() => {});
  };

  const forceSyncNow = async (): Promise<boolean> => {
    return forcerSyncCloud();
  };

  const logout = async () => {
    clearAuthAccessCache(APP_ID);
    arreterListenersFirestore();
    reinitialiserEtatCloud();
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    setUser(null);
    setAccessStatus(null);
    setOfflineUnverified(false);
  };

  const value: AuthState = {
    user,
    email: user?.email?.toLowerCase() ?? null,
    loading,
    accessStatus,
    offlineUnverified,
    cloud,
    modalOpen,
    openAuthModal: () => setModalOpen(true),
    closeAuthModal: () => setModalOpen(false),
    login,
    loginWithEmail,
    registerWithEmail,
    recheckAccess,
    forceSyncNow,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
