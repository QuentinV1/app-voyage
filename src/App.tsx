import { Navigate, Route, Routes } from 'react-router-dom';
import TripList from './pages/TripList';
import TripLayout from './pages/TripLayout';
import Planning from './pages/Planning';
import DayView from './pages/DayView';
import Journal from './pages/Journal';
import MapView from './pages/MapView';
import Ideas from './pages/Ideas';
import More from './pages/More';
import ImportView from './pages/ImportView';
import { CloudAuthModal } from './components/CloudAuthModal';

export default function App() {
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
    </>
  );
}
