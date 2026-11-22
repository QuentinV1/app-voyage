import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  MapPin,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { addPlace, setDayInfo } from '../lib/db';
import { dayColor } from '../lib/categories';
import { formatDay, formatShort } from '../lib/dates';
import { fromGooglePlace } from '../lib/places';
import { useTripCtx } from '../lib/tripContext';
import PlaceItem from '../components/PlaceItem';
import PlaceSearch from '../components/PlaceSearch';
import AiSuggestSheet from '../components/AiSuggestSheet';
import { JournalFormSheet } from '../components/JournalFormSheet';
import { Button, Card, Empty, Field, Sheet, inputClass } from '../components/ui';

export default function DayView() {
  const { date = '' } = useParams();
  const { trip, places, days, journal, dayIndex, dates } = useTripCtx();
  const { email } = useAuth();
  const [adding, setAdding] = useState(false);
  const [ai, setAi] = useState(false);
  const [addMemory, setAddMemory] = useState(false);

  const i = dayIndex(date);
  const info = days[date];
  const list = places.filter((p) => p.date === date);
  const dayMemories = journal.filter((j) => j.date === date);
  const color = dayColor(i);
  const prev = dates[i - 1];
  const next = dates[i + 1];

  return (
    <div className="space-y-5 p-4 sm:p-6">
      {/* Barre de navigation rapide entre jours */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            to=".."
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Tout le planning
          </Link>

          <div className="flex items-center gap-1.5">
            <Link
              to={prev ? `../day/${prev}` : '..'}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              aria-label="Jour précédent"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Précédent</span>
            </Link>
            <Link
              to={next ? `../day/${next}` : '..'}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
              aria-label="Jour suivant"
            >
              <span className="hidden sm:inline">Suivant</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Bandeau de sélection rapide J1..Jn */}
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto pb-1">
          {dates.map((d, idx) => {
            const active = d === date;
            const c = dayColor(idx);
            const count = places.filter((p) => p.date === d).length;
            return (
              <Link
                key={d}
                to={`../day/${d}`}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  active
                    ? 'border-transparent text-white shadow-xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                }`}
                style={active ? { backgroundColor: c } : undefined}
              >
                <span>J{idx + 1}</span>
                <span className={active ? 'text-white/80' : 'text-slate-400'}>{formatShort(d)}</span>
                {count > 0 && (
                  <span
                    className={`tabular-nums rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* En-tête de la journée */}
      <Card className="overflow-hidden">
        <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
        <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="flex items-center gap-3.5">
            <div
              className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-xs"
              style={{ backgroundColor: color }}
            >
              <span className="text-[10px] font-semibold uppercase leading-none opacity-90">Jour</span>
              <span className="tabular-nums text-lg font-extrabold leading-tight">{i + 1}</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 capitalize">
                {formatDay(date)}
              </p>
              <h2 className="text-xl font-bold text-slate-900">
                {info?.title || info?.city || `Programme du jour ${i + 1}`}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4 shrink-0" />
              Ajouter un lieu
            </Button>
            <Button variant="secondary" onClick={() => setAi(true)}>
              <Sparkles className="h-4 w-4 shrink-0 text-brand" />
              Idées IA
            </Button>
          </div>
        </div>
      </Card>

      {/* Grille 2 colonnes sur desktop : Timeline étapes (gauche) + Détails & Carnet (droite) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Colonne principale : Étapes de la journée */}
        <section className="space-y-3 lg:col-span-7 xl:col-span-8">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              <MapPin className="h-4 w-4 text-brand" />
              Étapes de la journée ({list.length})
            </h3>
            {list.length > 0 && (
              <Link to="../../map" className="text-xs font-semibold text-brand hover:underline">
                Voir sur la carte
              </Link>
            )}
          </div>

          {list.length === 0 ? (
            <Empty icon={<CalendarDays className="h-6 w-6" />} title="Aucune étape prévue ce jour">
              <p className="max-w-sm text-xs text-slate-500">
                Ajoute un lieu via Google Places ou laisse Gemini te proposer un programme sur mesure.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <Button onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" />
                  Ajouter un lieu
                </Button>
                <Button variant="secondary" onClick={() => setAi(true)}>
                  <Sparkles className="h-4 w-4 text-brand" />
                  Suggestions IA
                </Button>
              </div>
            </Empty>
          ) : (
            <div className="space-y-2.5">
              {list.map((p, idx) => (
                <PlaceItem key={p.id} place={p} index={idx} list={list} color={color} />
              ))}
            </div>
          )}
        </section>

        {/* Colonne latérale : Infos de la journée & Carnet */}
        <aside className="space-y-4 lg:col-span-5 xl:col-span-4">
          <Card className="space-y-3.5 p-4">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <FileText className="h-4 w-4 text-brand" />
              Informations & notes
            </h3>
            <Field label="Titre de la journée">
              <input
                key={`t-${date}`}
                className={inputClass}
                maxLength={100}
                placeholder="ex : Quartier historique & gastronomie"
                defaultValue={info?.title ?? ''}
                onBlur={(e) => e.target.value !== (info?.title ?? '') && setDayInfo(trip.id, date, { title: e.target.value })}
              />
            </Field>
            <Field label="Ville / secteur">
              <input
                key={`c-${date}`}
                className={inputClass}
                maxLength={80}
                placeholder="ex : Kyoto, Shibuya…"
                defaultValue={info?.city ?? ''}
                onBlur={(e) => e.target.value !== (info?.city ?? '') && setDayInfo(trip.id, date, { city: e.target.value })}
              />
            </Field>
            <Field label="Notes du jour">
              <textarea
                key={`n-${date}`}
                className={inputClass}
                rows={4}
                maxLength={2000}
                placeholder="Réservations, horaires de train, budget, rappels…"
                defaultValue={info?.notes ?? ''}
                onBlur={(e) => e.target.value !== (info?.notes ?? '') && setDayInfo(trip.id, date, { notes: e.target.value })}
              />
            </Field>
          </Card>

          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-900">
                <BookOpen className="h-4 w-4 shrink-0 text-brand" />
                <span className="truncate">Carnet du jour ({dayMemories.length})</span>
              </h3>
              <Button variant="secondary" className="shrink-0 px-3 py-1.5 text-xs" onClick={() => setAddMemory(true)}>
                <Plus className="h-3.5 w-3.5" />
                Souvenir
              </Button>
            </div>

            {dayMemories.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                Aucun souvenir enregistré pour cette journée. Ajoute une photo ou une anecdote au fil de ta visite.
              </p>
            ) : (
              <div className="space-y-2.5">
                {dayMemories.map((m) => (
                  <Link
                    key={m.id}
                    to="../../journal"
                    className="block rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm transition hover:border-slate-200 hover:bg-slate-100/80"
                  >
                    {m.title && <p className="font-semibold text-slate-900">{m.title}</p>}
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{m.content}</p>
                    {m.photos?.length > 0 && (
                      <div className="mt-2 flex gap-1.5">
                        {m.photos.slice(0, 3).map((src, pIdx) => (
                          <img
                            key={pIdx}
                            src={src}
                            alt=""
                            className="h-12 w-12 rounded-lg object-cover ring-1 ring-slate-200"
                          />
                        ))}
                        {m.photos.length > 3 && (
                          <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-600">
                            +{m.photos.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </aside>
      </div>

      <Sheet open={adding} onClose={() => setAdding(false)} title="Ajouter un lieu">
        <PlaceSearch
          autoFocus
          onPick={async (gp) => {
            await addPlace(trip.id, fromGooglePlace(gp, { date, addedBy: email ?? undefined }), places);
            setAdding(false);
          }}
        />
      </Sheet>

      <AiSuggestSheet open={ai} onClose={() => setAi(false)} date={date} defaultCity={info?.city ?? ''} existing={list} />

      <JournalFormSheet
        open={addMemory}
        onClose={() => setAddMemory(false)}
        initialDate={date}
        initialLocation={info?.city ?? ''}
      />
    </div>
  );
}
