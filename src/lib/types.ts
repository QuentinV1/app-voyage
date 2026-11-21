export type Category =
  | 'food'
  | 'temple'
  | 'sight'
  | 'nature'
  | 'shopping'
  | 'hotel'
  | 'transport'
  | 'other';

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  updatedAt?: number;
}

export interface Trip {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  memberEmails: string[]; // en minuscules
  createdBy: string;
  createdAt?: number;
  updatedAt?: number;
}

/** Informations facultatives d'une journée (id = date YYYY-MM-DD) */
export interface DayInfo {
  id: string;
  title?: string;
  city?: string;
  notes?: string;
}

export interface Place {
  id: string;
  name: string;
  category: Category;
  /** Date du jour (YYYY-MM-DD) ou null = « idée à placer » */
  date: string | null;
  order: number;
  time?: string; // HH:mm
  notes?: string;
  address?: string;
  city?: string;
  lat?: number;
  lng?: number;
  googlePlaceId?: string;
  googleMapsUri?: string;
  rating?: number;
  addedBy?: string;
  createdAt?: number;
}

export type NewPlace = Omit<Place, 'id' | 'order' | 'createdAt'> & { order?: number };

export type JournalMood = 'amazing' | 'happy' | 'chill' | 'tired' | 'food';

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD
  title?: string;
  content: string;
  mood?: JournalMood;
  location?: string;
  placeId?: string;
  photos: string[]; // Data URLs compressées WebP/JPEG
  authorUid?: string;
  authorEmail?: string;
  authorName?: string;
  createdAt: number;
  updatedAt?: number;
}

export type NewJournalEntry = Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>;
