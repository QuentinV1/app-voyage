import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
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
    setBusy('Gemini lit ton planning…');
    setError(null);
    try {
      setResult(await importItinerary(trip, text, file));
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
        setBusy(`Localisation des lieux sur Google Maps… ${++n}/${items.length}`);
        const c = p.city ?? city;
        const gp = lib ? await searchPlace(lib, c ? `${p.name}, ${c}` : p.name) : null;
        const base = { date, time: p.time, notes: p.notes, addedBy: `📥 Import (${email ?? ''})` };
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
      <div className="py-20">
        <Spinner label={busy} />
      </div>
    );

  if (result)
    return (
      <div className="space-y-4 p-4">
        <h2 className="text-xl font-bold">Aperçu de l'import</h2>
        <p className="text-sm text-slate-500">
          {total} lieux trouvés. Vérifie puis valide : chaque lieu sera localisé sur Google Maps.
        </p>
        {result.days.map((d) => (
          <Card key={d.date} className="p-4">
            <p className="font-semibold capitalize">
              {formatDay(d.date)} {d.city && <span className="font-normal text-slate-500">· {d.city}</span>}
              {!dates.includes(d.date) && <span className="ml-1 text-xs text-amber-600">(hors dates → idées)</span>}
            </p>
            {d.title && <p className="text-sm text-slate-500">{d.title}</p>}
            <ul className="mt-2 space-y-1 text-sm">
              {d.places.map((p, i) => (
                <li key={i}>
                  {p.time && <span className="text-slate-500">{p.time} </span>}
                  {CATEGORIES[p.category]?.emoji} {p.name}
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {!!result.ideas?.length && (
          <Card className="p-4">
            <p className="font-semibold">💡 Idées sans jour</p>
            <ul className="mt-2 space-y-1 text-sm">
              {result.ideas.map((p, i) => (
                <li key={i}>
                  {CATEGORIES[p.category]?.emoji} {p.name}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setResult(null)}>
            Retour
          </Button>
          <Button className="flex-1" disabled={total === 0} onClick={save}>
            Importer {total} lieux
          </Button>
        </div>
      </div>
    );

  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="text-xl font-bold">📥 Importer un planning</h2>
        <p className="text-sm text-slate-500">
          Depuis Wanderlog : exporte ou imprime ton voyage en <b>PDF</b>, ou copie le texte de l'itinéraire, ou fais des
          captures d'écran. Gemini replace chaque lieu au bon jour.
        </p>
      </div>
      <Field label="Fichier (PDF, image, KML, CSV, TXT…)">
        <input
          type="file"
          accept=".pdf,.txt,.csv,.json,.kml,.gpx,.xml,.md,.html,image/*"
          className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-rose-50 file:px-4 file:py-2 file:text-brand"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </Field>
      <Field label="… et/ou texte collé">
        <textarea
          className={inputClass}
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Jour 1 – Tokyo\n- Senso-ji\n- Déjeuner à Ichiran Shibuya\n…'}
        />
      </Field>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button className="w-full" disabled={!file && !text.trim()} onClick={analyse}>
        ✨ Analyser avec Gemini
      </Button>
    </div>
  );
}
