import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { isFirebaseConfigured } from './lib/firebase';
import Login from './pages/Login';
import TripList from './pages/TripList';
import TripLayout from './pages/TripLayout';
import Planning from './pages/Planning';
import DayView from './pages/DayView';
import Journal from './pages/Journal';
import MapView from './pages/MapView';
import Ideas from './pages/Ideas';
import More from './pages/More';
import ImportView from './pages/ImportView';
import { Spinner } from './components/ui';

export default function App() {
  const { user, loading } = useAuth();

  if (!isFirebaseConfigured) {
    return (
      <div className="mx-auto mt-10 max-w-md space-y-3 p-6">
        <h1 className="text-xl font-bold">Configuration manquante</h1>
        <p>
          Copie <code>.env.example</code> en <code>.env.local</code> et renseigne les clés Firebase et Google Maps
          (voir <code>SETUP.md</code>), puis relance <code>npm run dev</code>.
        </p>
      </div>
    );
  }

  if (loading) return <Spinner full />;
  if (!user) return <Login />;

  return (
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
  );
}
