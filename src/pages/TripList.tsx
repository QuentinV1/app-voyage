import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Clock,
  Compass,
  MapPin,
  Plane,
  Plus,
  Search,
  Users,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { createTrip, useTrips } from '../lib/db';
import { daysUntil, formatShort, listDates } from '../lib/dates';
import { tripGradient } from '../lib/categories';
import { useOnlineStatus } from '../lib/offline';
import type { Trip } from '../lib/types';
import { CloudAuthHeaderButton } from '../components/CloudAuthModal';
import { Button, Card, Field, KpiCard, Sheet, Spinner, inputClass } from '../components/ui';

type TripStatus = 'upcoming' | 'ongoing' | 'past';
type FilterTab = 'all' | TripStatus;

const APP_VERSION = '0.3.0';

function getTripStatus(t: Trip): TripStatus {
  const startDiff = daysUntil(t.startDate);
  const endDiff = daysUntil(t.endDate);
  if (startDiff > 0) return 'upcoming';
  if (endDiff >= 0) return 'ongoing';
  return 'past';
}

function getInitials(email: string): string {
  const name = email.split('@')[0] || '?';
  const parts = name.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function TripList() {
  const { email, user } = useAuth();
  const { data: trips, loading, error } = useTrips(email);
  const isOnline = useOnlineStatus();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');

  const firstName = user?.displayName?.split(' ')[0] || email?.split('@')[0] || 'Voyageur';

  const stats = useMemo(() => {
    let upcomingCount = 0;
    let ongoingCount = 0;
    let totalDays = 0;
    let nextTrip: { trip: Trip; days: number } | null = null;
    const travelers = new Set<string>();

    for (const t of trips) {
      const st = getTripStatus(t);
      if (st === 'upcoming') {
        upcomingCount++;
        const d = daysUntil(t.startDate);
        if (!nextTrip || d < nextTrip.days) nextTrip = { trip: t, days: d };
      } else if (st === 'ongoing') {
        ongoingCount++;
      }
      totalDays += listDates(t.startDate, t.endDate).length;
      t.memberEmails.forEach((m) => travelers.add(m.toLowerCase()));
    }

    return { upcomingCount, ongoingCount, totalDays, nextTrip, travelersCount: travelers.size };
  }, [trips]);

  const filteredTrips = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips.filter((t) => {
      if (statusFilter !== 'all' && getTripStatus(t) !== statusFilter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.memberEmails.some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [trips, query, statusFilter]);

  const filterTabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: `Tous (${trips.length})` },
    { id: 'ongoing', label: 'En cours' },
    { id: 'upcoming', label: 'À venir' },
    { id: 'past', label: 'Terminés' },
  ];

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header sticky vitré (aligné sur les autres apps) */}
      <header className="pt-safe sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-rose-500 text-white shadow-sm">
              <Compass className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold tracking-tight text-slate-900 sm:text-lg">
                  Horizons
                </h1>
                <span className="shrink-0 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand ring-1 ring-rose-200/70">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="truncate text-xs text-slate-500">
                Bonjour {firstName} · Planificateur & carnet de voyage
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!isOnline && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                <WifiOff className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Hors-ligne</span>
              </span>
            )}
            <CloudAuthHeaderButton variant="light" />
            <Button className="px-3 py-2 text-xs sm:px-4 sm:text-sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Nouveau voyage</span>
              <span className="sm:hidden">Nouveau</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* Bandeau KPIs */}
        {!loading && trips.length > 0 && (
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              icon={<Plane className="h-5 w-5" />}
              label="Voyages"
              value={trips.length}
              sub={
                stats.ongoingCount > 0
                  ? `${stats.ongoingCount} en cours`
                  : `${stats.upcomingCount} à venir`
              }
              tone="rose"
            />
            <KpiCard
              icon={<Clock className="h-5 w-5" />}
              label="Prochain départ"
              value={
                stats.ongoingCount > 0
                  ? 'En cours'
                  : stats.nextTrip
                    ? `J-${stats.nextTrip.days}`
                    : '—'
              }
              sub={stats.nextTrip ? stats.nextTrip.trip.name : 'Aucun départ prévu'}
              tone="amber"
            />
            <KpiCard
              icon={<CalendarDays className="h-5 w-5" />}
              label="Jours cumulés"
              value={`${stats.totalDays} j`}
              sub="Itinéraires configurés"
              tone="sky"
            />
            <KpiCard
              icon={<Users className="h-5 w-5" />}
              label="Voyageurs"
              value={stats.travelersCount}
              sub="Membres synchronisés"
              tone="emerald"
            />
          </section>
        )}

        {/* Barre de recherche & filtres */}
        {!loading && trips.length > 0 && (
          <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
              {filterTabs.map((tab) => {
                const active = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
                    className={`shrink-0 cursor-pointer rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                      active
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un voyage…"
                className={`${inputClass} py-2 pl-9`}
              />
            </div>
          </section>
        )}

        {loading && (
          <div className="py-16">
            <Spinner label="Chargement de tes voyages…" />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error.message}
          </div>
        )}

        {/* État vide riche / onboarding */}
        {!loading && trips.length === 0 && (
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-slate-900 via-rose-950 to-brand px-6 py-10 text-center text-white sm:px-10">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                <Plane className="h-7 w-7" />
              </div>
              <h2 className="text-2xl font-bold">Prêt pour ta prochaine aventure ?</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-rose-100/85">
                Crée ton premier voyage pour organiser ton itinéraire jour par jour, explorer la carte et tenir un carnet photo partagé.
              </p>
              <Button
                variant="secondary"
                className="mt-6 border-0 bg-white px-5 py-2.5 text-brand shadow-md hover:bg-rose-50"
                onClick={() => setOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Créer mon premier voyage
              </Button>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-3">
              {[
                {
                  icon: CalendarDays,
                  title: 'Itinéraire & IA',
                  desc: 'Planifie chaque jour, importe depuis Wanderlog ou demande des idées à Gemini.',
                },
                {
                  icon: MapPin,
                  title: 'Carte & Mode terrain',
                  desc: 'Visualise tes tracés par journée et retrouve tes coordonnées GPS hors-ligne.',
                },
                {
                  icon: BookOpen,
                  title: 'Carnet de souvenirs',
                  desc: 'Ajoute photos, humeurs et anecdotes synchronisés en temps réel avec tes proches.',
                },
              ].map((feat) => {
                const Icon = feat.icon;
                return (
                  <div key={feat.title} className="rounded-xl bg-slate-50 p-4">
                    <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-brand">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{feat.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{feat.desc}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Grille des voyages */}
        {!loading && trips.length > 0 && filteredTrips.length === 0 && (
          <Card className="py-12 text-center">
            <p className="text-sm font-semibold text-slate-700">Aucun voyage ne correspond à ce filtre.</p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
              }}
              className="mt-2 cursor-pointer text-xs font-semibold text-brand hover:underline"
            >
              Réinitialiser les filtres
            </button>
          </Card>
        )}

        {!loading && filteredTrips.length > 0 && (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTrips.map((t) => {
              const status = getTripStatus(t);
              const d = daysUntil(t.startDate);
              const nbDays = listDates(t.startDate, t.endDate).length;
              const statusBadge =
                status === 'ongoing'
                  ? { label: 'En cours', cls: 'bg-emerald-500/90 text-white' }
                  : status === 'upcoming'
                    ? { label: `Dans ${d} j`, cls: 'bg-white/20 text-white backdrop-blur-xs ring-1 ring-white/30' }
                    : { label: 'Terminé', cls: 'bg-slate-950/35 text-white/90 backdrop-blur-xs' };

              return (
                <Link key={t.id} to={`/trip/${t.id}`} className="group block">
                  <Card className="flex h-full flex-col overflow-hidden transition duration-200 group-hover:-translate-y-0.5 group-hover:border-slate-300 group-hover:shadow-md">
                    <div className={`relative bg-gradient-to-br ${tripGradient(t.id + t.name)} p-5 text-white`}>
                      <div className="flex items-start justify-between gap-2">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusBadge.cls}`}>
                          {statusBadge.label}
                        </span>
                        <span className="tabular-nums rounded-full bg-black/20 px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-xs">
                          {nbDays} jour{nbDays > 1 ? 's' : ''}
                        </span>
                      </div>
                      <h2 className="mt-4 truncate text-xl font-bold tracking-tight">{t.name}</h2>
                      <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-white/90">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-85" />
                        <span>
                          {formatShort(t.startDate)} → {formatShort(t.endDate)}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-1 items-center justify-between gap-3 bg-white px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {t.memberEmails.slice(0, 4).map((m) => (
                            <span
                              key={m}
                              title={m}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-700"
                            >
                              {getInitials(m)}
                            </span>
                          ))}
                          {t.memberEmails.length > 4 && (
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-rose-50 text-[10px] font-bold text-brand">
                              +{t.memberEmails.length - 4}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-slate-500">
                          {t.memberEmails.length} voyageur{t.memberEmails.length > 1 ? 's' : ''}
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand transition group-hover:translate-x-0.5">
                        Ouvrir
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </section>
        )}
      </main>

      <NewTripSheet open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function NewTripSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { email } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [members, setMembers] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = name.trim() && start && end && end >= start;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const activeEmail = email || 'local@offline';
      const id = await createTrip({
        name: name.trim(),
        startDate: start,
        endDate: end,
        memberEmails: [activeEmail, ...members.split(/[\s,;]+/)],
        createdBy: activeEmail,
      });
      onClose();
      navigate(`/trip/${id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Nouveau voyage">
      <div className="space-y-4">
        <Field label="Nom du voyage">
          <input
            className={inputClass}
            maxLength={100}
            placeholder="ex : Japon 2026, Road trip Italie…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Départ">
            <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Retour">
            <input type="date" className={inputClass} value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="E-mails des voyageurs (séparés par des virgules)">
          <textarea
            className={inputClass}
            rows={3}
            placeholder="marie@gmail.com, paul@gmail.com"
            value={members}
            onChange={(e) => setMembers(e.target.value)}
          />
        </Field>
        <Button className="w-full" disabled={!valid || busy} onClick={submit}>
          {busy ? 'Création…' : 'Créer le voyage'}
        </Button>
      </div>
    </Sheet>
  );
}
