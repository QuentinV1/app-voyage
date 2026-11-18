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
import { db } from './firebase';
import type { DayInfo, NewPlace, Place, Trip } from './types';

const tripsCol = () => collection(db, 'trips');
const placesCol = (tripId: string) => collection(db, 'trips', tripId, 'places');
const daysCol = (tripId: string) => collection(db, 'trips', tripId, 'days');

interface Live<T> {
  data: T;
  loading: boolean;
  error: Error | null;
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
      (snap) => {
        const trips = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Trip);
        trips.sort((a, b) => a.startDate.localeCompare(b.startDate));
        setState({ data: trips, loading: false, error: null });
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
      (snap) =>
        setState({
          data: snap.exists() ? ({ id: snap.id, ...snap.data() } as Trip) : null,
          loading: false,
          error: null,
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
      (snap) => {
        const places = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Place);
        places.sort((a, b) => a.order - b.order);
        setState({ data: places, loading: false, error: null });
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

/* ------------------------------------------------------------------ */
/* Écritures                                                          */
/* ------------------------------------------------------------------ */

export async function createTrip(input: Omit<Trip, 'id' | 'createdAt'>): Promise<string> {
  const ref = await addDoc(tripsCol(), {
    ...input,
    memberEmails: normalizeEmails(input.memberEmails),
    createdAt: Date.now(),
  });
  return ref.id;
}

export function updateTrip(tripId: string, patch: Partial<Omit<Trip, 'id'>>) {
  const data = { ...patch };
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

export function normalizeEmails(emails: string[]): string[] {
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
}
