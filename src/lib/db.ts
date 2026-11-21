import { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { cleanForFirestore, db, isFirebaseConfigured } from './firebase';
import {
  addJournalEntryLocal,
  addPlaceLocal,
  addPlacesBatchLocal,
  createTripLocal,
  deleteJournalEntryLocal,
  deletePlaceLocal,
  getCloudSnapshot,
  getStoreSnapshot,
  nextOrder,
  normalizeEmails,
  setDayInfoLocal,
  subscribeStore,
  swapOrderLocal,
  updateJournalEntryLocal,
  updatePlaceLocal,
  updateTripLocal,
} from './store';
import type { DayInfo, JournalEntry, NewJournalEntry, NewPlace, Place, Trip, UserProfile } from './types';

interface Live<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  fromCache?: boolean;
  hasPendingWrites?: boolean;
}

/* ------------------------------------------------------------------ */
/* Profils utilisateurs                                               */
/* ------------------------------------------------------------------ */

export async function upsertUserProfile(user: User) {
  if (!isFirebaseConfigured || !db) return;
  const email = user.email?.trim().toLowerCase();
  if (!email) return;
  await setDoc(
    doc(db, 'users', user.uid),
    cleanForFirestore({
      uid: user.uid,
      email,
      displayName: (user.displayName || email.split('@')[0]).slice(0, 120),
      photoURL: user.photoURL || null,
      updatedAt: Date.now(),
    }),
    { merge: true },
  );
}

export function useUserProfiles(emails: string[]): Record<string, UserProfile> {
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const key = [...emails].sort().join(',');

  useEffect(() => {
    if (!isFirebaseConfigured || !db) return;
    const clean = normalizeEmails(emails).filter((e) => e !== 'local@offline');
    if (!clean.length) return;
    const q = query(collection(db, 'users'), where('email', 'in', clean.slice(0, 30)));
    return onSnapshot(
      q,
      (snap) => {
        const map: Record<string, UserProfile> = {};
        snap.docs.forEach((d) => {
          const p = d.data() as UserProfile;
          if (p.email) map[p.email.toLowerCase()] = p;
        });
        setProfiles(map);
      },
      () => {
        // Silencieux si hors-ligne sans cache pour les profils
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return profiles;
}

/* ------------------------------------------------------------------ */
/* Hooks Local-First synchronisés avec Firestore                       */
/* ------------------------------------------------------------------ */

function useStoreState() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeStore(() => setTick((n) => n + 1)), []);
  return { store: getStoreSnapshot(), cloud: getCloudSnapshot() };
}

export function useTrips(_email: string | null): Live<Trip[]> {
  const { store, cloud } = useStoreState();
  return {
    data: store.trips,
    loading: false,
    error: cloud.syncError ? new Error(cloud.syncError) : null,
    hasPendingWrites: cloud.syncStatus === 'syncing',
  };
}

export function useTrip(tripId: string | undefined): Live<Trip | null> {
  const { store, cloud } = useStoreState();
  const trip = tripId ? store.trips.find((t) => t.id === tripId) ?? null : null;
  return {
    data: trip,
    loading: false,
    error: cloud.syncError ? new Error(cloud.syncError) : null,
    hasPendingWrites: cloud.syncStatus === 'syncing',
  };
}

export function usePlaces(tripId: string | undefined): Live<Place[]> {
  const { store, cloud } = useStoreState();
  const places = tripId ? store.placesByTrip[tripId] ?? [] : [];
  return {
    data: places,
    loading: false,
    error: cloud.syncError ? new Error(cloud.syncError) : null,
    hasPendingWrites: cloud.syncStatus === 'syncing',
  };
}

export function useDays(tripId: string | undefined): Live<Record<string, DayInfo>> {
  const { store, cloud } = useStoreState();
  const days = tripId ? store.daysByTrip[tripId] ?? {} : {};
  return {
    data: days,
    loading: false,
    error: cloud.syncError ? new Error(cloud.syncError) : null,
    hasPendingWrites: cloud.syncStatus === 'syncing',
  };
}

export function useJournal(tripId: string | undefined): Live<JournalEntry[]> {
  const { store, cloud } = useStoreState();
  const journal = tripId ? store.journalByTrip[tripId] ?? [] : [];
  return {
    data: journal,
    loading: false,
    error: cloud.syncError ? new Error(cloud.syncError) : null,
    hasPendingWrites: cloud.syncStatus === 'syncing',
  };
}

/* ------------------------------------------------------------------ */
/* Écritures (Local-First + Push debounced 450 ms)                     */
/* ------------------------------------------------------------------ */

export async function createTrip(input: Omit<Trip, 'id' | 'createdAt'>): Promise<string> {
  return createTripLocal(input);
}

export function updateTrip(tripId: string, patch: Partial<Omit<Trip, 'id'>>) {
  return updateTripLocal(tripId, patch);
}

export function setDayInfo(tripId: string, date: string, patch: Omit<DayInfo, 'id'>) {
  return setDayInfoLocal(tripId, date, patch);
}

export { nextOrder, normalizeEmails };

export function addPlace(tripId: string, place: NewPlace, existing: Place[]) {
  return addPlaceLocal(tripId, place, existing);
}

export async function addPlacesBatch(tripId: string, places: NewPlace[], existing: Place[]) {
  return addPlacesBatchLocal(tripId, places, existing);
}

export function updatePlace(tripId: string, placeId: string, patch: Partial<Omit<Place, 'id'>>) {
  return updatePlaceLocal(tripId, placeId, patch);
}

export function deletePlace(tripId: string, placeId: string) {
  return deletePlaceLocal(tripId, placeId);
}

export async function swapOrder(tripId: string, a: Place, b: Place) {
  return swapOrderLocal(tripId, a, b);
}

export function addJournalEntry(tripId: string, entry: NewJournalEntry) {
  return addJournalEntryLocal(tripId, entry);
}

export function updateJournalEntry(
  tripId: string,
  entryId: string,
  patch: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>,
) {
  return updateJournalEntryLocal(tripId, entryId, patch);
}

export function deleteJournalEntry(tripId: string, entryId: string) {
  return deleteJournalEntryLocal(tripId, entryId);
}
