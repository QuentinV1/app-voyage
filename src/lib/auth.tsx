import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './firebase';
import { upsertUserProfile } from './db';
import {
  activerSyncCloud,
  arreterListenersFirestore,
  forcerSyncCloud,
  getCloudSnapshot,
  reinitialiserEtatCloud,
  subscribeStore,
  type CloudState,
} from './store';

interface AuthState {
  user: User | null;
  email: string | null;
  loading: boolean;
  cloud: CloudState;
  modalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName?: string) => Promise<void>;
  resendVerificationEmail: () => Promise<boolean>;
  reloadAndVerifyUser: () => Promise<boolean>;
  forceSyncNow: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [modalOpen, setModalOpen] = useState(false);
  const [cloud, setCloud] = useState<CloudState>(() => getCloudSnapshot());
  const [, setUserVersion] = useState(0);

  useEffect(() => {
    return subscribeStore(() => {
      setCloud(getCloudSnapshot());
    });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    getRedirectResult(auth).catch((e) => console.warn('Redirect result', e));
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        upsertUserProfile(u).catch(() => {
          // Silencieux si hors-ligne au démarrage
        });
        activerSyncCloud(u);
      } else {
        arreterListenersFirestore();
        reinitialiserEtatCloud();
      }
    });
    return () => {
      unsub();
      arreterListenersFirestore();
    };
  }, []);

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
    sendEmailVerification(cred.user).catch(() => {});
    upsertUserProfile(cred.user).catch(() => {});
  };

  const resendVerificationEmail = async (): Promise<boolean> => {
    if (!isFirebaseConfigured || !auth || !auth.currentUser) {
      throw new Error('Aucun utilisateur connecté.');
    }
    if (auth.currentUser.emailVerified) return false;
    await sendEmailVerification(auth.currentUser);
    return true;
  };

  const reloadAndVerifyUser = async (): Promise<boolean> => {
    if (!isFirebaseConfigured || !auth || !auth.currentUser) return false;
    await auth.currentUser.reload();
    setUser(auth.currentUser);
    setUserVersion((v) => v + 1);
    if (auth.currentUser.emailVerified) {
      await auth.currentUser.getIdToken(true);
      await activerSyncCloud(auth.currentUser);
      return true;
    }
    return false;
  };

  const forceSyncNow = async (): Promise<boolean> => {
    return forcerSyncCloud();
  };

  const logout = async () => {
    arreterListenersFirestore();
    reinitialiserEtatCloud();
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    }
    setUser(null);
  };

  const value: AuthState = {
    user,
    email: user?.email?.toLowerCase() ?? null,
    loading,
    cloud,
    modalOpen,
    openAuthModal: () => setModalOpen(true),
    closeAuthModal: () => setModalOpen(false),
    login,
    loginWithEmail,
    registerWithEmail,
    resendVerificationEmail,
    reloadAndVerifyUser,
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
