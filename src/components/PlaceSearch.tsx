import { useEffect, useMemo, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
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
    }, 300); // debounce => moins d'appels facturés
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
      token.current = null; // fin de session de facturation
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
    <div className="space-y-2">
      <input
        className={inputClass}
        placeholder="🔎 Restaurant, monument, quartier…"
        value={input}
        autoFocus={autoFocus}
        onChange={(e) => setInput(e.target.value)}
      />
      {loading && <p className="text-sm text-slate-500">Chargement du lieu…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="divide-y divide-slate-100">
        {suggestions.map((s) => (
          <li key={s.placeId}>
            <button className="w-full py-3 text-left active:bg-slate-50" onClick={() => pick(s)}>
              <p className="font-medium">{s.mainText?.toString() ?? s.text.toString()}</p>
              <p className="text-sm text-slate-500">{s.secondaryText?.toString()}</p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
