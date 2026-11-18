import { useEffect, useMemo, useState } from 'react';
import { AdvancedMarker, InfoWindow, Map, Pin, useMap } from '@vis.gl/react-google-maps';
import { useTripCtx } from '../lib/tripContext';
import { CATEGORIES, IDEA_COLOR, dayColor } from '../lib/categories';
import { formatShort } from '../lib/dates';
import { directionsLink, mapsLink } from '../lib/places';
import type { Place } from '../lib/types';

type Filter = 'all' | 'ideas' | string; // string = date

export default function MapView() {
  const { places, dates, dayIndex } = useTripCtx();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Place | null>(null);

  const located = places.filter((p) => p.lat != null && p.lng != null);
  const visible = useMemo(
    () =>
      located.filter((p) => {
        if (filter === 'all') return true;
        if (filter === 'ideas') return dayIndex(p.date) < 0;
        return p.date === filter;
      }),
    [located, filter, dayIndex],
  );

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
    return <p className="p-4 text-amber-700">Clé Google Maps manquante (VITE_GOOGLE_MAPS_API_KEY).</p>;

  const chip = (value: Filter, label: string, color?: string) => (
    <button
      key={value}
      onClick={() => {
        setFilter(value);
        setSelected(null);
      }}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium shadow-sm ${
        filter === value ? 'text-white' : 'bg-white text-slate-700'
      }`}
      style={filter === value ? { background: color ?? '#be123c' } : undefined}
    >
      {label}
    </button>
  );

  return (
    <div className="relative h-full min-h-[60vh]">
      <div className="absolute inset-x-0 top-0 z-10 flex gap-2 overflow-x-auto p-3">
        {chip('all', 'Tous')}
        {dates.map((d, i) => chip(d, `J${i + 1} · ${formatShort(d)}`, dayColor(i)))}
        {chip('ideas', '💡 Idées', IDEA_COLOR)}
      </div>

      <Map
        mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
        defaultCenter={{ lat: 35.68, lng: 139.76 }}
        defaultZoom={6}
        gestureHandling="greedy"
        disableDefaultUI
        clickableIcons={false}
        style={{ width: '100%', height: '100%' }}
        onClick={() => setSelected(null)}
      >
        {visible.map((p) => {
          const i = dayIndex(p.date);
          const order = i >= 0 ? places.filter((x) => x.date === p.date).indexOf(p) + 1 : null;
          return (
            <AdvancedMarker key={p.id} position={{ lat: p.lat!, lng: p.lng! }} onClick={() => setSelected(p)} title={p.name}>
              <Pin
                background={dayColor(i)}
                borderColor="#ffffff"
                glyphColor="#ffffff"
                glyph={filter !== 'all' && order ? String(order) : CATEGORIES[p.category]?.emoji ?? '•'}
              />
            </AdvancedMarker>
          );
        })}

        {selected && (
          <InfoWindow
            position={{ lat: selected.lat!, lng: selected.lng! }}
            pixelOffset={[0, -40]}
            onCloseClick={() => setSelected(null)}
            headerContent={<strong>{selected.name}</strong>}
          >
            <div className="max-w-60 space-y-1 text-sm">
              <p className="text-slate-500">
                {dayIndex(selected.date) >= 0 ? `Jour ${dayIndex(selected.date) + 1}` : 'Idée'}
                {selected.time && ` · ${selected.time}`}
              </p>
              {selected.notes && <p>{selected.notes}</p>}
              <div className="flex gap-3 pt-1">
                <a className="text-brand underline" href={mapsLink(selected)} target="_blank" rel="noreferrer">
                  Google Maps
                </a>
                <a className="text-brand underline" href={directionsLink(selected)} target="_blank" rel="noreferrer">
                  Itinéraire
                </a>
              </div>
            </div>
          </InfoWindow>
        )}

        <FitBounds places={visible} />
        {filter !== 'all' && filter !== 'ideas' && <DayRoute places={visible} color={dayColor(dayIndex(filter))} />}
      </Map>

      {located.length < places.length && (
        <p className="absolute inset-x-0 bottom-2 mx-auto w-fit rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500 shadow">
          {places.length - located.length} lieu(x) sans coordonnées
        </p>
      )}
    </div>
  );
}

/** Recadre la carte sur les pins visibles */
function FitBounds({ places }: { places: Place[] }) {
  const map = useMap();
  const key = places.map((p) => p.id).join();
  useEffect(() => {
    if (!map || places.length === 0) return;
    if (places.length === 1) {
      map.setCenter({ lat: places[0].lat!, lng: places[0].lng! });
      map.setZoom(15);
      return;
    }
    const b = new google.maps.LatLngBounds();
    places.forEach((p) => b.extend({ lat: p.lat!, lng: p.lng! }));
    map.fitBounds(b, { top: 70, bottom: 40, left: 30, right: 30 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/** Trace le parcours de la journée dans l'ordre prévu */
function DayRoute({ places, color }: { places: Place[]; color: string }) {
  const map = useMap();
  useEffect(() => {
    if (!map || places.length < 2) return;
    const line = new google.maps.Polyline({
      map,
      path: places.map((p) => ({ lat: p.lat!, lng: p.lng! })),
      strokeColor: color,
      strokeOpacity: 0.8,
      strokeWeight: 3,
      icons: [{ icon: { path: google.maps.SymbolPath.FORWARD_OPEN_ARROW, scale: 2.5 }, offset: '50%', repeat: '120px' }],
    });
    return () => line.setMap(null);
  }, [map, places, color]);
  return null;
}
