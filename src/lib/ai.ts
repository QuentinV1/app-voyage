import { getAI, getGenerativeModel, GoogleAIBackend, Schema, type Part } from 'firebase/ai';
import { app } from './firebase';
import { CATEGORY_KEYS } from './categories';
import { compactJsonForAi, tryParseWanderlogJson } from './wanderlog';
import type { Category, Trip } from './types';

const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.8-flash';

/* ------------------------------------------------------------------ */
/* Schéma de sortie structurée                                         */
/* ------------------------------------------------------------------ */

const placeSchema = Schema.object({
  properties: {
    name: Schema.string({ description: 'Nom du lieu, tel que trouvable sur Google Maps' }),
    city: Schema.string({ description: 'Ville ou quartier' }),
    category: Schema.enumString({ enum: CATEGORY_KEYS }),
    time: Schema.string({ description: 'Heure au format HH:mm si connue' }),
    notes: Schema.string({ description: 'Notes utiles, courtes, en français' }),
  },
  optionalProperties: ['city', 'time', 'notes'],
});

const itinerarySchema = Schema.object({
  properties: {
    days: Schema.array({
      items: Schema.object({
        properties: {
          date: Schema.string({ description: 'Date au format YYYY-MM-DD' }),
          title: Schema.string({ description: 'Titre court de la journée' }),
          city: Schema.string(),
          places: Schema.array({ items: placeSchema }),
        },
        optionalProperties: ['title', 'city'],
      }),
    }),
    ideas: Schema.array({
      description: 'Lieux mentionnés sans jour précis',
      items: placeSchema,
    }),
  },
  optionalProperties: ['ideas'],
});

export interface AiPlace {
  name: string;
  city?: string;
  category: Category;
  time?: string;
  notes?: string;
  lat?: number;
  lng?: number;
  address?: string;
  googlePlaceId?: string;
  googleMapsUri?: string;
}

export interface AiItinerary {
  days: { date: string; title?: string; city?: string; places: AiPlace[] }[];
  ideas?: AiPlace[];
  source?: 'json' | 'ai';
}

function model() {
  const ai = getAI(app, { backend: new GoogleAIBackend() });
  return getGenerativeModel(ai, {
    model: MODEL,
    generationConfig: { responseMimeType: 'application/json', responseSchema: itinerarySchema, temperature: 0.4 },
  });
}

async function run(parts: (string | Part)[]): Promise<AiItinerary> {
  const res = await model().generateContent(parts);
  const parsed = JSON.parse(res.response.text()) as AiItinerary;
  parsed.days ??= [];
  parsed.ideas ??= [];
  return parsed;
}

function tripContext(trip: Trip) {
  return `Voyage « ${trip.name} », du ${trip.startDate} au ${trip.endDate}.`;
}

/* ------------------------------------------------------------------ */
/* Import (Wanderlog, PDF, texte libre…)                               */
/* ------------------------------------------------------------------ */

export async function fileToPart(file: File): Promise<Part> {
  const buf = await file.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return { inlineData: { mimeType: file.type || 'application/octet-stream', data: btoa(binary) } };
}

const TEXT_EXT = /\.(txt|csv|json|kml|gpx|xml|md|html?)$/i;
const JSON_EXT = /\.json$/i;

export async function importItinerary(trip: Trip, text: string, file: File | null): Promise<AiItinerary> {
  const fileText = file && TEXT_EXT.test(file.name) ? await file.text() : null;

  // 1. Tentative de parsing direct (instantané, sans quota IA) pour les JSON Wanderlog / GeoJSON / génériques
  if (file && fileText !== null && (JSON_EXT.test(file.name) || fileText.trim().startsWith('{') || fileText.trim().startsWith('['))) {
    const parsed = tryParseWanderlogJson(fileText, trip);
    if (parsed) return { ...parsed, source: 'json' };
  }
  if (!file && (text.trim().startsWith('{') || text.trim().startsWith('['))) {
    const parsed = tryParseWanderlogJson(text, trip);
    if (parsed) return { ...parsed, source: 'json' };
  }

  // 2. Fallback Gemini (en compactant les gros JSON pour éviter les dépassements de tokens)
  const parts: (string | Part)[] = [
    `Tu es un assistant qui convertit un planning de voyage existant (export Wanderlog, PDF, KML, texte libre, capture d'écran…) en données structurées.
${tripContext(trip)}
Règles :
- Conserve l'ordre des lieux de chaque journée.
- Si le document utilise des numéros de jour (« Jour 1 », « Day 2 »…), convertis-les en dates à partir du ${trip.startDate}.
- Si une date est hors des dates du voyage, garde-la quand même.
- Les lieux sans jour précis (listes « à voir », « idées », « places to visit ») vont dans "ideas".
- N'invente aucun lieu : extrais uniquement ce qui est présent.
- Le nom du lieu doit permettre de le retrouver sur Google Maps (ajoute la ville si ambigu dans "city").
- Ignore les trajets/transports génériques sauf gares, aéroports et hôtels.`,
  ];
  if (file) {
    if (fileText !== null) {
      const content = JSON_EXT.test(file.name) ? compactJsonForAi(fileText) : fileText;
      parts.push(`Contenu du fichier ${file.name} :\n${content}`);
    } else {
      parts.push(await fileToPart(file));
    }
  }
  if (text.trim()) {
    const trimmed = text.trim();
    const content = trimmed.startsWith('{') || trimmed.startsWith('[') ? compactJsonForAi(trimmed) : text;
    parts.push(`Texte collé :\n${content}`);
  }
  const res = await run(parts);
  return { ...res, source: 'ai' };
}

/* ------------------------------------------------------------------ */
/* Suggestions pour une journée                                        */
/* ------------------------------------------------------------------ */

export async function suggestForDay(
  trip: Trip,
  date: string,
  city: string,
  wishes: string,
  existing: string[],
): Promise<AiPlace[]> {
  const prompt = `Tu es un expert en voyage qui aide un groupe d'amis ou de famille francophone à planifier leur séjour.
${tripContext(trip)}
Propose une journée pour le ${date} à ${city || 'une ville à choisir selon le contexte'}.
Envies du groupe : ${wishes || 'mix de culture, food locale et balade'}.
Lieux déjà prévus ce jour-là : ${existing.length ? existing.join(', ') : 'aucun'} (ne les répète pas, complète-les).
Contraintes :
- 4 à 7 lieux réels et existants, ordonnés pour limiter les trajets, avec une heure indicative.
- Inclure au moins un repas typique (nom de restaurant ou de marché précis).
- Notes en français : 1 phrase utile (astuce, prix, réservation…).
Renvoie un seul élément dans "days" avec la date ${date}.`;
  const res = await run([prompt]);
  return res.days.flatMap((d) => d.places);
}
