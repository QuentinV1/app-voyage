import { useEffect, useMemo, useState } from 'react';
import { AdvancedMarker, InfoWindow, Map, Pin, useMap } from '@vis.gl/react-google-maps';
import { Clock, ExternalLink, MapPin, Navigation, WifiOff } from 'lucide-react';
import { useTripCtx } from '../lib/tripContext';
import { CATEGORIES, IDEA_COLOR, dayColor } from '../lib/categories';
import { formatShort } from '../lib/dates';
import { directionsLink, mapsLink } from '../lib/places';
import type { Place } from '../lib/types';
import { Card, Empty } from '../components/ui';

type Filter = 'all' | 'ideas' | string; // string = date

export default function MapView() {
  const { places, dates, dayIndex, isOnline } = useTripCtx();
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Place | null>(null);

  const located = useMemo(() => places.filter((p) => p.lat != null && p.lng != null), [places]);
  const visible = useMemo(
    () =>
      located.filter((p) => {
        if (filter === 'all') return true;
        if (filter === 'ideas') return dayIndex(p.date) < 0;
        return p.date === filter;
      }),
    [located, filter, dayIndex],
  );

  const chip = (value: Filter, label: string, color?: string) => (
    <button
      key={value}
      type="button"
      onClick={() => {
        setFilter(value);
        setSelected(null);
      }}
      className={`shrink-0 cursor-pointer rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs transition ${
        filter === value
          ? 'border-transparent text-white'
          : 'border-slate-200/90 bg-white/95 text-slate-700 backdrop-blur-xs hover:bg-slate-50'
      }`}
      style={filter === value ? { backgroundColor: color ?? '#be123c' } : undefined}
    >
      {label}
    </button>
  );

  const filterBar = (
    <div className="scrollbar-none flex gap-1.5 overflow-x-auto p-3">
      {chip('all', `Tous (${located.length})`)}
      {dates.map((d, i) => {
        const count = located.filter((p) => p.date === d).length;
        return chip(d, `J${i + 1} · ${formatShort(d)}${count ? ` (${count})` : ''}`, dayColor(i));
      })}
      {chip('ideas', 'Idées', IDEA_COLOR)}
    </div>
  );

  // Repli hors-ligne ou sans clé Google Maps
  if (!isOnline || !import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <div className="-mx-3">{filterBar}</div>

        <Card className="flex items-start gap-3 border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="font-bold">
              {!isOnline ? 'Carte interactive indisponible hors-ligne' : 'Clé Google Maps manquante'}
            </p>
            <p className="mt-0.5 text-amber-800">
              Voici tes lieux géolocalisés avec leurs coordonnées GPS pour ouvrir un itinéraire dans ton app Maps hors-ligne.
            </p>
          </div>
        </Card>

        {visible.length === 0 ? (
          <Empty icon={<MapPin className="h-6 w-6" />} title="Aucun lieu géolocalisé pour ce filtre" />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => {
              const idx = dayIndex(p.date);
              const cat = CATEGORIES[p.category] ?? CATEGORIES.other;
              const CatIcon = cat.icon;
              return (
                <Card key={p.id} className="flex flex-col justify-between gap-2.5 p-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                          style={{ backgroundColor: dayColor(idx) }}
                        >
                          {idx >= 0 ? `J${idx + 1}` : '·'}
                        </span>
                        <p className="truncate text-sm font-bold text-slate-900">{p.name}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${cat.badgeClass}`}>
                        <CatIcon className="h-3 w-3" />
                      </span>
                    </div>

                    {p.address && (
                      <p className="flex items-start gap-1 text-xs text-slate-500">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="min-w-0 break-words">{p.address}</span>
                      </p>
                    )}

                    <p className="font-mono text-[11px] text-slate-400">
                      {p.lat!.toFixed(5)}, {p.lng!.toFixed(5)}
                    </p>
                  </div>

                  <div className="flex gap-4 border-t border-slate-100 pt-2.5 text-xs font-semibold">
                    <a
                      className="inline-flex items-center gap-1 text-brand hover:underline"
                      href={mapsLink(p)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Maps
                    </a>
                    <a
                      className="inline-flex items-center gap-1 text-brand hover:underline"
                      href={directionsLink(p)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      Itinéraire
                    </a>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Vue interactive : Split-view desktop (liste à gauche + carte à droite) & plein écran mobile
  return (
    <div className="flex h-full min-h-[60dvh] flex-col md:flex-row">
      {/* Panneau latéral desktop */}
      <aside className="hidden w-80 shrink-0 flex-col border-r border-slate-200 bg-white md:flex lg:w-96">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-900">
            Lieux affichés ({visible.length})
          </h2>
          {located.length < places.length && (
            <p className="mt-0.5 text-[11px] text-slate-500">
              {places.length - located.length} lieu(x) sans coordonnées GPS
            </p>
          )}
        </div>

        <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
          {visible.length === 0 ? (
            <p className="p-6 text-center text-xs text-slate-500">Aucun lieu géolocalisé pour ce filtre.</p>
          ) : (
            visible.map((p) => {
              const idx = dayIndex(p.date);
              const cat = CATEGORIES[p.category] ?? CATEGORIES.other;
              const CatIcon = cat.icon;
              const isSelected = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition ${
                    isSelected ? 'bg-rose-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: dayColor(idx) }}
                  >
                    {idx >= 0 ? `J${idx + 1}` : '·'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-semibold ${isSelected ? 'text-brand' : 'text-slate-900'}`}>
                      {p.name}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CatIcon className="h-3 w-3" />
                        {cat.shortLabel}
                      </span>
                      {p.time && (
                        <span className="tabular-nums inline-flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {p.time}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Carte principale */}
      <div className="relative flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10">
          <div className="pointer-events-auto">{filterBar}</div>
        </div>

        <Map
          mapId={import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID'}
          defaultCenter={{ lat: 20, lng: 0 }}
          defaultZoom={2}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          style={{ width: '100%', height: '100%' }}
          onClick={() => setSelected(null)}
        >
          {visible.map((p) => {
            const i = dayIndex(p.date);
            const order = i >= 0 ? places.filter((x) => x.date === p.date).indexOf(p) + 1 : null;
            const cat = CATEGORIES[p.category] ?? CATEGORIES.other;
            return (
              <AdvancedMarker key={p.id} position={{ lat: p.lat!, lng: p.lng! }} onClick={() => setSelected(p)} title={p.name}>
                <Pin
                  background={dayColor(i)}
                  borderColor="#ffffff"
                  glyphColor="#ffffff"
                  glyph={filter !== 'all' && order ? String(order) : cat.glyph}
                />
              </AdvancedMarker>
            );
          })}

          {selected && (
            <InfoWindow
              position={{ lat: selected.lat!, lng: selected.lng! }}
              pixelOffset={[0, -40]}
              onCloseClick={() => setSelected(null)}
              headerContent={<strong className="text-slate-900">{selected.name}</strong>}
            >
              <div className="max-w-64 space-y-1.5 text-xs">
                <p className="font-medium text-slate-500">
                  {dayIndex(selected.date) >= 0 ? `Jour ${dayIndex(selected.date) + 1}` : 'Boîte à idées'}
                  {selected.time && ` · ${selected.time}`}
                </p>
                {selected.notes && <p className="text-slate-700">{selected.notes}</p>}
                <div className="flex gap-3 pt-1 font-semibold">
                  <a className="text-brand hover:underline" href={mapsLink(selected)} target="_blank" rel="noreferrer">
                    Google Maps
                  </a>
                  <a className="text-brand hover:underline" href={directionsLink(selected)} target="_blank" rel="noreferrer">
                    Itinéraire
                  </a>
                </div>
              </div>
            </InfoWindow>
          )}

          <FitBounds places={visible} />
          <PanToSelected place={selected} />
          {filter !== 'all' && filter !== 'ideas' && <DayRoute places={visible} color={dayColor(dayIndex(filter))} />}
        </Map>

        {located.length < places.length && (
          <p className="pointer-events-none absolute inset-x-3 bottom-3 mx-auto w-fit max-w-[calc(100%-1.5rem)] truncate rounded-full bg-white/95 px-3.5 py-1.5 text-center text-xs font-medium text-slate-600 shadow-md ring-1 ring-slate-200/80 md:hidden">
            {places.length - located.length} lieu(x) sans coordonnées
          </p>
        )}
      </div>
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

/** Centre en douceur sur le lieu cliqué dans la liste latérale */
function PanToSelected({ place }: { place: Place | null }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !place || place.lat == null || place.lng == null) return;
    map.panTo({ lat: place.lat, lng: place.lng });
  }, [map, place]);
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
