import { Navigate, Route, Routes } from 'react-router-dom';
import { LogOut, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import TripList from './pages/TripList';
import TripLayout from './pages/TripLayout';
import Planning from './pages/Planning';
import DayView from './pages/DayView';
import Journal from './pages/Journal';
import MapView from './pages/MapView';
import Ideas from './pages/Ideas';
import More from './pages/More';
import ImportView from './pages/ImportView';
import Login from './pages/Login';
import { CloudAuthModal } from './components/CloudAuthModal';
import { FeedbackButtonAndModal } from './components/FeedbackModal';
import { Button, Card } from './components/ui';
import { useAuth } from './lib/auth';
import { isFirebaseConfigured } from './lib/firebase';

export default function App() {
  const { user, loading, accessStatus, offlineUnverified, recheckAccess, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-rose-50 to-white p-6 text-slate-600">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-slate-200 border-t-brand" />
        <p className="text-sm font-medium">Vérification de l&apos;accès…</p>
      </div>
    );
  }

  if (!isFirebaseConfigured) {
    return (
      <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-rose-50 to-white p-6">
        <Card className="w-full max-w-sm space-y-3 p-6 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="text-lg font-bold text-slate-900">Authentification indisponible</h1>
          <p className="text-sm text-slate-600">
            Le service d&apos;authentification Firebase n&apos;est pas disponible dans cet environnement.
          </p>
        </Card>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (offlineUnverified) {
    return (
      <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-rose-50 to-white p-6">
        <Card className="w-full max-w-sm space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <WifiOff className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-900">Connexion requise</h1>
            <p className="text-sm text-slate-600">
              Une première vérification en ligne est nécessaire pour confirmer votre autorisation d&apos;accès sur cet appareil.
            </p>
            {user.email && (
              <p className="pt-1 text-xs font-medium text-slate-500 break-all">{user.email}</p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => recheckAccess()}>
              <RefreshCw className="h-4 w-4" />
              Réessayer
            </Button>
            <Button type="button" variant="secondary" onClick={() => logout()}>
              <LogOut className="h-4 w-4" />
              Se déconnecter / Changer de compte
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!accessStatus?.hasAppAccess) {
    return (
      <div className="flex min-h-full items-center justify-center bg-gradient-to-b from-rose-50 to-white p-6">
        <Card className="w-full max-w-sm space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-bold text-slate-900">Accès non autorisé</h1>
            <p className="text-sm text-slate-600">
              Ce compte n&apos;est pas autorisé à accéder à Horizons. Contactez un administrateur pour demander l&apos;accès.
            </p>
            {user.email && (
              <p className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 break-all">
                {user.email}
              </p>
            )}
          </div>
          <Button type="button" variant="danger" className="w-full" onClick={() => logout()}>
            <LogOut className="h-4 w-4" />
            Se déconnecter / Changer de compte
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<TripList />} />
        <Route path="/trip/:tripId" element={<TripLayout />}>
          <Route index element={<Planning />} />
          <Route path="day/:date" element={<DayView />} />
          <Route path="journal" element={<Journal />} />
          <Route path="map" element={<MapView />} />
          <Route path="ideas" element={<Ideas />} />
          <Route path="more" element={<More />} />
          <Route path="import" element={<ImportView />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CloudAuthModal />
      <FeedbackButtonAndModal />
    </>
  );
}
