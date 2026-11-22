import { useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { suggestForDay, type AiPlace } from '../lib/ai';
import { addPlacesBatch } from '../lib/db';
import { CATEGORIES } from '../lib/categories';
import { fromGooglePlace, searchPlace } from '../lib/places';
import { useTripCtx } from '../lib/tripContext';
import type { NewPlace, Place } from '../lib/types';
import { Button, Field, Sheet, Spinner, inputClass } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  defaultCity: string;
  existing: Place[];
}

/** Génère des suggestions Gemini pour une journée, puis les géolocalise via Google Places */
export default function AiSuggestSheet({ open, onClose, date, defaultCity, existing }: Props) {
  const { trip, places } = useTripCtx();
  const { email } = useAuth();
  const lib = useMapsLibrary('places');
  const [city, setCity] = useState(defaultCity);
  const [wishes, setWishes] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AiPlace[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const generate = async () => {
    setBusy('Gemini réfléchit…');
    setError(null);
    try {
      const res = await suggestForDay(trip, date, city, wishes, existing.map((p) => p.name));
      setResults(res);
      setSelected(new Set(res.map((_, i) => i)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    const chosen = results.filter((_, i) => selected.has(i));
    setBusy('Recherche des lieux sur Google Maps…');
    try {
      const out: NewPlace[] = [];
      for (const r of chosen) {
        const gp = lib ? await searchPlace(lib, `${r.name} ${r.city ?? city}`) : null;
        const base = { date, addedBy: `IA (${email ?? ''})`, time: r.time, notes: r.notes };
        out.push(
          gp
            ? { ...fromGooglePlace(gp, base), category: r.category }
            : { ...base, name: r.name, city: r.city ?? city, category: r.category },
        );
      }
      await addPlacesBatch(trip.id, out, places);
      setResults([]);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggle = (i: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <Sheet open={open} onClose={onClose} title="Suggestions IA pour la journée">
      {busy ? (
        <div className="py-10">
          <Spinner label={busy} />
        </div>
      ) : results.length === 0 ? (
        <div className="space-y-4">
          <Field label="Ville / quartier">
            <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Rome, Lisbonne, Tokyo…" />
          </Field>
          <Field label="Vos envies">
            <textarea
              className={inputClass}
              rows={3}
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
              placeholder="Visites tôt le matin pour éviter la foule, resto local le midi, pas trop de marche…"
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button className="w-full" onClick={generate}>
            <Sparkles className="h-4 w-4" />
            Générer avec Gemini
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((r, i) => {
            const cat = CATEGORIES[r.category] ?? CATEGORIES.other;
            const Icon = cat.icon;
            return (
              <label key={i} className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-rose-600"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${cat.badgeClass}`}>
                      <Icon className="h-3 w-3" />
                      {cat.shortLabel}
                    </span>
                    {r.time && <span className="tabular-nums text-xs font-medium text-slate-500">{r.time}</span>}
                  </div>
                  <p className="break-words text-sm font-semibold text-slate-900">{r.name}</p>
                  {r.notes && <p className="break-words text-xs text-slate-600">{r.notes}</p>}
                </div>
              </label>
            );
          })}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => setResults([])}>
              Recommencer
            </Button>
            <Button className="flex-1" disabled={selected.size === 0} onClick={add}>
              Ajouter {selected.size} lieu{selected.size > 1 ? 'x' : ''}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
