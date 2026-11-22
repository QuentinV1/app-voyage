import { categoryFromGoogleTypes } from './categories';
import { addDays } from './dates';
import type { AiItinerary, AiPlace } from './ai';
import type { Category, Trip } from './types';

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Normalise une date en YYYY-MM-DD si possible */
function parseDateStr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = v.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : undefined;
}

/** Extrait un numéro de jour (1-indexé) depuis un titre comme "Day 2", "Jour 3", etc. */
function parseDayNumberFromTitle(title: string | undefined): number | undefined {
  if (!title) return undefined;
  const m = title.match(/\b(?:jour|day|j)\s*#?\s*(\d{1,3})\b/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 && n <= 365 ? n : undefined;
}

/** Normalise une heure (HH:mm, "2:30 PM", ou minutes depuis minuit) */
function parseTime(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1440) {
    const h = Math.floor(v / 60);
    const m = Math.round(v % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    const h = Number(m24[1]);
    const min = Number(m24[2]);
    if (h >= 0 && h <= 23 && min >= 0 && min <= 59) {
      return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    }
  }
  const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = Number(m12[1]);
    const min = Number(m12[2]);
    const pm = m12[3].toUpperCase() === 'PM';
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }
  return undefined;
}

const VALID_CATEGORIES = new Set<Category>([
  'food',
  'temple',
  'sight',
  'nature',
  'shopping',
  'hotel',
  'transport',
  'other',
]);

function mapCategory(raw: unknown, types?: string[]): Category {
  if (typeof raw === 'string') {
    const lower = raw.toLowerCase().trim();
    if (VALID_CATEGORIES.has(lower as Category)) return lower as Category;
    if (/(food|restaur|café|cafe|bar|bakery|eat|dinner|lunch|breakfast|brunch|drink|bistro)/.test(lower)) return 'food';
    if (/(hotel|lodging|hostel|airbnb|ryokan|resort|stay|accommodation|héberg)/.test(lower)) return 'hotel';
    if (/(temple|shrine|church|cathedral|mosque|sanctu|culte)/.test(lower)) return 'temple';
    if (/(park|garden|nature|beach|mountain|lake|trail|hik|forest)/.test(lower)) return 'nature';
    if (/(shop|store|mall|market|boutique|souvenir)/.test(lower)) return 'shopping';
    if (/(transport|airport|train|station|flight|bus|ferry|metro|subway|car)/.test(lower)) return 'transport';
    if (/(sight|museum|gallery|landmark|monument|castle|attraction|tour|activity|visit)/.test(lower)) return 'sight';
  }
  if (types?.length) return categoryFromGoogleTypes(types);
  return 'other';
}

function extractCoords(obj: JsonRecord): { lat?: number; lng?: number } {
  const lat = num(obj.lat) ?? num(obj.latitude);
  const lng = num(obj.lng) ?? num(obj.lon) ?? num(obj.longitude);
  if (lat != null && lng != null) return { lat, lng };

  if (isRecord(obj.coordinates)) {
    const cLat = num(obj.coordinates.lat) ?? num(obj.coordinates.latitude);
    const cLng = num(obj.coordinates.lng) ?? num(obj.coordinates.lon) ?? num(obj.coordinates.longitude);
    if (cLat != null && cLng != null) return { lat: cLat, lng: cLng };
  }

  if (isRecord(obj.geometry) && isRecord(obj.geometry.location)) {
    const gLat = num(obj.geometry.location.lat);
    const gLng = num(obj.geometry.location.lng);
    if (gLat != null && gLng != null) return { lat: gLat, lng: gLng };
  }

  if (isRecord(obj.location)) {
    const lLat = num(obj.location.lat) ?? num(obj.location.latitude);
    const lLng = num(obj.location.lng) ?? num(obj.location.lon) ?? num(obj.location.longitude);
    if (lLat != null && lLng != null) return { lat: lLat, lng: lLng };
  }

  return {};
}

