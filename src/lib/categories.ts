import type { Category } from './types';

export const CATEGORIES: Record<Category, { label: string; emoji: string }> = {
  food: { label: 'Restaurant / café', emoji: '🍽️' },
  temple: { label: 'Patrimoine / culte', emoji: '🏛️' },
  sight: { label: 'Visite / musée', emoji: '📸' },
  nature: { label: 'Nature / parc', emoji: '🌿' },
  shopping: { label: 'Shopping', emoji: '🛍️' },
  hotel: { label: 'Hébergement', emoji: '🏨' },
  transport: { label: 'Transport', emoji: '🚆' },
  other: { label: 'Autre', emoji: '📍' },
};

export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[];

/** Déduit une catégorie à partir des « types » Google Places */
export function categoryFromGoogleTypes(types: string[] | null | undefined): Category {
  const t = new Set(types ?? []);
  const has = (...keys: string[]) => keys.some((k) => t.has(k));
  if (has('lodging', 'hotel', 'ryokan', 'hostel', 'guest_house')) return 'hotel';
  if (has('buddhist_temple', 'shinto_shrine', 'hindu_temple', 'place_of_worship', 'church', 'shrine'))
    return 'temple';
  if (has('restaurant', 'cafe', 'bar', 'bakery', 'food', 'meal_takeaway', 'ramen_restaurant', 'sushi_restaurant'))
    return 'food';
  if (has('train_station', 'transit_station', 'subway_station', 'airport', 'bus_station')) return 'transport';
  if (has('shopping_mall', 'store', 'department_store', 'market', 'clothing_store')) return 'shopping';
  if (has('park', 'natural_feature', 'garden', 'national_park', 'hiking_area', 'beach')) return 'nature';
  if (has('tourist_attraction', 'museum', 'art_gallery', 'historical_landmark', 'amusement_park', 'aquarium', 'zoo'))
    return 'sight';
  return 'other';
}

/** Couleurs des pins par jour */
export const DAY_COLORS = [
  '#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2',
  '#db2777', '#65a30d', '#ea580c', '#4f46e5', '#0d9488', '#b91c1c',
];

export const IDEA_COLOR = '#64748b';

export function dayColor(index: number): string {
  return index < 0 ? IDEA_COLOR : DAY_COLORS[index % DAY_COLORS.length];
}
