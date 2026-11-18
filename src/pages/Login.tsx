import { useAuth } from '../lib/auth';
import { Button } from '../components/ui';
import { useState } from 'react';

export default function Login() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-rose-50 to-white p-6 text-center">
      <div className="text-7xl">🗾</div>
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Voyage Japon</h1>
        <p className="mt-2 text-slate-500">Planifions ensemble notre aventure 🇯🇵</p>
      </div>
      <Button
        className="w-full max-w-xs py-3"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await login();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Se connecter avec Google
      </Button>
      {error && <p className="max-w-xs text-sm text-red-600">{error}</p>}
    </div>
  );
}
