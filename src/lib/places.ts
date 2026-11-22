import { categoryFromGoogleTypes } from './categories';
import type { NewPlace } from './types';

export const PLACE_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'rating',
  'googleMapsURI',
  'types',
  'addressComponents',
];

function cityOf(place: google.maps.places.Place): string | undefined {
  const comps = place.addressComponents ?? [];
  const find = (type: string) => comps.find((c) => c.types.includes(type))?.longText ?? undefined;
  return find('locality') ?? find('administrative_area_level_2') ?? find('administrative_area_level_1');
}

/** Convertit un résultat Google Places en lieu de l'application */
export function fromGooglePlace(
  place: google.maps.places.Place,
  extra: Pick<NewPlace, 'date'> & Partial<NewPlace>,
): NewPlace {
  return {
    name: place.displayName ?? 'Lieu sans nom',
    category: categoryFromGoogleTypes(place.types),
    address: place.formattedAddress ?? undefined,
    city: cityOf(place),
    lat: place.location?.lat(),
    lng: place.location?.lng(),
    googlePlaceId: place.id,
    googleMapsUri: place.googleMapsURI ?? undefined,
    rating: place.rating ?? undefined,
    ...extra,
  };
}

/** Recherche texte (utilisée par l'import et l'IA) */
export async function searchPlace(
  lib: google.maps.PlacesLibrary,
  textQuery: string,
  locationBias?: { lat: number; lng: number },
): Promise<google.maps.places.Place | null> {
  try {
    const { places } = await lib.Place.searchByText({
      textQuery,
      fields: PLACE_FIELDS,
      maxResultCount: 1,
      language: 'fr',
      ...(locationBias ? { locationBias } : {}),
    });
    return places[0] ?? null;
  } catch (e) {
    console.warn('searchPlace', textQuery, e);
    return null;
  }
}

export function mapsLink(p: { lat?: number; lng?: number; name: string; googleMapsUri?: string; googlePlaceId?: string }) {
  if (p.googleMapsUri) return p.googleMapsUri;
  const q = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : p.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}${
    p.googlePlaceId ? `&query_place_id=${p.googlePlaceId}` : ''
  }`;
}

export function directionsLink(p: { lat?: number; lng?: number; name: string }) {
  const dest = p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : p.name;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=transit`;
}
