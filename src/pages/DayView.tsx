import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, ChevronLeft, ChevronRight, Plus, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { addPlace, setDayInfo } from '../lib/db';
import { dayColor } from '../lib/categories';
import { formatDay } from '../lib/dates';
import { fromGooglePlace } from '../lib/places';
import { useTripCtx } from '../lib/tripContext';
import PlaceItem from '../components/PlaceItem';
import PlaceSearch from '../components/PlaceSearch';
import AiSuggestSheet from '../components/AiSuggestSheet';
import { JournalFormSheet } from '../components/JournalFormSheet';
import { Button, Card, Empty, Sheet, inputClass } from '../components/ui';

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
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Link to={prev ? `../day/${prev}` : '..'} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Jour précédent">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color }}>
            JOUR {i + 1}
          </p>
          <p className="capitalize text-slate-600">{formatDay(date)}</p>
        </div>
        <Link to={next ? `../day/${next}` : '..'} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Jour suivant">
          <ChevronRight className="h-5 w-5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          key={`t-${date}`}
          className={inputClass}
          placeholder="Titre (ex : Kyoto zen)"
          defaultValue={info?.title ?? ''}
          onBlur={(e) => e.target.value !== (info?.title ?? '') && setDayInfo(trip.id, date, { title: e.target.value })}
        />
        <input
          key={`c-${date}`}
          className={inputClass}
          placeholder="Ville"
          defaultValue={info?.city ?? ''}
          onBlur={(e) => e.target.value !== (info?.city ?? '') && setDayInfo(trip.id, date, { city: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        {list.length === 0 && (
          <Empty icon="" title="Rien de prévu pour l'instant">
            <p className="text-sm">Ajoute un lieu ou demande des idées à Gemini.</p>
          </Empty>
        )}
        {list.map((p, idx) => (
          <PlaceItem key={p.id} place={p} index={idx} list={list} color={color} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setAdding(true)}>
          <Plus className="h-4 w-4" />
          Ajouter un lieu
        </Button>
        <Button variant="secondary" onClick={() => setAi(true)}>
          <Sparkles className="h-4 w-4 text-brand" />
          Idées IA
        </Button>
      </div>

      <textarea
        key={`n-${date}`}
        className={inputClass}
        rows={3}
        placeholder="Notes du jour (réservations, budget…)"
        defaultValue={info?.notes ?? ''}
        onBlur={(e) => e.target.value !== (info?.notes ?? '') && setDayInfo(trip.id, date, { notes: e.target.value })}
      />

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold text-slate-800">
            <BookOpen className="h-4 w-4 text-brand" />
            Carnet du jour ({dayMemories.length})
          </h3>
          <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={() => setAddMemory(true)}>
            <Plus className="h-3.5 w-3.5" />
            Souvenir
          </Button>
        </div>

        {dayMemories.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun souvenir enregistré pour cette journée.</p>
        ) : (
          <div className="space-y-2">
            {dayMemories.map((m) => (
              <Link
                key={m.id}
                to="../../journal"
                className="block rounded-xl bg-slate-50 p-3 text-sm transition hover:bg-slate-100"
              >
                {m.title && <p className="font-medium text-slate-900">{m.title}</p>}
                <p className="line-clamp-2 text-xs text-slate-600">{m.content}</p>
                {m.photos?.length > 0 && (
                  <p className="mt-1 text-[11px] text-brand">
                    {m.photos.length} photo{m.photos.length > 1 ? 's' : ''}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </Card>

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
