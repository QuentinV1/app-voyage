import {
  BedDouble,
  Camera,
  Landmark,
  MapPin,
  ShoppingBag,
  TrainFront,
  Trees,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import type { Category } from './types';

export interface CategoryMeta {
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  glyph: string;
  color: string;
  badgeClass: string;
  iconBgClass: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  food: {
    label: 'Restaurant / café',
    shortLabel: 'Resto',
    icon: Utensils,
    glyph: 'R',
    color: '#ea580c',
    badgeClass: 'border-orange-200 bg-orange-50 text-orange-700',
    iconBgClass: 'bg-orange-100 text-orange-700',
  },
  temple: {
    label: 'Patrimoine / culte',
    shortLabel: 'Patrimoine',
    icon: Landmark,
    glyph: 'P',
    color: '#9333ea',
    badgeClass: 'border-purple-200 bg-purple-50 text-purple-700',
    iconBgClass: 'bg-purple-100 text-purple-700',
  },
  sight: {
    label: 'Visite / musée',
    shortLabel: 'Visite',
    icon: Camera,
    glyph: 'V',
    color: '#e11d48',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    iconBgClass: 'bg-rose-100 text-rose-700',
  },
  nature: {
    label: 'Nature / parc',
    shortLabel: 'Nature',
    icon: Trees,
    glyph: 'N',
    color: '#16a34a',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    iconBgClass: 'bg-emerald-100 text-emerald-700',
  },
  shopping: {
    label: 'Shopping',
    shortLabel: 'Shopping',
    icon: ShoppingBag,
    glyph: 'S',
    color: '#db2777',
    badgeClass: 'border-pink-200 bg-pink-50 text-pink-700',
    iconBgClass: 'bg-pink-100 text-pink-700',
  },
  hotel: {
    label: 'Hébergement',
    shortLabel: 'Hôtel',
    icon: BedDouble,
    glyph: 'H',
    color: '#2563eb',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-700',
    iconBgClass: 'bg-blue-100 text-blue-700',
  },
  transport: {
    label: 'Transport',
    shortLabel: 'Transport',
    icon: TrainFront,
    glyph: 'T',
    color: '#0891b2',
    badgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-700',
    iconBgClass: 'bg-cyan-100 text-cyan-700',
  },
  other: {
    label: 'Autre',
    shortLabel: 'Autre',
    icon: MapPin,
    glyph: '•',
    color: '#64748b',
    badgeClass: 'border-slate-200 bg-slate-100 text-slate-700',
    iconBgClass: 'bg-slate-100 text-slate-600',
  },
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

/** Dégradés de couverture pour les cartes de voyages */
export const TRIP_GRADIENTS = [
  'from-rose-600 via-rose-500 to-orange-500',
  'from-indigo-600 via-blue-600 to-sky-500',
  'from-emerald-600 via-teal-600 to-cyan-500',
  'from-amber-600 via-orange-500 to-rose-500',
  'from-violet-600 via-purple-600 to-fuchsia-500',
  'from-slate-800 via-slate-700 to-rose-700',
];

export function tripGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return TRIP_GRADIENTS[Math.abs(hash) % TRIP_GRADIENTS.length];
}
