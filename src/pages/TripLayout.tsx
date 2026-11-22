import { useEffect, useMemo } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, CalendarDays, Compass, Lightbulb, MapPin, Settings, WifiOff } from 'lucide-react';
import { CloudAuthHeaderButton } from '../components/CloudAuthModal';
import { useDays, useJournal, usePlaces, useTrip, useUserProfiles } from '../lib/db';
import { formatShort, listDates } from '../lib/dates';
import { loadTripSnapshot, saveTripSnapshot, useOnlineStatus } from '../lib/offline';
import type { TripCtx } from '../lib/tripContext';
import { Button, Card, Spinner } from '../components/ui';

export default function TripLayout() {
  const { tripId } = useParams();
  const location = useLocation();
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

  if (trip.loading && !activeTrip) return <Spinner full label="Chargement du voyage…" />;
  if (!activeTrip)
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-sm space-y-4 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-brand">
            <Compass className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-slate-900">Voyage introuvable</h1>
            <p className="text-sm text-slate-500">Ce voyage n&apos;existe plus ou ton compte n&apos;y a pas accès.</p>
          </div>
          <Link to="/" className="block">
            <Button className="w-full">Retour à mes voyages</Button>
          </Link>
        </Card>
      </div>
    );

  const hasPendingWrites = Boolean(trip.hasPendingWrites || places.hasPendingWrites || journal.hasPendingWrites);
  const ideasCount = activePlaces.filter((p) => !p.date || !dates.includes(p.date)).length;
  const isMapRoute = location.pathname.endsWith('/map');

  const tabs = [
    { to: '', icon: CalendarDays, label: 'Planning', end: true, count: dates.length },
    { to: 'journal', icon: BookOpen, label: 'Carnet', count: activeJournal.length },
    { to: 'map', icon: MapPin, label: 'Carte', count: activePlaces.filter((p) => p.lat != null && p.lng != null).length },
    { to: 'ideas', icon: Lightbulb, label: 'Idées', count: ideasCount },
    { to: 'more', icon: Settings, label: 'Plus' },
  ];

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
    <div className="flex h-dvh flex-col overflow-x-clip bg-slate-50">
      {/* Header sticky moderne avec nav desktop intégrée */}
      <header className="pt-safe sticky top-0 z-20 shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Link
              to="/"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Mes voyages"
              title="Retour à mes voyages"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                  {activeTrip.name}
                </h1>
                <span className="hidden shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 sm:inline">
                  {dates.length} j
                </span>
              </div>
              <p className="truncate text-[11px] font-medium text-slate-500">
                {formatShort(activeTrip.startDate)} → {formatShort(activeTrip.endDate)} · {activeTrip.memberEmails.length} voyageur{activeTrip.memberEmails.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Navigation Desktop */}
          <nav aria-label="Navigation du voyage" className="hidden items-center gap-1 md:flex">
            {tabs.map((t) => {
              const Icon = t.icon;
              return (
                <NavLink
                  key={t.to}
                  to={t.to}
                  end={t.end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                      isActive
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{t.label}</span>
                      {typeof t.count === 'number' && t.count > 0 && (
                        <span
                          className={`tabular-nums rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {t.count}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {!isOnline && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                <WifiOff className="h-3 w-3" />
                <span className="hidden sm:inline">Hors-ligne</span>
              </span>
            )}
            <CloudAuthHeaderButton variant="light" />
          </div>
        </div>

        {!isOnline && (
          <div className="border-t border-amber-200/70 bg-amber-50 px-4 py-1.5 text-center text-xs font-medium text-amber-800">
            Mode hors-ligne terrain actif — les modifications seront synchronisées au retour du réseau
            {hasPendingWrites ? ' (en attente)' : ''}.
          </div>
        )}
      </header>

      <main
        className={`w-full min-w-0 flex-1 overflow-x-hidden overflow-y-auto ${
          isMapRoute ? '' : 'mx-auto max-w-7xl'
        }`}
      >
        <Outlet context={ctx} />
      </main>

      {/* Bottom nav mobile uniquement */}
      <nav
        aria-label="Navigation mobile"
        className="pb-safe sticky bottom-0 z-20 shrink-0 border-t border-slate-200/90 bg-white/95 backdrop-blur-md md:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] transition ${
                    isActive ? 'font-bold text-brand' : 'font-medium text-slate-500'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" />}
                    <div className="relative">
                      <Icon className="h-5 w-5" />
                      {typeof t.count === 'number' && t.count > 0 && t.to === 'ideas' && (
                        <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[9px] font-bold text-white">
                          {t.count}
                        </span>
                      )}
                    </div>
                    <span>{t.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
