import { useEffect, useState } from 'react';
import type { DayInfo, JournalEntry, Place, Trip } from './types';

const SNAPSHOT_PREFIX = 'voyage_offline_snapshot_v1_';

export interface TripOfflineSnapshot {
  savedAt: number;
  trip: Trip;
  places: Place[];
  days: Record<string, DayInfo>;
  journal: JournalEntry[];
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return online;
}

export function saveTripSnapshot(tripId: string, snapshot: Omit<TripOfflineSnapshot, 'savedAt'>): number {
  const payload: TripOfflineSnapshot = { ...snapshot, savedAt: Date.now() };
  try {
    localStorage.setItem(`${SNAPSHOT_PREFIX}${tripId}`, JSON.stringify(payload));
    return payload.savedAt;
  } catch {
    // Si le quota localStorage est saturé par les photos, on sauvegarde sans les photos du carnet
    try {
      const compact: TripOfflineSnapshot = {
        ...payload,
        journal: payload.journal.map((j) => ({ ...j, photos: [] })),
      };
      localStorage.setItem(`${SNAPSHOT_PREFIX}${tripId}`, JSON.stringify(compact));
      return payload.savedAt;
    } catch {
      return 0;
    }
  }
}

export function loadTripSnapshot(tripId: string): TripOfflineSnapshot | null {
  try {
    const raw = localStorage.getItem(`${SNAPSHOT_PREFIX}${tripId}`);
    if (!raw) return null;
    return JSON.parse(raw) as TripOfflineSnapshot;
  } catch {
    return null;
  }
}
