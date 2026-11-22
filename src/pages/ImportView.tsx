import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { ArrowLeft, Download, FileUp, Lightbulb, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { importItinerary, type AiItinerary, type AiPlace } from '../lib/ai';
import { addPlacesBatch, setDayInfo } from '../lib/db';
import { CATEGORIES } from '../lib/categories';
import { formatDay } from '../lib/dates';
import { fromGooglePlace, searchPlace } from '../lib/places';
import { useTripCtx } from '../lib/tripContext';
import type { NewPlace } from '../lib/types';
import { Button, Card, Field, Spinner, inputClass } from '../components/ui';

export default function ImportView() {
  const { trip, places, dates } = useTripCtx();
  const { email } = useAuth();
  const lib = useMapsLibrary('places');
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AiItinerary | null>(null);

  const analyse = async () => {
    setBusy(
      file?.name.toLowerCase().endsWith('.json') || text.trim().startsWith('{')
        ? 'Lecture du planning…'
        : 'Gemini lit ton planning…',
    );
    setError(null);
    try {
      const parsed = await importItinerary(trip, text, file);
      const count = parsed.days.reduce((n, d) => n + d.places.length, 0) + (parsed.ideas?.length ?? 0);
      if (count === 0) {
        setError('Aucun lieu trouvé dans ce fichier ou texte. Vérifie le format ou essaie un export PDF/texte.');
        return;
      }
      setResult(parsed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const total = result ? result.days.reduce((n, d) => n + d.places.length, 0) + (result.ideas?.length ?? 0) : 0;

  const save = async () => {
    if (!result) return;
    setError(null);
    try {
      const items: { p: AiPlace; date: string | null; city?: string }[] = [
        ...result.days.flatMap((d) => d.places.map((p) => ({ p, date: d.date, city: d.city }))),
        ...(result.ideas ?? []).map((p) => ({ p, date: null })),
      ];
      const out: NewPlace[] = [];
      let n = 0;
      for (const { p, date, city } of items) {
        const c = p.city ?? city;
        const base = { date, time: p.time, notes: p.notes, addedBy: `Import (${email ?? ''})` };
        if (p.lat != null && p.lng != null) {
          out.push({
            ...base,
            name: p.name,
            city: c,
            category: p.category,
            lat: p.lat,
            lng: p.lng,
            address: p.address,
            googlePlaceId: p.googlePlaceId,
            googleMapsUri: p.googleMapsUri,
          });
          continue;
        }
        setBusy(`Localisation des lieux sur Google Maps… ${++n}/${items.length}`);
        const gp = lib ? await searchPlace(lib, c ? `${p.name}, ${c}` : p.name) : null;
        out.push(gp ? { ...fromGooglePlace(gp, base), category: p.category } : { ...base, name: p.name, city: c, category: p.category });
      }
      setBusy('Enregistrement…');
      await addPlacesBatch(trip.id, out, places);
      for (const d of result.days) {
        if (d.title || d.city) await setDayInfo(trip.id, d.date, { title: d.title ?? '', city: d.city ?? '' });
      }
      navigate('..');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (busy)
    return (
      <div className="py-24">
        <Spinner label={busy} />
      </div>
    );

  if (result)
    return (
      <div className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Aperçu de l&apos;import</h2>
            <p className="text-xs text-slate-500 sm:text-sm">
              {total} lieux trouvés{result.source === 'json' ? ' (lecture directe du JSON)' : ''}. Vérifie puis valide : les lieux sans coordonnées seront localisés sur Google Maps.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setResult(null)}>
              Retour
            </Button>
            <Button disabled={total === 0} onClick={save}>
              <Download className="h-4 w-4" />
              Importer {total} lieux
            </Button>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {result.days.map((d) => (
            <Card key={d.date} className="space-y-2.5 p-4">
              <div>
                <p className="font-bold capitalize text-slate-900">
                  {formatDay(d.date)} {d.city && <span className="font-normal text-slate-500">· {d.city}</span>}
                  {!dates.includes(d.date) && (
                    <span className="ml-1.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
                      hors dates → idées
                    </span>
                  )}
                </p>
                {d.title && <p className="text-xs text-slate-500">{d.title}</p>}
              </div>
              <ul className="space-y-1.5 text-sm">
                {d.places.map((p, i) => {
                  const cat = CATEGORIES[p.category] ?? CATEGORIES.other;
                  const Icon = cat.icon;
                  return (
                    <li key={i} className="flex items-center gap-2 text-slate-700">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${cat.iconBgClass}`}>
                        <Icon className="h-3 w-3" />
                      </span>
                      {p.time && <span className="tabular-nums text-xs text-slate-400">{p.time}</span>}
                      <span className="truncate font-medium">{p.name}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>

        {!!result.ideas?.length && (
          <Card className="space-y-2.5 p-4">
            <p className="flex items-center gap-2 font-bold text-slate-900">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Idées sans jour ({result.ideas.length})
            </p>
            <ul className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
              {result.ideas.map((p, i) => {
                const cat = CATEGORIES[p.category] ?? CATEGORIES.other;
                const Icon = cat.icon;
                return (
                  <li key={i} className="flex items-center gap-2 text-slate-700">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${cat.iconBgClass}`}>
                      <Icon className="h-3 w-3" />
                    </span>
                    <span className="truncate">{p.name}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
      <div className="space-y-2">
        <Link
          to=".."
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour au planning
        </Link>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Importer un planning</h2>
        <p className="text-xs text-slate-500 sm:text-sm">
          Depuis Wanderlog ou un autre outil : importe un export <b>JSON</b>, <b>PDF</b>, <b>KML</b>, une capture d&apos;écran ou colle simplement le texte de ton itinéraire.
        </p>
      </div>

      <Card className="space-y-5 p-5">
        <Field label="Fichier (JSON, PDF, image, KML, CSV, TXT…)">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 px-4 py-6 text-center transition hover:border-brand/40 hover:bg-rose-50/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-brand">
              <FileUp className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {file ? file.name : 'Choisir un fichier à importer'}
            </p>
            <p className="text-xs text-slate-500">JSON, PDF, image, KML, GPX, CSV ou TXT</p>
            <input
              type="file"
              accept=".pdf,.txt,.csv,.json,.kml,.gpx,.xml,.md,.html,image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </Field>

        <Field label="Et/ou texte ou JSON collé">
          <textarea
            className={inputClass}
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Jour 1 – Centre historique\n- Visite du quartier\n- Déjeuner au marché local\n…'}
          />
        </Field>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        <Button className="w-full py-3" disabled={!file && !text.trim()} onClick={analyse}>
          <Sparkles className="h-4 w-4" />
          Analyser le planning
        </Button>
      </Card>
    </div>
  );
}
