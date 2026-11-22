import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Camera, MapPin, Pencil, Plus, Search, Trash2, User, Users, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { deleteJournalEntry } from '../lib/db';
import { formatDay, formatShort } from '../lib/dates';
import { dayColor } from '../lib/categories';
import { useTripCtx } from '../lib/tripContext';
import type { JournalEntry, JournalMood } from '../lib/types';
import { JournalFormSheet, MOODS } from '../components/JournalFormSheet';
import { Button, Card, Empty, KpiCard, inputClass } from '../components/ui';

export default function Journal() {
  const { trip, journal, dates, dayIndex, memberProfiles } = useTripCtx();
  const { email } = useAuth();
  const [filter, setFilter] = useState<'all' | 'mine' | string>('all');
  const [moodFilter, setMoodFilter] = useState<JournalMood | 'all'>('all');
  const [query, setQuery] = useState('');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightbox]);

  const stats = useMemo(() => {
    const totalPhotos = journal.reduce((acc, j) => acc + (j.photos?.length ?? 0), 0);
    const authors = new Set(journal.map((j) => (j.authorEmail || j.authorName || 'Anonyme').toLowerCase()));
    return { totalPhotos, authorsCount: authors.size };
  }, [journal]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return journal.filter((j) => {
      if (filter === 'mine' && j.authorEmail?.toLowerCase() !== email) return false;
      if (filter !== 'all' && filter !== 'mine' && j.date !== filter) return false;
      if (moodFilter !== 'all' && j.mood !== moodFilter) return false;
      if (!q) return true;
      return (
        (j.title ?? '').toLowerCase().includes(q) ||
        j.content.toLowerCase().includes(q) ||
        (j.location ?? '').toLowerCase().includes(q)
      );
    });
  }, [journal, filter, moodFilter, query, email]);

  const resolveAuthor = (j: JournalEntry) => {
    const mail = j.authorEmail?.toLowerCase();
    if (mail && memberProfiles[mail]?.displayName) return memberProfiles[mail].displayName;
    return j.authorName || j.authorEmail || 'Voyageur';
  };

  const handleDelete = async (j: JournalEntry) => {
    if (!confirm('Supprimer ce souvenir du carnet ?')) return;
    await deleteJournalEntry(trip.id, j.id);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Carnet de voyage</h2>
          <p className="text-xs text-slate-500 sm:text-sm">
            Souvenirs, anecdotes et photos partagés en temps réel avec le groupe.
          </p>
        </div>
        <Button
          className="shrink-0"
          onClick={() => {
            setEditing(null);
            setOpenForm(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nouveau souvenir
        </Button>
      </div>

      {/* KPIs */}
      <section className="grid grid-cols-3 gap-3">
        <KpiCard
          icon={<BookOpen className="h-5 w-5" />}
          label="Souvenirs"
          value={journal.length}
          tone="rose"
        />
        <KpiCard
          icon={<Camera className="h-5 w-5" />}
          label="Photos"
          value={stats.totalPhotos}
          tone="sky"
        />
        <KpiCard
          icon={<Users className="h-5 w-5" />}
          label="Auteurs"
          value={stats.authorsCount}
          tone="emerald"
        />
      </section>

      {/* Filtres & recherche */}
      <section className="space-y-2.5">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`shrink-0 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                filter === 'all'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Tous ({journal.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('mine')}
              className={`shrink-0 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                filter === 'mine'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Mes souvenirs
            </button>
            {dates.map((d, i) => {
              const count = journal.filter((j) => j.date === d).length;
              if (!count) return null;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setFilter(d)}
                  className={`shrink-0 cursor-pointer rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                    filter === d
                      ? 'text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                  style={filter === d ? { backgroundColor: dayColor(i) } : undefined}
                >
                  J{i + 1} · {formatShort(d)} ({count})
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
              placeholder="Rechercher dans le carnet…"
              className={`${inputClass} py-2 pl-9`}
            />
          </div>
        </div>

        {/* Filtres d'ambiance */}
        {journal.length > 0 && (
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setMoodFilter('all')}
              className={`shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                moodFilter === 'all'
                  ? 'border-brand bg-rose-50 text-brand'
                  : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
              }`}
            >
              Toutes ambiances
            </button>
            {MOODS.map((m) => {
              const Icon = m.icon;
              const active = moodFilter === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMoodFilter(active ? 'all' : m.value)}
                  className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                    active ? 'border-brand bg-rose-50 text-brand' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {m.label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Liste / Grille de souvenirs */}
      {visible.length === 0 ? (
        <Empty icon={<BookOpen className="h-6 w-6" />} title="Aucun souvenir pour cette sélection">
          <p className="max-w-sm text-xs text-slate-500">
            Ajoute tes photos, coups de cœur et anecdotes pour construire le carnet de ce voyage.
          </p>
          <Button
            className="mt-2"
            onClick={() => {
              setEditing(null);
              setOpenForm(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Écrire un souvenir
          </Button>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {visible.map((j) => {
            const idx = dayIndex(j.date);
            const moodMeta = MOODS.find((m) => m.value === j.mood);
            const MoodIcon = moodMeta?.icon;
            return (
              <Card key={j.id} className="flex flex-col justify-between gap-3.5 p-5 transition hover:border-slate-300 hover:shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="rounded-md px-2 py-0.5 text-xs font-bold text-white"
                          style={{ backgroundColor: dayColor(idx) }}
                        >
                          {idx >= 0 ? `Jour ${idx + 1}` : formatShort(j.date)}
                        </span>
                        <span className="text-xs font-medium capitalize text-slate-500">{formatDay(j.date)}</span>
                        {moodMeta && MoodIcon && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${moodMeta.badgeClass}`}
                          >
                            <MoodIcon className="h-3 w-3" />
                            {moodMeta.label}
                          </span>
                        )}
                      </div>
                      {j.title && <h3 className="mt-2 break-words text-base font-bold text-slate-900">{j.title}</h3>}
                      {j.location && (
                        <p className="mt-1 flex items-center gap-1 break-words text-xs font-medium text-slate-500">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
                          <span className="min-w-0 break-words">{j.location}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(j);
                          setOpenForm(true);
                        }}
                        className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(j)}
                        className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="whitespace-pre-line break-words text-sm leading-relaxed text-slate-700">{j.content}</p>

                  {j.photos?.length > 0 && (
                    <div className={`grid gap-2 ${j.photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                      {j.photos.map((src, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => setLightbox(src)}
                          className="group cursor-pointer overflow-hidden rounded-xl bg-slate-100"
                        >
                          <img
                            src={src}
                            alt={j.title || `Photo ${pIdx + 1}`}
                            className={`w-full object-cover transition duration-300 group-hover:scale-[1.03] ${
                              j.photos.length === 1 ? 'max-h-72' : 'h-40'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                    <User className="h-3.5 w-3.5" />
                    {resolveAuthor(j)}
                  </span>
                  <span className="tabular-nums">{new Date(j.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <JournalFormSheet
        open={openForm}
        onClose={() => {
          setOpenForm(false);
          setEditing(null);
        }}
        entry={editing}
        initialDate={filter !== 'all' && filter !== 'mine' ? filter : undefined}
      />

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-xs"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Fermer l'image"
            className="absolute right-4 top-4 cursor-pointer rounded-full bg-white/15 p-2.5 text-white transition hover:bg-white/25"
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightbox}
            alt="Aperçu"
            className="max-h-[90vh] max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
