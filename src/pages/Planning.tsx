import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock,
  Download,
  Lightbulb,
  MapPin,
  Plane,
  Search,
  Sparkles,
} from 'lucide-react';
import { useTripCtx } from '../lib/tripContext';
import { daysUntil, formatDay, formatShort } from '../lib/dates';
import { CATEGORIES, CATEGORY_KEYS, dayColor, tripGradient } from '../lib/categories';
import { Button, Card, KpiCard, inputClass } from '../components/ui';

type DayFilter = 'all' | 'planned' | 'free';

export default function Planning() {
  const { trip, dates, days, places, journal } = useTripCtx();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DayFilter>('all');

  const countdown = daysUntil(trip.startDate);
  const endDiff = daysUntil(trip.endDate);
  const isOngoing = countdown <= 0 && endDiff >= 0;
  const isPast = endDiff < 0;

  const stats = useMemo(() => {
    const plannedPlaces = places.filter((p) => p.date && dates.includes(p.date));
    const ideasCount = places.length - plannedPlaces.length;
    const plannedDaysCount = dates.filter((d) => plannedPlaces.some((p) => p.date === d)).length;
    const photosCount = journal.reduce((acc, j) => acc + (j.photos?.length ?? 0), 0);
    const completionPct = dates.length > 0 ? Math.round((plannedDaysCount / dates.length) * 100) : 0;

    const byCategory = CATEGORY_KEYS.map((key) => ({
      key,
      meta: CATEGORIES[key],
      count: plannedPlaces.filter((p) => p.category === key).length,
    })).filter((item) => item.count > 0);

    return {
      plannedPlacesCount: plannedPlaces.length,
      ideasCount,
      plannedDaysCount,
      photosCount,
      completionPct,
      byCategory,
    };
  }, [places, dates, journal]);

  const filteredDates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dates
      .map((date, index) => {
        const info = days[date];
        const dayPlaces = places.filter((p) => p.date === date);
        const dayMemories = journal.filter((j) => j.date === date);
        return { date, index, info, dayPlaces, dayMemories };
      })
      .filter(({ info, dayPlaces }) => {
        if (filter === 'planned' && dayPlaces.length === 0) return false;
        if (filter === 'free' && dayPlaces.length > 0) return false;
        if (!q) return true;
        return (
          (info?.title ?? '').toLowerCase().includes(q) ||
          (info?.city ?? '').toLowerCase().includes(q) ||
          dayPlaces.some((p) => p.name.toLowerCase().includes(q) || (p.city ?? '').toLowerCase().includes(q))
        );
      });
  }, [dates, days, places, journal, query, filter]);

  const heroStatusLabel = isOngoing
    ? `Voyage en cours · Jour ${Math.min(dates.length, Math.abs(countdown) + 1)} / ${dates.length}`
    : isPast
      ? 'Voyage terminé'
      : `Départ dans ${countdown} jour${countdown > 1 ? 's' : ''}`;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Hero Banner / Synthèse du voyage */}
      <section className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${tripGradient(trip.id + trip.name)} p-5 text-white shadow-md sm:p-7`}>
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="space-y-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25 backdrop-blur-xs">
              <Plane className="h-3.5 w-3.5" />
              {heroStatusLabel}
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{trip.name}</h2>
            <p className="text-sm text-white/90">
              Du {formatShort(trip.startDate)} au {formatShort(trip.endDate)} · {dates.length} jour{dates.length > 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="import">
              <Button
                variant="secondary"
                className="border-white/25 bg-white/15 px-3.5 py-2 text-xs text-white backdrop-blur-xs hover:bg-white/25"
              >
                <Download className="h-3.5 w-3.5" />
                Importer
              </Button>
            </Link>
            <Link to="map">
              <Button
                variant="secondary"
                className="border-white/25 bg-white/15 px-3.5 py-2 text-xs text-white backdrop-blur-xs hover:bg-white/25"
              >
                <MapPin className="h-3.5 w-3.5" />
                Carte
              </Button>
            </Link>
            <Link to="journal">
              <Button
                variant="secondary"
                className="border-0 bg-white px-3.5 py-2 text-xs text-slate-900 shadow-xs hover:bg-rose-50"
              >
                <BookOpen className="h-3.5 w-3.5 text-brand" />
                Carnet ({journal.length})
              </Button>
            </Link>
          </div>
        </div>

        {/* Barre de progression de planification */}
        <div className="mt-5 rounded-2xl bg-black/15 p-3.5 backdrop-blur-xs">
          <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-white/90">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Avancement du planning
            </span>
            <span className="tabular-nums font-bold">
              {stats.plannedDaysCount} / {dates.length} jours remplis ({stats.completionPct}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${stats.completionPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* KPIs rapides */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<CalendarDays className="h-5 w-5" />}
          label="Jours"
          value={dates.length}
          sub={`${stats.plannedDaysCount} planifié${stats.plannedDaysCount > 1 ? 's' : ''}`}
          tone="rose"
        />
        <KpiCard
          icon={<MapPin className="h-5 w-5" />}
          label="Étapes prévues"
          value={stats.plannedPlacesCount}
          sub={`${places.filter((p) => p.lat != null).length} géolocalisées`}
          tone="sky"
        />
        <KpiCard
          icon={<Lightbulb className="h-5 w-5" />}
          label="Boîte à idées"
          value={stats.ideasCount}
          sub="À placer dans le planning"
          tone="amber"
        />
        <KpiCard
          icon={<Camera className="h-5 w-5" />}
          label="Carnet & Photos"
          value={journal.length}
          sub={`${stats.photosCount} photo${stats.photosCount > 1 ? 's' : ''}`}
          tone="emerald"
        />
      </section>

      {/* Répartition par catégorie (si des lieux existent) */}
      {stats.byCategory.length > 0 && (
        <Card className="p-4">
          <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Répartition des étapes planifiées
            </h3>
            <span className="text-xs text-slate-400">
              {stats.plannedPlacesCount} étape{stats.plannedPlacesCount > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            {stats.byCategory.map(({ key, meta, count }) => (
              <div
                key={key}
                title={`${meta.label} : ${count}`}
                style={{
                  width: `${(count / stats.plannedPlacesCount) * 100}%`,
                  backgroundColor: meta.color,
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.byCategory.map(({ key, meta, count }) => {
              const Icon = meta.icon;
              return (
                <span
                  key={key}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${meta.badgeClass}`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{meta.shortLabel}</span>
                  <span className="tabular-nums font-bold">{count}</span>
                </span>
              );
            })}
          </div>
        </Card>
      )}

      {/* Encart d'import si planning encore vide */}
      {places.length === 0 && (
        <Link to="import" className="block">
          <Card className="flex flex-col items-center justify-between gap-4 border-2 border-dashed border-rose-200 bg-rose-50/40 p-5 text-center transition hover:border-brand/50 hover:bg-rose-50/70 sm:flex-row sm:text-left">
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-brand">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-slate-900">Importer mon planning existant</p>
                <p className="text-xs text-slate-600">
                  Wanderlog (JSON, PDF, texte) ou capture d&apos;écran — Gemini structure ton itinéraire automatiquement.
                </p>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white">
              Importer
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Card>
        </Link>
      )}

      {/* Barre de recherche & filtres des journées */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
          {[
            { id: 'all' as DayFilter, label: `Tous les jours (${dates.length})` },
            { id: 'planned' as DayFilter, label: `Planifiés (${stats.plannedDaysCount})` },
            { id: 'free' as DayFilter, label: `Libres (${dates.length - stats.plannedDaysCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`shrink-0 cursor-pointer rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                filter === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrer par ville, titre ou lieu…"
            className={`${inputClass} py-2 pl-9`}
          />
        </div>
      </section>

      {/* Grille responsive des journées */}
      {filteredDates.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-sm font-semibold text-slate-700">Aucune journée ne correspond à ta recherche.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
            className="mt-2 cursor-pointer text-xs font-semibold text-brand hover:underline"
          >
            Afficher toutes les journées
          </button>
        </Card>
      ) : (
        <section className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {filteredDates.map(({ date, index, info, dayPlaces, dayMemories }) => {
            const color = dayColor(index);
            return (
              <Link key={date} to={`day/${date}`} className="group block">
                <Card className="flex h-full flex-col justify-between gap-3 p-4 transition duration-200 group-hover:-translate-y-0.5 group-hover:border-slate-300 group-hover:shadow-md">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-white shadow-xs"
                        style={{ backgroundColor: color }}
                      >
                        <span className="text-[10px] font-semibold uppercase leading-none opacity-90">Jour</span>
                        <span className="tabular-nums text-lg font-extrabold leading-tight">{index + 1}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium capitalize text-slate-500">{formatDay(date)}</p>
                        <p className="mt-0.5 truncate text-base font-bold text-slate-900">
                          {info?.title || info?.city || (
                            <span className="font-medium text-slate-400">Journée libre</span>
                          )}
                        </p>
                        {info?.title && info?.city && (
                          <p className="truncate text-xs font-medium text-slate-500">{info.city}</p>
                        )}
                      </div>

                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand" />
                    </div>

                    {/* Aperçu des étapes de la journée */}
                    {dayPlaces.length > 0 ? (
                      <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                        {dayPlaces.slice(0, 3).map((p) => {
                          const cat = CATEGORIES[p.category] ?? CATEGORIES.other;
                          const Icon = cat.icon;
                          return (
                            <div key={p.id} className="flex items-center gap-2 text-xs text-slate-700">
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${cat.iconBgClass}`}>
                                <Icon className="h-3 w-3" />
                              </span>
                              <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                              {p.time && (
                                <span className="tabular-nums inline-flex shrink-0 items-center gap-0.5 text-[11px] text-slate-400">
                                  <Clock className="h-2.5 w-2.5" />
                                  {p.time}
                                </span>
                              )}
                            </div>
                          );
                        })}
                        {dayPlaces.length > 3 && (
                          <p className="pl-7 text-[11px] font-semibold text-slate-400">
                            + {dayPlaces.length - 3} autre{dayPlaces.length - 3 > 1 ? 's' : ''} étape{dayPlaces.length - 3 > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-400">
                        Clique pour planifier des lieux ou demander des idées IA.
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {dayPlaces.length} étape{dayPlaces.length > 1 ? 's' : ''}
                    </span>
                    {dayMemories.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-brand">
                        <BookOpen className="h-3 w-3" />
                        {dayMemories.length} souvenir{dayMemories.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </section>
      )}

      {/* Bandeau rapide vers les idées à placer */}
      {stats.ideasCount > 0 && (
        <Link to="ideas" className="block">
          <Card className="flex items-center justify-between gap-3 border-amber-200/80 bg-amber-50/50 p-4 transition hover:bg-amber-50">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <Lightbulb className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {stats.ideasCount} idée{stats.ideasCount > 1 ? 's' : ''} en attente
                </p>
                <p className="text-xs text-slate-600">Attribue tes lieux enregistrés à une journée du planning.</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-amber-700" />
          </Card>
        </Link>
      )}
    </div>
  );
}