function extractPlaceFromNode(node: JsonRecord, fallbackNotes?: string): AiPlace | null {
  const placeObj = isRecord(node.place)
    ? node.place
    : isRecord(node.placeData)
      ? node.placeData
      : isRecord(node.googlePlace)
        ? node.googlePlace
        : node;

  const name =
    str(placeObj.name) ??
    str(placeObj.displayName) ??
    str(placeObj.title) ??
    str(node.title) ??
    str(node.name);

  if (!name) return null;

  const typesRaw = Array.isArray(placeObj.types)
    ? placeObj.types.filter((t): t is string => typeof t === 'string')
    : Array.isArray(placeObj.categories)
      ? placeObj.categories
          .map((c) => (typeof c === 'string' ? c : isRecord(c) ? str(c.name) ?? str(c.id) : undefined))
          .filter((c): c is string => !!c)
      : [];

  const blockType = str(node.type);
  const category = mapCategory(
    str(node.category) ?? str(placeObj.category) ?? typesRaw[0] ?? blockType,
    typesRaw,
  );

  const coords = extractCoords(placeObj);
  const fallbackCoords = coords.lat == null ? extractCoords(node) : coords;

  const notes =
    str(node.notes) ??
    str(node.note) ??
    str(node.text) ??
    str(node.description) ??
    str(placeObj.notes) ??
    str(placeObj.description) ??
    fallbackNotes;

  const time =
    parseTime(node.time) ??
    parseTime(node.startTime) ??
    parseTime(node.startTimeMinutes) ??
    parseTime(placeObj.time);

  const address =
    str(placeObj.formattedAddress) ??
    str(placeObj.address) ??
    str(placeObj.vicinity) ??
    str(node.address);

  const city =
    str(placeObj.city) ??
    str(placeObj.locality) ??
    str(node.city);

  const googlePlaceId = str(placeObj.googlePlaceId) ?? str(placeObj.placeId) ?? str(node.placeId);
  const googleMapsUri = str(placeObj.googleMapsUri) ?? str(placeObj.url) ?? str(node.url);

  return {
    name,
    city,
    category,
    time,
    notes: notes && notes.length > 500 ? `${notes.slice(0, 497)}…` : notes,
    lat: fallbackCoords.lat,
    lng: fallbackCoords.lng,
    address,
    googlePlaceId,
    googleMapsUri,
  };
}

