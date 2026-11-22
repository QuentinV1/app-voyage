import { useEffect, useState } from 'react';
import { Cloud, RefreshCw, Shield, User } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useTrips } from '../lib/db';
import { db } from '../lib/firebase';
import { resolveUserAccess, type AccessStatus } from '../lib/accessControl';
import { AccessControlPanel } from './AccessControlPanel';
import { Button, Sheet, inputClass } from './ui';

export function CloudAuthHeaderButton({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { user, openAuthModal } = useAuth();
  const label = user ? (user.email || user.displayName || 'Cloud').split('@')[0] : 'Connexion';

  const baseClass =
    variant === 'dark'
      ? 'inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 active:bg-white/30'
      : 'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 active:bg-slate-100';

  return (
    <button
      type="button"
      id="btn-auth-header"
      onClick={openAuthModal}
      className={baseClass}
      title={user ? `Connecté : ${user.email || user.uid}` : 'Se connecter au Cloud'}
    >
      {user ? <User className="h-4 w-4 shrink-0" /> : <Cloud className="h-4 w-4 shrink-0" />}
      <span className="max-w-28 truncate">{label}</span>
    </button>
  );
}

export function CloudAuthModal() {
  const {
    user,
    cloud,
    modalOpen,
    closeAuthModal,
    login,
    loginWithEmail,
    registerWithEmail,
    forceSyncNow,
    logout,
  } = useAuth();
  const { data: trips } = useTrips(user?.email ?? null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncErrorLocal, setSyncErrorLocal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'access'>('account');
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  useEffect(() => {
    if (!modalOpen || !user?.email) {
      setAccessStatus(null);
      setActiveTab('account');
      return;
    }
    let cancelled = false;
    resolveUserAccess(db, 'app-voyage', user.email).then((status) => {
      if (!cancelled) {
        setAccessStatus(status);
        if (!status.isAdmin) setActiveTab('account');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [modalOpen, user?.email]);

  const handleEmailAuth = async (isRegister: boolean) => {
    if (!email.trim() || !password) {
      setAuthError('Veuillez renseigner votre e-mail et votre mot de passe.');
      return;
    }
    setBusy(true);
    setAuthError(null);
    try {
      if (isRegister) {
        await registerWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      closeAuthModal();
    } catch (err) {
      setAuthError(friendlyAuthError((err as { code?: string; message?: string })?.code ?? (err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    setAuthError(null);
    try {
      await login();
      closeAuthModal();
    } catch (err) {
      setAuthError(friendlyAuthError((err as { code?: string; message?: string })?.code ?? (err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const handleForceSync = async () => {
    setBusy(true);
    setSyncErrorLocal(null);
    try {
      await forceSyncNow();
    } catch (err) {
      setSyncErrorLocal((err as Error).message || 'Impossible de synchroniser.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    if (!confirm('Se déconnecter du compte Cloud ?')) return;
    await logout();
    closeAuthModal();
  };

  let statusText = 'Connexion au Cloud…';
  let statusColor = 'text-slate-500';
  if (cloud.syncStatus === 'syncing') {
    statusText = 'Synchronisation en cours…';
    statusColor = 'text-amber-600';
  } else if (cloud.syncStatus === 'error') {
    statusText = 'Erreur de synchronisation';
    statusColor = 'text-red-600';
  } else if (cloud.initialSyncDone || cloud.syncStatus === 'synced') {
    const nb = trips.length;
    statusText = `Synchronisé (${nb} voyage${nb > 1 ? 's' : ''})`;
    statusColor = 'text-emerald-600';
  }

  const displayedSyncError = syncErrorLocal || cloud.syncError;

  return (
    <Sheet open={modalOpen} onClose={closeAuthModal} title="Compte Cloud Voyage">
      <div id="modal-auth">
        {!user ? (
          <div id="auth-logged-out-panel" className="space-y-4">
            <p className="text-xs text-slate-500">
              Connectez-vous pour synchroniser vos voyages, votre planning, vos idées et votre carnet de voyage entre tous
              vos appareils et vos proches.
            </p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
                <input
                  id="auth-email"
                  type="email"
                  className={inputClass}
                  placeholder="prenom@exemple.fr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Mot de passe (6 car. min)</label>
                <input
                  id="auth-password"
                  type="password"
                  className={inputClass}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            {authError && (
              <div id="auth-error-msg" className="text-xs font-medium text-red-600">
                {authError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button type="button" disabled={busy} onClick={() => handleEmailAuth(false)}>
                Se connecter
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => handleEmailAuth(true)}>
                Créer un compte
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={handleGoogle}>
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                Continuer avec Google
              </Button>
            </div>
          </div>
        ) : (
          <div id="auth-logged-in-panel" className="space-y-4">
            {accessStatus?.isAdmin && (
              <div className="flex gap-1.5 rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('account')}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === 'account'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Compte Cloud
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('access')}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    activeTab === 'access'
                      ? 'bg-white text-sky-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  Accès &amp; Rôles
                </button>
              </div>
            )}

            {accessStatus && !accessStatus.hasAppAccess && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-700">
                Votre compte n&apos;est pas autorisé sur cette application. Contactez un administrateur.
              </div>
            )}

            {activeTab === 'access' && accessStatus?.isAdmin ? (
              <AccessControlPanel
                db={db}
                user={user}
                appId="app-voyage"
                appName="App Voyage"
                theme="light"
              />
            ) : (
              <>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[11px] font-bold uppercase text-slate-400">Connecté en tant que</div>
              <div id="auth-connected-email" className="mt-0.5 break-all text-sm font-bold text-slate-900">
                {user.email || user.displayName || user.uid}
              </div>
              <div id="auth-sync-status" className={`mt-1.5 text-xs font-medium ${statusColor}`}>
                {statusText}
              </div>
            </div>

            {displayedSyncError && (
              <div id="auth-sync-error-msg" className="text-xs font-medium text-red-600">
                {displayedSyncError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button type="button" id="btn-force-sync" disabled={busy} onClick={handleForceSync}>
                <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                Synchroniser maintenant
              </Button>
              <Button type="button" variant="danger" onClick={handleLogout}>
                Se déconnecter
              </Button>
            </div>
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function friendlyAuthError(codeOrMsg: string): string {
  if (codeOrMsg.includes('invalid-credential') || codeOrMsg.includes('wrong-password')) {
    return 'E-mail ou mot de passe incorrect.';
  }
  if (codeOrMsg.includes('email-already-in-use')) {
    return 'Un compte existe déjà avec cet e-mail.';
  }
  if (codeOrMsg.includes('weak-password')) {
    return 'Le mot de passe doit contenir au moins 6 caractères.';
  }
  if (codeOrMsg.includes('invalid-email')) {
    return 'Adresse e-mail invalide.';
  }
  if (codeOrMsg.includes('permission-denied')) {
    return 'Accès Firestore refusé (vérifiez que votre compte est bien autorisé).';
  }
  return codeOrMsg;
}
