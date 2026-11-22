import { useState } from 'react';
import { BookOpen, CalendarDays, Compass, LogIn, Mail, MapPin, UserPlus, WifiOff } from 'lucide-react';
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

  const highlights = [
    {
      icon: CalendarDays,
      title: 'Planning jour par jour',
      desc: 'Organise tes étapes, horaires, idées IA et imports Wanderlog.',
    },
    {
      icon: MapPin,
      title: 'Carte & tracé interactif',
      desc: 'Visualise chaque journée sur Google Maps et accède aux coordonnées GPS.',
    },
    {
      icon: BookOpen,
      title: 'Carnet partagé & hors-ligne',
      desc: 'Partage photos et souvenirs à plusieurs, même sans connexion sur place.',
    },
  ];

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-slate-100 via-rose-50/40 to-slate-100 p-4 sm:p-6">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xl lg:grid-cols-12">
        {/* Panneau éditorial */}
        <div className="relative flex flex-col justify-between bg-gradient-to-br from-slate-900 via-rose-950 to-brand p-7 text-white lg:col-span-6 lg:p-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur-xs">
                <Compass className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xl font-extrabold tracking-tight">Horizons</p>
                <p className="text-xs text-rose-100/80">Planificateur & Carnet de voyage</p>
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                Prépare, explore et raconte tes voyages à plusieurs.
              </h1>
              <p className="text-sm text-rose-100/80">
                Synchronisé en temps réel sur tous tes appareils et accessible hors-ligne sur le terrain.
              </p>
            </div>

            <div className="hidden space-y-3 pt-2 lg:block">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/10 backdrop-blur-xs"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <Icon className="h-4 w-4 text-rose-100" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                      <p className="text-xs text-rose-100/80">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 hidden items-center gap-2 text-xs text-rose-100/70 lg:flex">
            <WifiOff className="h-3.5 w-3.5" />
            <span>Mode PWA hors-ligne inclus</span>
          </div>
        </div>

        {/* Formulaire */}
        <div className="flex flex-col justify-center p-6 sm:p-8 lg:col-span-6 lg:p-10">
          <div className="mb-6 space-y-1">
            <h2 className="text-xl font-bold text-slate-900">
              {mode === 'login' ? 'Connexion à ton espace' : 'Créer ton compte'}
            </h2>
            <p className="text-sm text-slate-500">
              Utilise ton compte autorisé pour retrouver tes voyages synchronisés.
            </p>
          </div>

          <Card className="space-y-4 border-0 p-0 shadow-none">
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
              <Button type="submit" variant="secondary" className="w-full py-2.5" disabled={busy}>
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
              className="w-full cursor-pointer pt-1 text-center text-xs font-medium text-slate-500 hover:text-brand"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
            >
              {mode === 'login' ? 'Pas encore de compte ? Créer un compte' : 'Déjà inscrit ? Se connecter'}
            </button>

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700">
                {error}
              </p>
            )}
          </Card>
        </div>
      </div>
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