/** Cherche récursivement un objet contenant `sections` ou `days` (ex: __NEXT_DATA__ Wanderlog) */
function findTripContainer(root: unknown, depth = 0): JsonRecord | null {
  if (!isRecord(root) || depth > 6) return null;
  if (
    Array.isArray(root.sections) ||
    Array.isArray(root.days) ||
    Array.isArray(root.tripDays) ||
    Array.isArray(root.itinerary)
  ) {
    return root;
  }
  for (const key of ['tripPlan', 'trip', 'data', 'props', 'pageProps', 'result', 'payload']) {
    if (key in root) {
      const found = findTripContainer(root[key], depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function parseSectionArray(
  sections: unknown[],
  trip: Trip,
  daysMap: Map<string, { date: string; title?: string; city?: string; places: AiPlace[] }>,
  ideas: AiPlace[],
) {
  for (const sec of sections) {
    if (!isRecord(sec)) continue;
    const title = str(sec.heading) ?? str(sec.title) ?? str(sec.name);
    const city = str(sec.city) ?? str(sec.locationName);
    let date = parseDateStr(sec.date) ?? parseDateStr(sec.startDate);
    if (!date) {
      const dayNum = num(sec.day) ?? num(sec.dayNumber) ?? parseDayNumberFromTitle(title);
      if (dayNum != null && trip.startDate) {
        date = addDays(trip.startDate, dayNum - 1);
      }
    }

    const rawItems =
      (Array.isArray(sec.blocks) && sec.blocks) ||
      (Array.isArray(sec.places) && sec.places) ||
      (Array.isArray(sec.items) && sec.items) ||
      (Array.isArray(sec.activities) && sec.activities) ||
      (Array.isArray(sec.stops) && sec.stops) ||
      (Array.isArray(sec.entries) && sec.entries) ||
      [];

    const extracted: AiPlace[] = [];
    for (const item of rawItems) {
      if (!isRecord(item)) continue;
      // Ignore les blocs de texte pur sans lieu ni titre d'activité
      if (item.type === 'text' && !item.place && !item.placeData && !str(item.title) && !str(item.name)) {
        continue;
      }
      const p = extractPlaceFromNode(item);
      if (p) {
        if (!p.city && city) p.city = city;
        extracted.push(p);
      }
    }

    if (extracted.length === 0) continue;

    if (date) {
      const existing = daysMap.get(date);
      if (existing) {
        existing.places.push(...extracted);
        if (!existing.title && title) existing.title = title;
        if (!existing.city && city) existing.city = city;
      } else {
        daysMap.set(date, { date, title, city, places: extracted });
      }
    } else {
      ideas.push(...extracted);
    }
  }
}

/**
 * Tente de parser un JSON Wanderlog (ou GeoJSON / planning JSON générique) sans appeler l'IA.
 * Retourne null si ce n'est pas du JSON valide ou si aucun lieu n'est détecté.
 */
export function tryParseWanderlogJson(rawText: string, trip: Trip): AiItinerary | null {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return null;
  }

  const daysMap = new Map<string, { date: string; title?: string; city?: string; places: AiPlace[] }>();
  const ideas: AiPlace[] = [];

  // Cas 1 : GeoJSON (FeatureCollection)
  if (isRecord(data) && data.type === 'FeatureCollection' && Array.isArray(data.features)) {
    for (const f of data.features) {
      if (!isRecord(f)) continue;
      const props = isRecord(f.properties) ? f.properties : {};
      const coords =
        isRecord(f.geometry) && Array.isArray(f.geometry.coordinates) && f.geometry.coordinates.length >= 2
          ? { lng: num(f.geometry.coordinates[0]), lat: num(f.geometry.coordinates[1]) }
          : {};
      const p = extractPlaceFromNode({ ...props, ...coords });
      if (!p) continue;
      const date = parseDateStr(props.date);
      if (date) {
        const d = daysMap.get(date) ?? { date, places: [] };
        d.places.push(p);
        daysMap.set(date, d);
      } else {
        ideas.push(p);
      }
    }
  } else {
    // Cas 2 : Structure Wanderlog (sections / blocks / days / tripDays / itinerary)
    const container = findTripContainer(data);
    if (container) {
      const sectionList =
        (Array.isArray(container.sections) && container.sections) ||
        (Array.isArray(container.days) && container.days) ||
        (Array.isArray(container.tripDays) && container.tripDays) ||
        (Array.isArray(container.itinerary) && container.itinerary);
      if (sectionList) {
        parseSectionArray(sectionList, trip, daysMap, ideas);
      }
    }

    // Cas 2b : Idées / lieux enregistrés en parallèle (places, ideas, savedPlaces, wishlist)
    if (isRecord(data)) {
      for (const ideaKey of ['ideas', 'places', 'savedPlaces', 'wishlist', 'unscheduled']) {
        const arr = data[ideaKey];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (!isRecord(item)) continue;
            const p = extractPlaceFromNode(item);
            if (!p) continue;
            const date = parseDateStr(item.date);
            if (date) {
              const d = daysMap.get(date) ?? { date, places: [] };
              d.places.push(p);
              daysMap.set(date, d);
            } else {
              ideas.push(p);
            }
          }
        }
      }
    }

    // Cas 3 : Tableau plat de lieux
    if (Array.isArray(data)) {
      for (const item of data) {
        if (!isRecord(item)) continue;
        // Peut aussi être un tableau de jours
        if (Array.isArray(item.places) || Array.isArray(item.blocks) || Array.isArray(item.items)) {
          parseSectionArray([item], trip, daysMap, ideas);
          continue;
        }
        const p = extractPlaceFromNode(item);
        if (!p) continue;
        const date = parseDateStr(item.date);
        if (date) {
          const d = daysMap.get(date) ?? { date, places: [] };
          d.places.push(p);
          daysMap.set(date, d);
        } else {
          ideas.push(p);
        }
      }
    }
  }

  const days = [...daysMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const total = days.reduce((n, d) => n + d.places.length, 0) + ideas.length;
  if (total === 0) return null;

  return { days, ideas };
}

const NOISY_KEYS = new Set([
  'photos',
  'images',
  'photoUrls',
  'openingHours',
  'weekdayText',
  'periods',
  'reviews',
  'encodedPolyline',
  'polyline',
  'viewport',
  'bounds',
  'icon',
  'iconMaskBaseUri',
  'iconBackgroundColor',
  'htmlAttributions',
  'svg',
]);

/**
 * Compacte un gros JSON inconnu avant envoi à Gemini (supprime photos/horaires/polylines/nulls).
 */
export function compactJsonForAi(rawText: string, maxChars = 60_000): string {
  try {
    const parsed = JSON.parse(rawText);
    const cleaned = JSON.stringify(parsed, (key, value) => {
      if (NOISY_KEYS.has(key)) return undefined;
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) return undefined;
      if (typeof value === 'string' && value.length > 400) return `${value.slice(0, 397)}…`;
      return value;
    });
    return cleaned.length > maxChars ? cleaned.slice(0, maxChars) : cleaned;
  } catch {
    return rawText.length > maxChars ? rawText.slice(0, maxChars) : rawText;
  }
}
