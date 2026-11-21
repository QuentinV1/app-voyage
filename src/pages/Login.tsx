import { useState } from 'react';
import { Compass, LogIn, Mail, UserPlus } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button, Card, inputClass } from '../components/ui';

export default function Login() {
  const { login, loginWithEmail, registerWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGoogle = async () => {
    setBusy(true);
    setError(null);
    try {
      await login();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') {
        await registerWithEmail(email, password, displayName);
      } else {
        await loginWithEmail(email, password);
      }
    } catch (err) {
      setError(friendlyAuthError((err as { code?: string; message?: string }).code ?? (err as Error).message));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-rose-50 to-white p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white shadow-md">
          <Compass className="h-9 w-9" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Voyage Japon</h1>
        <p className="text-sm text-slate-500">Planifions et partageons notre aventure ensemble</p>
      </div>

      <Card className="w-full max-w-sm space-y-4 p-5">
        <Button className="w-full py-3" disabled={busy} onClick={handleGoogle}>
          <LogIn className="h-4 w-4" />
          Continuer avec Google
        </Button>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>ou par e-mail</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleEmailSubmit} className="space-y-3">
          {mode === 'register' && (
            <input
              className={inputClass}
              type="text"
              placeholder="Prénom ou pseudo"
              maxLength={60}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          )}
          <input
            className={inputClass}
            type="email"
            placeholder="adresse@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className={inputClass}
            type="password"
            placeholder="Mot de passe (6+ caractères)"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" variant="secondary" className="w-full" disabled={busy}>
            {mode === 'register' ? (
              <>
                <UserPlus className="h-4 w-4" />
                Créer un compte
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Se connecter par e-mail
              </>
            )}
          </Button>
        </form>

        <button
          type="button"
          className="w-full text-center text-xs text-slate-500 underline"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? 'Pas encore de compte ? Créer un compte' : 'Déjà inscrit ? Se connecter'}
        </button>

        {error && <p className="text-center text-sm text-red-600">{error}</p>}
      </Card>
    </div>
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
  return codeOrMsg;
}
