import { useOutletContext } from 'react-router-dom';
import type { DayInfo, JournalEntry, Place, Trip, UserProfile } from './types';

export interface TripCtx {
  trip: Trip;
  places: Place[];
  days: Record<string, DayInfo>;
  journal: JournalEntry[];
  memberProfiles: Record<string, UserProfile>;
  dates: string[];
  isOnline: boolean;
  /** Index du jour (0..n) pour une date, -1 si idée / hors voyage */
  dayIndex: (date: string | null) => number;
}

export function useTripCtx(): TripCtx {
  return useOutletContext<TripCtx>();
}
