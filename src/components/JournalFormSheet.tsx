import { useEffect, useRef, useState } from 'react';
import { Camera, Coffee, Flame, ImagePlus, Smile, Sparkles, Trash2, Utensils } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { addJournalEntry, updateJournalEntry } from '../lib/db';
import { formatShort } from '../lib/dates';
import {
  MAX_PHOTOS_PER_ENTRY,
  MAX_TOTAL_PHOTOS_BYTES,
  compressImage,
  estimatePhotosBytes,
} from '../lib/photos';
import { useTripCtx } from '../lib/tripContext';
import type { JournalEntry, JournalMood } from '../lib/types';
import { Button, Field, Sheet, inputClass } from './ui';

export const MOODS: { value: JournalMood; label: string; icon: typeof Sparkles; badgeClass: string }[] = [
  { value: 'amazing', label: 'Inoubliable', icon: Sparkles, badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'happy', label: 'Super', icon: Smile, badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' },
  { value: 'food', label: 'Gourmand', icon: Utensils, badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'chill', label: 'Détente', icon: Coffee, badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'tired', label: 'Intense', icon: Flame, badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' },
];

export function JournalFormSheet({
  open,
  onClose,
  entry,
  initialDate,
  initialLocation,
}: {
  open: boolean;
  onClose: () => void;
  entry?: JournalEntry | null;
  initialDate?: string;
  initialLocation?: string;
}) {
  const { trip, dates, places } = useTripCtx();
  const { user, email } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [date, setDate] = useState(initialDate || dates[0] || trip.startDate);
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState(initialLocation || '');
  const [mood, setMood] = useState<JournalMood>('happy');
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (entry) {
      setDate(entry.date);
      setTitle(entry.title ?? '');
      setLocation(entry.location ?? '');
      setMood(entry.mood ?? 'happy');
      setContent(entry.content);
      setPhotos(entry.photos ?? []);
    } else {
      setDate(initialDate || dates[0] || trip.startDate);
      setTitle('');
      setLocation(initialLocation ?? '');
      setMood('happy');
      setContent('');
      setPhotos([]);
    }
  }, [open, entry, initialDate, initialLocation, dates, trip.startDate]);

  const dayPlaces = places.filter((p) => p.date === date);

  const onFilesSelected = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setError(null);
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_PHOTOS_PER_ENTRY) {
        setError(`Maximum ${MAX_PHOTOS_PER_ENTRY} photos par souvenir.`);
        break;
      }
      try {
        const compressed = await compressImage(file);
        if (estimatePhotosBytes([...next, compressed]) > MAX_TOTAL_PHOTOS_BYTES) {
          setError('Taille totale des photos trop élevée pour un seul souvenir.');
          break;
        }
        next.push(compressed);
      } catch {
        setError('Impossible de traiter une des photos.');
      }
    }
    setPhotos(next);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !date) return;
    setBusy(true);
    setError(null);
    try {
      if (entry) {
        await updateJournalEntry(trip.id, entry.id, {
          date,
          title: title.trim() || undefined,
          location: location.trim() || undefined,
          mood,
          content: content.trim(),
          photos,
        });
      } else {
        await addJournalEntry(trip.id, {
          date,
          title: title.trim() || undefined,
          location: location.trim() || undefined,
          mood,
          content: content.trim(),
          photos,
          authorUid: user?.uid,
          authorEmail: email ?? undefined,
          authorName: user?.displayName || email?.split('@')[0] || undefined,
        });
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={entry ? 'Modifier le souvenir' : 'Nouveau souvenir'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Jour / Date">
            {dates.length > 0 ? (
              <select className={inputClass} value={date} onChange={(e) => setDate(e.target.value)}>
                {dates.map((d, i) => (
                  <option key={d} value={d}>
                    J{i + 1} · {formatShort(d)}
                  </option>
                ))}
                {!dates.includes(date) && <option value={date}>{date}</option>}
              </select>
            ) : (
              <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
            )}
          </Field>
          <Field label="Titre (optionnel)">
            <input
              className={inputClass}
              placeholder="ex : Coucher de soleil"
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Lieu / Étape">
          <input
            className={inputClass}
            placeholder="ex : Fushimi Inari, Kyoto"
            maxLength={120}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
          {dayPlaces.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {dayPlaces.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLocation(p.name)}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-200"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </Field>

        <Field label="Ambiance">
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => {
              const Icon = m.icon;
              const active = mood === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(m.value)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active ? 'border-brand bg-rose-50 text-brand' : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Récit / Notes">
          <textarea
            className={inputClass}
            rows={4}
            required
            maxLength={4000}
            placeholder="Raconte ce moment, une bonne adresse, une anecdote…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </Field>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">
              Photos ({photos.length}/{MAX_PHOTOS_PER_ENTRY})
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onFilesSelected(e.target.files)}
            />
            {photos.length < MAX_PHOTOS_PER_ENTRY && (
              <Button type="button" variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
                Ajouter des photos
              </Button>
            )}
          </div>

          {photos.length > 0 ? (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((src, idx) => (
                <div key={idx} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100">
                  <img src={src} alt={`Souvenir ${idx + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Supprimer la photo"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-4 text-sm text-slate-500 active:bg-slate-50"
            >
              <Camera className="h-4 w-4" />
              Compresse automatiquement pour le mode hors-ligne
            </button>
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy || !content.trim()}>
          {busy ? 'Enregistrement…' : entry ? 'Enregistrer les modifications' : 'Publier dans le carnet'}
        </Button>
      </form>
    </Sheet>
  );
}
