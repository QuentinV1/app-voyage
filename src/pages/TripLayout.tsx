import { useMemo } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useDays, usePlaces, useTrip } from '../lib/db';
import { listDates } from '../lib/dates';
import type { TripCtx } from '../lib/tripContext';
import { Spinner } from '../components/ui';

const TABS = [
  { to: '', icon: '🗓️', label: 'Planning', end: true },
  { to: 'map', icon: '🗺️', label: 'Carte' },
  { to: 'ideas', icon: '💡', label: 'Idées' },
  { to: 'more', icon: '⚙️', label: 'Plus' },
];

export default function TripLayout() {
  const { tripId } = useParams();
  const trip = useTrip(tripId);
  const places = usePlaces(tripId);
  const days = useDays(tripId);

  const dates = useMemo(
    () => (trip.data ? listDates(trip.data.startDate, trip.data.endDate) : []),
    [trip.data],
  );

  if (trip.loading) return <Spinner full />;
  if (!trip.data)
    return (
      <div className="p-6 text-center">
        <p className="mb-4">Voyage introuvable ou accès refusé.</p>
        <Link to="/" className="text-brand underline">
          Retour
        </Link>
      </div>
    );

  const ctx: TripCtx = {
    trip: trip.data,
    places: places.data,
    days: days.data,
    dates,
    dayIndex: (date) => (date ? dates.indexOf(date) : -1),
  };

  return (
    <div className="flex h-full flex-col">
      <header className="pt-safe sticky top-0 z-20 bg-brand text-white shadow">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link to="/" className="text-xl" aria-label="Mes voyages">
            ←
          </Link>
          <h1 className="truncate text-lg font-semibold">{trip.data.name}</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 overflow-y-auto">
        <Outlet context={ctx} />
      </main>

      <nav className="pb-safe sticky bottom-0 z-20 border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 text-xs ${isActive ? 'font-semibold text-brand' : 'text-slate-500'}`
              }
            >
              <span className="text-xl">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
