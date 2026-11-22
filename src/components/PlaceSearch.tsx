import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { MapPin, Search } from 'lucide-react';
import { PLACE_FIELDS } from '../lib/places';
import { inputClass } from './ui';

interface Props {
  onPick: (place: google.maps.places.Place) => void;
  autoFocus?: boolean;
  locationBias?: { lat: number; lng: number };
}

/** Champ de recherche Google Places (API « New ») avec suggestions */
export default function PlaceSearch({ onPick, autoFocus, locationBias }: Props) {
  const lib = useMapsLibrary('places');
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  const sessionToken = useMemo(() => {
    if (!lib) return null;
    token.current ??= new lib.AutocompleteSessionToken();
    return token.current;
  }, [lib]);

  useEffect(() => {
    if (!lib || input.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { suggestions } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: sessionToken ?? undefined,
          language: 'fr',
          ...(locationBias ? { locationBias } : {}),
        });
        if (!cancelled) {
          setSuggestions(suggestions.map((s) => s.placePrediction).filter((p): p is google.maps.places.PlacePrediction => !!p));
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [input, lib, sessionToken]);

  const pick = async (pred: google.maps.places.PlacePrediction) => {
    setLoading(true);
    try {
      const place = pred.toPlace();
      await place.fetchFields({ fields: PLACE_FIELDS });
      token.current = null;
      setInput('');
      setSuggestions([]);
      onPick(place);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
    return <p className="text-sm text-amber-700">Clé Google Maps manquante (VITE_GOOGLE_MAPS_API_KEY).</p>;

  return (
    <div className="space-y-2.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className={`${inputClass} pl-10`}
          placeholder="Restaurant, monument, quartier…"
          value={input}
          autoFocus={autoFocus}
          onChange={(e) => setInput(e.target.value)}
        />
      </div>
      {loading && <p className="text-xs font-medium text-slate-500">Chargement du lieu…</p>}
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      <ul className="divide-y divide-slate-100">
        {suggestions.map((s) => (
          <li key={s.placeId}>
            <button
              type="button"
              className="flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2 py-3 text-left transition hover:bg-slate-50"
              onClick={() => pick(s)}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{s.mainText?.toString() ?? s.text.toString()}</p>
                <p className="text-xs text-slate-500">{s.secondaryText?.toString()}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
