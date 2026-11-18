import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { addPlace, setDayInfo } from '../lib/db';
import { dayColor } from '../lib/categories';
import { formatDay } from '../lib/dates';
import { fromGooglePlace } from '../lib/places';
import { useTripCtx } from '../lib/tripContext';
import PlaceItem from '../components/PlaceItem';
import PlaceSearch from '../components/PlaceSearch';
import AiSuggestSheet from '../components/AiSuggestSheet';
import { Button, Empty, Sheet, inputClass } from '../components/ui';

export default function DayView() {
  const { date = '' } = useParams();
  const { trip, places, days, dayIndex, dates } = useTripCtx();
  const { email } = useAuth();
  const [adding, setAdding] = useState(false);
  const [ai, setAi] = useState(false);

  const i = dayIndex(date);
  const info = days[date];
  const list = places.filter((p) => p.date === date);
  const color = dayColor(i);
  const prev = dates[i - 1];
  const next = dates[i + 1];

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Link to={prev ? `../day/${prev}` : '..'} className="px-2 text-2xl text-slate-400">
          ‹
        </Link>
        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color }}>
            JOUR {i + 1}
          </p>
          <p className="capitalize text-slate-600">{formatDay(date)}</p>
        </div>
        <Link to={next ? `../day/${next}` : '..'} className="px-2 text-2xl text-slate-400">
          ›
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
          <Empty icon="🗓️" title="Rien de prévu pour l'instant">
            <p className="text-sm">Ajoute un lieu ou demande des idées à Gemini.</p>
          </Empty>
        )}
        {list.map((p, idx) => (
          <PlaceItem key={p.id} place={p} index={idx} list={list} color={color} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => setAdding(true)}>+ Ajouter un lieu</Button>
        <Button variant="secondary" onClick={() => setAi(true)}>
          ✨ Idées IA
        </Button>
      </div>

      <textarea
        key={`n-${date}`}
        className={inputClass}
        rows={3}
        placeholder="📝 Notes du jour (réservations, budget…)"
        defaultValue={info?.notes ?? ''}
        onBlur={(e) => e.target.value !== (info?.notes ?? '') && setDayInfo(trip.id, date, { notes: e.target.value })}
      />

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
    </div>
  );
}
