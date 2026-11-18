import { useOutletContext } from 'react-router-dom';
import type { DayInfo, Place, Trip } from './types';

export interface TripCtx {
  trip: Trip;
  places: Place[];
  days: Record<string, DayInfo>;
  dates: string[];
  /** Index du jour (0..n) pour une date, -1 si idée / hors voyage */
  dayIndex: (date: string | null) => number;
}

export function useTripCtx(): TripCtx {
  return useOutletContext<TripCtx>();
}
