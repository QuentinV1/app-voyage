import { useState } from 'react';
import { deletePlace, nextOrder, swapOrder, updatePlace } from '../lib/db';
import { CATEGORIES, CATEGORY_KEYS } from '../lib/categories';
import { formatDay } from '../lib/dates';
import { directionsLink, mapsLink } from '../lib/places';
import { useTripCtx } from '../lib/tripContext';
import type { Category, Place } from '../lib/types';
import { Button, Card, Field, Sheet, inputClass } from './ui';

interface Props {
  place: Place;
  index: number;
  list: Place[];
  color: string;
}

export default function PlaceItem({ place, index, list, color }: Props) {
  const { trip } = useTripCtx();
  const [edit, setEdit] = useState(false);
  const prev = list[index - 1];
  const next = list[index + 1];

  return (
    <>
      <Card className="flex items-stretch gap-3 p-3">
        <div className="flex flex-col items-center">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: color }}
          >
            {index + 1}
          </span>
          {place.time && <span className="mt-1 text-xs text-slate-500">{place.time}</span>}
        </div>

        <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(true)}>
          <p className="font-semibold leading-tight">
            {CATEGORIES[place.category]?.emoji ?? '📍'} {place.name}
          </p>
          {(place.city || place.address) && (
            <p className="truncate text-xs text-slate-500">{place.city ?? place.address}</p>
          )}
          {place.notes && <p className="mt-1 line-clamp-2 text-sm text-slate-600">{place.notes}</p>}
          {place.rating && <p className="mt-0.5 text-xs text-amber-600">★ {place.rating.toFixed(1)}</p>}
        </button>

        <div className="flex flex-col justify-between">
          <button
            className="px-2 text-slate-400 disabled:opacity-20"
            disabled={!prev}
            onClick={() => prev && swapOrder(trip.id, place, prev)}
            aria-label="Monter"
          >
            ▲
          </button>
          <button
            className="px-2 text-slate-400 disabled:opacity-20"
            disabled={!next}
            onClick={() => next && swapOrder(trip.id, place, next)}
            aria-label="Descendre"
          >
            ▼
          </button>
        </div>
      </Card>

      <EditPlaceSheet open={edit} onClose={() => setEdit(false)} place={place} />
    </>
  );
}

function EditPlaceSheet({ open, onClose, place }: { open: boolean; onClose: () => void; place: Place }) {
  const { trip, dates, places } = useTripCtx();
  const [time, setTime] = useState(place.time ?? '');
  const [notes, setNotes] = useState(place.notes ?? '');
  const [category, setCategory] = useState<Category>(place.category);
  const [date, setDate] = useState(place.date ?? '');

  const save = async () => {
    const newDate = date || null;
    await updatePlace(trip.id, place.id, {
      time: time || undefined,
      notes: notes.trim() || undefined,
      category,
      date: newDate,
      ...(newDate !== place.date ? { order: nextOrder(places, newDate) } : {}),
    });
    onClose();
  };

  const remove = async () => {
    if (confirm(`Supprimer « ${place.name} » ?`)) {
      await deletePlace(trip.id, place.id);
      onClose();
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={place.name}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <a className="rounded-xl bg-slate-100 py-2.5 text-center text-sm font-medium" href={mapsLink(place)} target="_blank" rel="noreferrer">
            📍 Voir sur Maps
          </a>
          <a className="rounded-xl bg-slate-100 py-2.5 text-center text-sm font-medium" href={directionsLink(place)} target="_blank" rel="noreferrer">
            🚇 Itinéraire
          </a>
        </div>
        {place.address && <p className="text-sm text-slate-500">{place.address}</p>}

        <Field label="Jour">
          <select className={inputClass} value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="">💡 Idée à placer</option>
            {dates.map((d, i) => (
              <option key={d} value={d}>
                Jour {i + 1} – {formatDay(d)}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Heure">
            <input type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Catégorie">
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {CATEGORIES[k].emoji} {CATEGORIES[k].label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Notes">
          <textarea className={inputClass} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {place.addedBy && <p className="text-xs text-slate-400">Ajouté par {place.addedBy}</p>}
        <div className="flex gap-2">
          <Button variant="danger" onClick={remove}>
            Supprimer
          </Button>
          <Button className="flex-1" onClick={save}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
