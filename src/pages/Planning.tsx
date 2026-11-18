import { Link } from 'react-router-dom';
import { useTripCtx } from '../lib/tripContext';
import { daysUntil, formatDay } from '../lib/dates';
import { CATEGORIES, dayColor } from '../lib/categories';
import { Card } from '../components/ui';

export default function Planning() {
  const { trip, dates, days, places } = useTripCtx();
  const countdown = daysUntil(trip.startDate);
  const ideas = places.filter((p) => !p.date || !dates.includes(p.date)).length;

  return (
    <div className="space-y-3 p-4">
      {countdown > 0 && (
        <div className="rounded-2xl bg-gradient-to-r from-rose-600 to-pink-500 p-4 text-white">
          <p className="text-sm opacity-90">Départ dans</p>
          <p className="text-3xl font-bold">{countdown} jours ✈️</p>
        </div>
      )}

      {places.length === 0 && (
        <Link to="import">
          <Card className="border-2 border-dashed border-rose-200 p-4 text-center">
            <p className="font-medium">📥 Importer mon planning Wanderlog</p>
            <p className="text-sm text-slate-500">PDF, texte copié, capture d'écran… l'IA s'occupe du reste</p>
          </Card>
        </Link>
      )}

      {dates.map((date, i) => {
        const info = days[date];
        const dayPlaces = places.filter((p) => p.date === date);
        return (
          <Link key={date} to={`day/${date}`} className="block">
            <Card className="flex gap-3 p-4">
              <div
                className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-white"
                style={{ background: dayColor(i) }}
              >
                <span className="text-[10px] uppercase leading-none opacity-90">Jour</span>
                <span className="text-lg font-bold leading-none">{i + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm capitalize text-slate-500">{formatDay(date)}</p>
                <p className="truncate font-semibold">
                  {info?.title || info?.city || <span className="font-normal text-slate-400">Journée libre</span>}
                  {info?.title && info?.city && <span className="font-normal text-slate-500"> · {info.city}</span>}
                </p>
                {dayPlaces.length > 0 && (
                  <p className="mt-1 truncate text-sm text-slate-500">
                    {dayPlaces.map((p) => `${CATEGORIES[p.category]?.emoji ?? '📍'} ${p.name}`).join('  ·  ')}
                  </p>
                )}
              </div>
              <span className="self-center text-sm text-slate-400">{dayPlaces.length || ''}</span>
            </Card>
          </Link>
        );
      })}

      {ideas > 0 && (
        <Link to="ideas" className="block text-center text-sm text-brand">
          💡 {ideas} idée{ideas > 1 ? 's' : ''} à placer
        </Link>
      )}
    </div>
  );
}
