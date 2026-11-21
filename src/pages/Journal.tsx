import { useMemo, useState } from 'react';
import { BookOpen, MapPin, Pencil, Plus, Trash2, User, X } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { deleteJournalEntry } from '../lib/db';
import { formatDay, formatShort } from '../lib/dates';
import { dayColor } from '../lib/categories';
import { useTripCtx } from '../lib/tripContext';
import type { JournalEntry } from '../lib/types';
import { JournalFormSheet, MOODS } from '../components/JournalFormSheet';
import { Button, Card, Empty } from '../components/ui';

export default function Journal() {
  const { trip, journal, dates, dayIndex, memberProfiles } = useTripCtx();
  const { email } = useAuth();
  const [filter, setFilter] = useState<'all' | 'mine' | string>('all');
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      journal.filter((j) => {
        if (filter === 'all') return true;
        if (filter === 'mine') return j.authorEmail?.toLowerCase() === email;
        return j.date === filter;
      }),
    [journal, filter, email],
  );

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
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900">Carnet de voyage</h2>
          <p className="text-xs text-slate-500">
            {journal.length} souvenir{journal.length > 1 ? 's' : ''} partagé{journal.length > 1 ? 's' : ''}
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
          Souvenir
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('all')}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
            filter === 'all' ? 'bg-brand text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
          }`}
        >
          Tous ({journal.length})
        </button>
        <button
          onClick={() => setFilter('mine')}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
            filter === 'mine' ? 'bg-brand text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
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
              onClick={() => setFilter(d)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${
                filter === d ? 'text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'
              }`}
              style={filter === d ? { background: dayColor(i) } : undefined}
            >
              J{i + 1} · {formatShort(d)} ({count})
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <Card className="p-4">
          <Empty icon="" title="Aucun souvenir pour cette sélection">
            <BookOpen className="mx-auto mb-1 h-8 w-8 text-slate-300" />
            <p className="text-sm">Ajoute tes photos, coups de cœur et anecdotes de la journée.</p>
          </Empty>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((j) => {
            const idx = dayIndex(j.date);
            const moodMeta = MOODS.find((m) => m.value === j.mood);
            const MoodIcon = moodMeta?.icon;
            return (
              <Card key={j.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                        style={{ background: dayColor(idx) }}
                      >
                        {idx >= 0 ? `Jour ${idx + 1}` : formatShort(j.date)}
                      </span>
                      <span className="text-xs capitalize text-slate-500">{formatDay(j.date)}</span>
                      {moodMeta && MoodIcon && (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${moodMeta.badgeClass}`}
                        >
                          <MoodIcon className="h-3 w-3" />
                          {moodMeta.label}
                        </span>
                      )}
                    </div>
                    {j.title && <h3 className="mt-1.5 break-words font-semibold text-slate-900">{j.title}</h3>}
                    {j.location && (
                      <p className="mt-0.5 flex items-center gap-1 break-words text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
                        <span className="min-w-0 break-words">{j.location}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => {
                        setEditing(j);
                        setOpenForm(true);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                      aria-label="Modifier"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(j)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
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
                        className="overflow-hidden rounded-xl bg-slate-100"
                      >
                        <img
                          src={src}
                          alt={j.title || `Photo ${pIdx + 1}`}
                          className={`w-full object-cover ${j.photos.length === 1 ? 'max-h-72' : 'h-36'}`}
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {resolveAuthor(j)}
                  </span>
                  <span>{new Date(j.createdAt).toLocaleDateString('fr-FR')}</span>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Fermer l'image"
            className="absolute right-4 top-4 rounded-full bg-white/15 p-2 text-white"
          >
            <X className="h-6 w-6" />
          </button>
          <img src={lightbox} alt="Aperçu" className="max-h-[90vh] max-w-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
