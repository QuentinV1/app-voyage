import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  MapPin,
  Navigation,
  Pencil,
  Star,
  Trash2,
} from 'lucide-react';
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
  const cat = CATEGORIES[place.category] ?? CATEGORIES.other;
  const CatIcon = cat.icon;

  return (
    <>
      <Card className="group flex items-stretch gap-3 p-3.5 transition hover:border-slate-300 hover:shadow-sm">
        {/* Repère numéroté + horaire */}
        <div className="flex w-11 shrink-0 flex-col items-center">
          <span
            className="tabular-nums flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-xs"
            style={{ backgroundColor: color }}
          >
            {index + 1}
          </span>
          {place.time && (
            <span className="tabular-nums mt-1.5 inline-flex items-center gap-0.5 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
              {place.time}
            </span>
          )}
        </div>

        {/* Contenu principal cliquable */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <button
            type="button"
            className="block w-full cursor-pointer text-left"
            onClick={() => setEdit(true)}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${cat.badgeClass}`}
              >
                <CatIcon className="h-3 w-3" />
                {cat.shortLabel}
              </span>
              {place.rating && (
                <span className="tabular-nums inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                  {place.rating.toFixed(1)}
                </span>
              )}
            </div>

            <p className="mt-1 break-words text-sm font-bold leading-snug text-slate-900 group-hover:text-brand">
              {place.name}
            </p>

            {(place.city || place.address) && (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                <MapPin className="h-3 w-3 shrink-0 text-slate-400" />
                <span className="truncate">{place.address || place.city}</span>
              </p>
            )}

            {place.notes && (
              <p className="mt-1.5 line-clamp-2 break-words rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs leading-relaxed text-slate-600">
                {place.notes}
              </p>
            )}
          </button>

          {/* Actions rapides Maps / Itinéraire / Modifier */}
          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] font-semibold">
            <a
              className="inline-flex items-center gap-1 text-slate-500 hover:text-brand"
              href={mapsLink(place)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink className="h-3 w-3" />
              Maps
            </a>
            <a
              className="inline-flex items-center gap-1 text-slate-500 hover:text-brand"
              href={directionsLink(place)}
              target="_blank"
              rel="noreferrer"
            >
              <Navigation className="h-3 w-3" />
              Itinéraire
            </a>
            <button
              type="button"
              onClick={() => setEdit(true)}
              className="inline-flex cursor-pointer items-center gap-1 text-slate-500 hover:text-brand"
            >
              <Pencil className="h-3 w-3" />
              Modifier
            </button>
          </div>
        </div>

        {/* Réordonnancement */}
        <div className="flex shrink-0 flex-col justify-center gap-1 border-l border-slate-100 pl-2">
          <button
            type="button"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-25"
            disabled={!prev}
            onClick={() => prev && swapOrder(trip.id, place, prev)}
            aria-label="Monter"
            title="Monter"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-25"
            disabled={!next}
            onClick={() => next && swapOrder(trip.id, place, next)}
            aria-label="Descendre"
            title="Descendre"
          >
            <ChevronDown className="h-4 w-4" />
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
          <a
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100"
            href={mapsLink(place)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-3.5 w-3.5 text-brand" />
            Voir sur Maps
          </a>
          <a
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-800 transition hover:bg-slate-100"
            href={directionsLink(place)}
            target="_blank"
            rel="noreferrer"
          >
            <Navigation className="h-3.5 w-3.5 text-brand" />
            Itinéraire
          </a>
        </div>

        {place.address && (
          <p className="flex items-start gap-1.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{place.address}</span>
          </p>
        )}

        <Field label="Jour attribué">
          <select className={inputClass} value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="">Boîte à idées (non attribué)</option>
            {dates.map((d, i) => (
              <option key={d} value={d}>
                Jour {i + 1} – {formatDay(d)}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Horaire">
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="time" className={`${inputClass} pl-9`} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </Field>
          <Field label="Catégorie">
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORY_KEYS.map((k) => (
                <option key={k} value={k}>
                  {CATEGORIES[k].label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            className={inputClass}
            rows={3}
            maxLength={1000}
            placeholder="Réservation, astuce, budget estimé…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        {place.addedBy && <p className="text-xs text-slate-400">Ajouté par {place.addedBy}</p>}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row">
          <Button variant="danger" onClick={remove}>
            <Trash2 className="h-4 w-4" />
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
