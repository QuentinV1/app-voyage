import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type FieldValue,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import type { DayInfo, JournalEntry, NewJournalEntry, NewPlace, Place, Trip, UserProfile } from './types';

const tripsCol = () => collection(db, 'trips');
const placesCol = (tripId: string) => collection(db, 'trips', tripId, 'places');
const daysCol = (tripId: string) => collection(db, 'trips', tripId, 'days');
const journalCol = (tripId: string) => collection(db, 'trips', tripId, 'journal');
const usersCol = () => collection(db, 'users');

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
  const email = user.email?.trim().toLowerCase();
  if (!email) return;
  await setDoc(
    doc(db, 'users', user.uid),
    {
      uid: user.uid,
      email,
      displayName: user.displayName || email.split('@')[0],
      photoURL: user.photoURL || null,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export function useUserProfiles(emails: string[]): Record<string, UserProfile> {
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const key = [...emails].sort().join(',');

  useEffect(() => {
    const clean = normalizeEmails(emails);
    if (!clean.length) return;
    // Firestore `in` accepte jusqu'à 30 valeurs
    const q = query(usersCol(), where('email', 'in', clean.slice(0, 30)));
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
/* Hooks temps réel                                                    */
/* ------------------------------------------------------------------ */

export function useTrips(email: string | null): Live<Trip[]> {
  const [state, setState] = useState<Live<Trip[]>>({ data: [], loading: true, error: null });
  useEffect(() => {
    if (!email) return;
    const q = query(tripsCol(), where('memberEmails', 'array-contains', email));
    return onSnapshot(
      q,
      { includeMetadataChanges: true },
      (snap) => {
        const trips = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trip);
        trips.sort((a, b) => a.startDate.localeCompare(b.startDate));
        setState({
          data: trips,
          loading: false,
          error: null,
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites,
        });
      },
      (error) => setState({ data: [], loading: false, error }),
    );
  }, [email]);
  return state;
}

export function useTrip(tripId: string | undefined): Live<Trip | null> {
  const [state, setState] = useState<Live<Trip | null>>({ data: null, loading: true, error: null });
  useEffect(() => {
    if (!tripId) return;
    return onSnapshot(
      doc(db, 'trips', tripId),
      { includeMetadataChanges: true },
      (snap) =>
        setState({
          data: snap.exists() ? ({ id: snap.id, ...snap.data() } as Trip) : null,
          loading: false,
          error: null,
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites,
        }),
      (error) => setState({ data: null, loading: false, error }),
    );
  }, [tripId]);
  return state;
}

export function usePlaces(tripId: string | undefined): Live<Place[]> {
  const [state, setState] = useState<Live<Place[]>>({ data: [], loading: true, error: null });
  useEffect(() => {
    if (!tripId) return;
    return onSnapshot(
      placesCol(tripId),
      { includeMetadataChanges: true },
      (snap) => {
        const places = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Place);
        places.sort((a, b) => a.order - b.order);
        setState({
          data: places,
          loading: false,
          error: null,
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites,
        });
      },
      (error) => setState({ data: [], loading: false, error }),
    );
  }, [tripId]);
  return state;
}

export function useDays(tripId: string | undefined): Live<Record<string, DayInfo>> {
  const [state, setState] = useState<Live<Record<string, DayInfo>>>({ data: {}, loading: true, error: null });
  useEffect(() => {
    if (!tripId) return;
    return onSnapshot(
      daysCol(tripId),
      (snap) => {
        const days: Record<string, DayInfo> = {};
        snap.docs.forEach((d) => (days[d.id] = { id: d.id, ...d.data() } as DayInfo));
        setState({ data: days, loading: false, error: null });
      },
      (error) => setState({ data: {}, loading: false, error }),
    );
  }, [tripId]);
  return state;
}

export function useJournal(tripId: string | undefined): Live<JournalEntry[]> {
  const [state, setState] = useState<Live<JournalEntry[]>>({ data: [], loading: true, error: null });
  useEffect(() => {
    if (!tripId) return;
    return onSnapshot(
      journalCol(tripId),
      { includeMetadataChanges: true },
      (snap) => {
        const entries = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as JournalEntry);
        entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
        setState({
          data: entries,
          loading: false,
          error: null,
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites,
        });
      },
      (error) => setState({ data: [], loading: false, error }),
    );
  }, [tripId]);
  return state;
}

/* ------------------------------------------------------------------ */
/* Écritures                                                          */
/* ------------------------------------------------------------------ */

export async function createTrip(input: Omit<Trip, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(tripsCol(), {
    ...input,
    memberEmails: normalizeEmails(input.memberEmails),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export function updateTrip(tripId: string, patch: Partial<Omit<Trip, 'id'>>) {
  const data = { ...patch, updatedAt: Date.now() };
  if (data.memberEmails) data.memberEmails = normalizeEmails(data.memberEmails);
  return updateDoc(doc(db, 'trips', tripId), data);
}

export function setDayInfo(tripId: string, date: string, patch: Omit<DayInfo, 'id'>) {
  return setDoc(doc(db, 'trips', tripId, 'days', date), patch, { merge: true });
}

export function nextOrder(places: Place[], date: string | null): number {
  const same = places.filter((p) => p.date === date);
  return same.length ? Math.max(...same.map((p) => p.order)) + 1 : 0;
}

export function addPlace(tripId: string, place: NewPlace, existing: Place[]) {
  return addDoc(placesCol(tripId), {
    ...place,
    order: place.order ?? nextOrder(existing, place.date),
    createdAt: Date.now(),
  });
}

/** Ajout groupé (import / IA) */
export async function addPlacesBatch(tripId: string, places: NewPlace[], existing: Place[]) {
  const orders = new Map<string, number>();
  const batch = writeBatch(db);
  for (const p of places) {
    const key = p.date ?? '__ideas__';
    const start = orders.get(key) ?? nextOrder(existing, p.date);
    orders.set(key, start + 1);
    batch.set(doc(placesCol(tripId)), { ...p, order: p.order ?? start, createdAt: Date.now() });
  }
  await batch.commit();
}

/** Mise à jour partielle : une valeur `undefined` supprime le champ */
export function updatePlace(tripId: string, placeId: string, patch: Partial<Omit<Place, 'id'>>) {
  const data: Record<string, FieldValue | Place[keyof Place]> = {};
  for (const [k, v] of Object.entries(patch)) data[k] = v === undefined ? deleteField() : v;
  return updateDoc(doc(db, 'trips', tripId, 'places', placeId), data);
}

export function deletePlace(tripId: string, placeId: string) {
  return deleteDoc(doc(db, 'trips', tripId, 'places', placeId));
}

/** Échange l'ordre de deux lieux (monter / descendre) */
export async function swapOrder(tripId: string, a: Place, b: Place) {
  const batch = writeBatch(db);
  batch.update(doc(db, 'trips', tripId, 'places', a.id), { order: b.order });
  batch.update(doc(db, 'trips', tripId, 'places', b.id), { order: a.order === b.order ? a.order + 1 : a.order });
  await batch.commit();
}

/* ------------------------------------------------------------------ */
/* Carnet de voyage                                                   */
/* ------------------------------------------------------------------ */

export function addJournalEntry(tripId: string, entry: NewJournalEntry) {
  const now = Date.now();
  return addDoc(journalCol(tripId), {
    ...entry,
    createdAt: now,
    updatedAt: now,
  });
}

export function updateJournalEntry(tripId: string, entryId: string, patch: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>) {
  const data: Record<string, FieldValue | JournalEntry[keyof JournalEntry]> = {
    updatedAt: Date.now(),
  };
  for (const [k, v] of Object.entries(patch)) {
    data[k] = v === undefined ? deleteField() : v;
  }
  return updateDoc(doc(db, 'trips', tripId, 'journal', entryId), data);
}

export function deleteJournalEntry(tripId: string, entryId: string) {
  return deleteDoc(doc(db, 'trips', tripId, 'journal', entryId));
}

export function normalizeEmails(emails: string[]): string[] {
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}
