import { useMemo, useState } from 'react';
import { Lightbulb, Plus, Search } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { addPlace } from '../lib/db';
import { CATEGORIES, CATEGORY_KEYS, IDEA_COLOR } from '../lib/categories';
import { fromGooglePlace } from '../lib/places';
import { useTripCtx } from '../lib/tripContext';
import type { Category } from '../lib/types';
import PlaceItem from '../components/PlaceItem';
import PlaceSearch from '../components/PlaceSearch';
import { Button, Empty, Sheet, inputClass } from '../components/ui';

/** Lieux « à placer » : sans jour ou hors des dates du voyage */
export default function Ideas() {
  const { trip, places, dayIndex } = useTripCtx();
  const { email } = useAuth();
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');

  const list = useMemo(() => places.filter((p) => dayIndex(p.date) < 0), [places, dayIndex]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((p) => {
      if (category !== 'all' && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.city ?? '').toLowerCase().includes(q) ||
        (p.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [list, category, query]);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Boîte à idées</h2>
          <p className="text-xs text-slate-500 sm:text-sm">
            {list.length} lieu{list.length > 1 ? 'x' : ''} en attente · Clique sur un lieu pour l&apos;attribuer à une journée.
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          Ajouter une idée
        </Button>
      </div>

      {list.length > 0 && (
        <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setCategory('all')}
              className={`shrink-0 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                category === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Toutes ({list.length})
            </button>
            {CATEGORY_KEYS.map((key) => {
              const count = list.filter((p) => p.category === key).length;
              if (count === 0) return null;
              const meta = CATEGORIES[key];
              const Icon = meta.icon;
              const active = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(active ? 'all' : key)}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? 'border-brand bg-rose-50 text-brand'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {meta.shortLabel} ({count})
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
              placeholder="Rechercher une idée…"
              className={`${inputClass} py-2 pl-9`}
            />
          </div>
        </section>
      )}

      {list.length === 0 ? (
        <Empty icon={<Lightbulb className="h-6 w-6" />} title="Aucune idée en attente">
          <p className="max-w-sm text-xs text-slate-500">
            Enregistre ici tes restaurants, visites ou adresses repérées avant de les placer dans ton planning.
          </p>
          <Button className="mt-2" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" />
            Ajouter ma première idée
          </Button>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty icon={<Search className="h-6 w-6" />} title="Aucun résultat">
          <button
            type="button"
            onClick={() => {
              setCategory('all');
              setQuery('');
            }}
            className="cursor-pointer text-xs font-semibold text-brand hover:underline"
          >
            Réinitialiser les filtres
          </button>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((p, i) => (
            <PlaceItem key={p.id} place={p} index={i} list={filtered} color={IDEA_COLOR} />
          ))}
        </div>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Nouvelle idée">
        <PlaceSearch
          autoFocus
          onPick={async (gp) => {
            await addPlace(trip.id, fromGooglePlace(gp, { date: null, addedBy: email ?? undefined }), places);
            setAdding(false);
          }}
        />
      </Sheet>
    </div>
  );
}
