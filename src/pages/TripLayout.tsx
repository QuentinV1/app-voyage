import { useEffect, useMemo } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, Lightbulb, MapPin, Settings, WifiOff } from 'lucide-react';
import { CloudAuthHeaderButton } from '../components/CloudAuthModal';
import { useDays, useJournal, usePlaces, useTrip, useUserProfiles } from '../lib/db';
import { listDates } from '../lib/dates';
import { loadTripSnapshot, saveTripSnapshot, useOnlineStatus } from '../lib/offline';
import type { TripCtx } from '../lib/tripContext';
import { Spinner } from '../components/ui';

const TABS = [
  { to: '', icon: CalendarDays, label: 'Planning', end: true },
  { to: 'journal', icon: BookOpen, label: 'Carnet' },
  { to: 'map', icon: MapPin, label: 'Carte' },
  { to: 'ideas', icon: Lightbulb, label: 'Idées' },
  { to: 'more', icon: Settings, label: 'Plus' },
];

export default function TripLayout() {
  const { tripId } = useParams();
  const isOnline = useOnlineStatus();
  const trip = useTrip(tripId);
  const places = usePlaces(tripId);
  const days = useDays(tripId);
  const journal = useJournal(tripId);

  const snapshot = useMemo(() => (tripId ? loadTripSnapshot(tripId) : null), [tripId]);

  const activeTrip = trip.data ?? (!isOnline ? snapshot?.trip ?? null : null);
  const activePlaces = trip.data ? places.data : !isOnline && snapshot ? snapshot.places : places.data;
  const activeDays = trip.data ? days.data : !isOnline && snapshot ? snapshot.days : days.data;
  const activeJournal = trip.data ? journal.data : !isOnline && snapshot ? snapshot.journal : journal.data;

  const memberProfiles = useUserProfiles(activeTrip?.memberEmails ?? []);

  useEffect(() => {
    if (!tripId || !trip.data || places.loading || days.loading || journal.loading) return;
    saveTripSnapshot(tripId, {
      trip: trip.data,
      places: places.data,
      days: days.data,
      journal: journal.data,
    });
  }, [tripId, trip.data, places.data, places.loading, days.data, days.loading, journal.data, journal.loading]);

  const dates = useMemo(
    () => (activeTrip ? listDates(activeTrip.startDate, activeTrip.endDate) : []),
    [activeTrip],
  );

  if (trip.loading && !activeTrip) return <Spinner full />;
  if (!activeTrip)
    return (
      <div className="p-6 text-center">
        <p className="mb-4">Voyage introuvable ou accès refusé.</p>
        <Link to="/" className="text-brand underline">
          Retour
        </Link>
      </div>
    );

  const hasPendingWrites = Boolean(trip.hasPendingWrites || places.hasPendingWrites || journal.hasPendingWrites);

  const ctx: TripCtx = {
    trip: activeTrip,
    places: activePlaces,
    days: activeDays,
    journal: activeJournal,
    memberProfiles,
    dates,
    isOnline,
    dayIndex: (date) => (date ? dates.indexOf(date) : -1),
  };

  return (
    <div className="flex h-full flex-col">
      <header className="pt-safe sticky top-0 z-20 bg-brand text-white shadow">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="rounded-lg p-1 active:bg-white/15" aria-label="Mes voyages">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <h1 className="truncate text-lg font-semibold">{activeTrip.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isOnline && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/90 px-2.5 py-0.5 text-[11px] font-medium text-white">
                <WifiOff className="h-3 w-3" />
                Hors-ligne
              </span>
            )}
            <CloudAuthHeaderButton variant="dark" />
          </div>
        </div>
        {!isOnline && (
          <div className="bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800">
            Mode hors-ligne terrain actif — les modifications seront synchronisées au retour du réseau
            {hasPendingWrites ? ' (en attente)' : ''}.
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 overflow-y-auto">
        <Outlet context={ctx} />
      </main>

      <nav className="pb-safe sticky bottom-0 z-20 border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'font-semibold text-brand' : 'text-slate-500'}`
                }
              >
                <Icon className="h-5 w-5" />
                {t.label}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
