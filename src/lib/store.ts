import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { cleanForFirestore, db, isFirebaseConfigured } from './firebase';
import type { DayInfo, JournalEntry, NewJournalEntry, NewPlace, Place, Trip, UserProfile } from './types';

export const STORAGE_KEY = 'voyage_japon_data_v1';
export const LAST_UID_KEY = 'voyage_japon_last_uid';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface CloudState {
  initialSyncDone: boolean;
  syncedCols: Record<string, boolean>;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
}

export interface LocalStoreData {
  trips: Trip[];
  placesByTrip: Record<string, Place[]>;
  daysByTrip: Record<string, Record<string, DayInfo>>;
  journalByTrip: Record<string, JournalEntry[]>;
  profilesByEmail: Record<string, UserProfile>;
  settings: {
    lastTripId?: string | null;
    updatedAt?: number;
  };
}

const DEFAULT_STORE: LocalStoreData = {
  trips: [],
  placesByTrip: {},
  daysByTrip: {},
  journalByTrip: {},
  profilesByEmail: {},
  settings: { lastTripId: null },
};

export const cloudState: CloudState = {
  initialSyncDone: false,
  syncedCols: {},
  syncStatus: 'idle',
  syncError: null,
  lastSyncedAt: null,
};

let storeState: LocalStoreData = loadLocalStore();
const storeSubscribers = new Set<() => void>();
let unsubListeners: Unsubscribe[] = [];
const tripSubUnsubscribers = new Map<string, Unsubscribe[]>();
let currentUser: User | null = null;
let _suppressCloudSync = false;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;

function notifySubscribers() {
  storeSubscribers.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error(e);
    }
  });
}

export function subscribeStore(cb: () => void): () => void {
  storeSubscribers.add(cb);
  return () => {
    storeSubscribers.delete(cb);
  };
}

export function getStoreSnapshot(): LocalStoreData {
  return storeState;
}

export function getCloudSnapshot(): CloudState {
  return { ...cloudState, syncedCols: { ...cloudState.syncedCols } };
}

function loadLocalStore(): LocalStoreData {
  if (typeof window === 'undefined') return DEFAULT_STORE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STORE };
    const parsed = JSON.parse(raw) as Partial<LocalStoreData>;
    return {
      trips: Array.isArray(parsed.trips) ? parsed.trips : [],
      placesByTrip: parsed.placesByTrip && typeof parsed.placesByTrip === 'object' ? parsed.placesByTrip : {},
      daysByTrip: parsed.daysByTrip && typeof parsed.daysByTrip === 'object' ? parsed.daysByTrip : {},
      journalByTrip: parsed.journalByTrip && typeof parsed.journalByTrip === 'object' ? parsed.journalByTrip : {},
      profilesByEmail: parsed.profilesByEmail && typeof parsed.profilesByEmail === 'object' ? parsed.profilesByEmail : {},
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : { lastTripId: null },
    };
  } catch (e) {
    console.warn('Erreur lecture localStorage:', e);
    return { ...DEFAULT_STORE };
  }
}

export function reinitialiserEtatCloud() {
  cloudState.initialSyncDone = false;
  cloudState.syncedCols = {};
  cloudState.syncStatus = 'idle';
  cloudState.syncError = null;
  cloudState.lastSyncedAt = null;
  notifySubscribers();
}

export function arreterListenersFirestore() {
  if (_syncTimer) {
    clearTimeout(_syncTimer);
    _syncTimer = null;
  }
  unsubListeners.forEach((u) => {
    try {
      u();
    } catch {}
  });
  unsubListeners = [];
  tripSubUnsubscribers.forEach((list) => {
    list.forEach((u) => {
      try {
        u();
      } catch {}
    });
  });
  tripSubUnsubscribers.clear();
}

function formatFirestoreError(err: unknown): string {
  const code = (err as { code?: string })?.code || '';
  const msg = (err as { message?: string })?.message || '';
  if (code === 'permission-denied' || msg.includes('Missing or insufficient permissions')) {
    return 'Accès Firestore refusé (vérifiez que votre e-mail est bien vérifié et autorisé).';
  }
  return msg || 'Erreur de synchronisation Firestore';
}

export function sauvegarderDonnees(skipCloud = false) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storeState));
  } catch (e) {
    console.warn('Quota localStorage saturé, tentative compacte sans photos du carnet:', e);
    try {
      const compactJournal: Record<string, JournalEntry[]> = {};
      for (const [tId, list] of Object.entries(storeState.journalByTrip)) {
        compactJournal[tId] = list.map((j) => ({ ...j, photos: [] }));
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...storeState, journalByTrip: compactJournal }));
    } catch {}
  }

  notifySubscribers();

  if (!skipCloud && !_suppressCloudSync && currentUser && cloudState.initialSyncDone) {
    if (_syncTimer) clearTimeout(_syncTimer);
    cloudState.syncStatus = 'syncing';
    cloudState.syncError = null;
    notifySubscribers();

    _syncTimer = setTimeout(async () => {
      try {
        await syncAllUserDataToFirestore();
        cloudState.syncStatus = 'synced';
        cloudState.lastSyncedAt = new Date().toISOString();
        notifySubscribers();
      } catch (err) {
        console.warn('Sync Firestore:', err);
        cloudState.syncStatus = 'error';
        cloudState.syncError = formatFirestoreError(err);
        notifySubscribers();
      }
    }, 450);
  }
}

export function normalizeEmails(emails: string[]): string[] {
  return [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeTripForFirestore(trip: Trip, userEmail: string): Record<string, unknown> {
  const email = userEmail.toLowerCase();
  const members = normalizeEmails([...(trip.memberEmails || []), email]);
  const createdBy =
    trip.createdBy && trip.createdBy.includes('@') && members.includes(trip.createdBy.toLowerCase())
      ? trip.createdBy.toLowerCase()
      : email;
  const payload: Record<string, unknown> = {
    name: (trip.name || 'Voyage').slice(0, 120),
    startDate: trip.startDate,
    endDate: trip.endDate >= trip.startDate ? trip.endDate : trip.startDate,
    memberEmails: members,
    createdBy,
    createdAt: trip.createdAt || Date.now(),
    updatedAt: trip.updatedAt || Date.now(),
  };
  return cleanForFirestore(payload);
}

function sanitizePlaceForFirestore(p: Place): Record<string, unknown> {
  const allowedKeys = [
    'name',
    'category',
    'date',
    'order',
    'time',
    'notes',
    'address',
    'city',
    'lat',
    'lng',
    'googlePlaceId',
    'googleMapsUri',
    'rating',
    'addedBy',
    'createdAt',
    'updatedAt',
  ] as const;

  const out: Record<string, unknown> = {
    name: (p.name || 'Lieu').slice(0, 200),
    category: p.category || 'other',
    date: p.date || null,
    order: typeof p.order === 'number' ? p.order : 0,
  };

  for (const k of allowedKeys) {
    if (k in out) continue;
    const val = p[k as keyof Place];
    if (val !== undefined && val !== null && val !== '') {
      out[k] = val;
    }
  }
  return cleanForFirestore(out);
}

function sanitizeDayForFirestore(d: DayInfo): Record<string, unknown> {
  const out: Record<string, unknown> = {
    updatedAt: Date.now(),
  };
  if (d.title !== undefined && d.title !== null) out.title = String(d.title).slice(0, 200);
  if (d.city !== undefined && d.city !== null) out.city = String(d.city).slice(0, 120);
  if (d.notes !== undefined && d.notes !== null) out.notes = String(d.notes).slice(0, 5000);
  return cleanForFirestore(out);
}

function sanitizeJournalForFirestore(j: JournalEntry, user: User): Record<string, unknown> {
  const email = (user.email || '').toLowerCase();
  const out: Record<string, unknown> = {
    date: j.date,
    content: (j.content || '').slice(0, 20000),
    photos: Array.isArray(j.photos) ? j.photos.slice(0, 10) : [],
    createdAt: j.createdAt || Date.now(),
    updatedAt: j.updatedAt || Date.now(),
  };
  if (j.title) out.title = j.title.slice(0, 200);
  if (j.location) out.location = j.location.slice(0, 120);
  if (j.mood) out.mood = j.mood;
  if (j.placeId) out.placeId = j.placeId.slice(0, 128);
  if (j.authorUid || user.uid) out.authorUid = j.authorUid || user.uid;
  if (j.authorEmail && j.authorEmail.includes('@')) {
    out.authorEmail = j.authorEmail.toLowerCase();
  } else if (email) {
    out.authorEmail = email;
  }
  if (j.authorName || user.displayName) {
    out.authorName = (j.authorName || user.displayName || '').slice(0, 120);
  }
  return cleanForFirestore(out);
}

async function commitInChunks(
  ops: Array<{ type: 'set' | 'delete'; ref: ReturnType<typeof doc>; data?: Record<string, unknown> }>,
) {
  if (!isFirebaseConfigured || !db || ops.length === 0) return;
  const CHUNK_SIZE = 450;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.type === 'delete') {
        batch.delete(op.ref);
      } else if (op.data) {
        batch.set(op.ref, op.data);
      }
    }
    await batch.commit();
  }
}

export async function syncAllUserDataToFirestore() {
  if (!isFirebaseConfigured || !db || !currentUser || !currentUser.email) return;
  const uid = currentUser.uid;
  const email = currentUser.email.trim().toLowerCase();

  // 1. Profil utilisateur dans users/{uid}
  await setDoc(
    doc(db, 'users', uid),
    cleanForFirestore({
      uid,
      email,
      displayName: (currentUser.displayName || email.split('@')[0]).slice(0, 120),
      photoURL: currentUser.photoURL || null,
      updatedAt: Date.now(),
    }),
    { merge: true },
  );

  // 2. Diff et push de la collection trips (où l'utilisateur est membre)
  const tripsQuery = query(collection(db, 'trips'), where('memberEmails', 'array-contains', email));
  const existingTripsSnap = await getDocs(tripsQuery);

  // S'assurer que tous les voyages locaux incluent l'email courant dans memberEmails
  const localTrips = storeState.trips.map((t) => {
    const members = normalizeEmails([...(t.memberEmails || []).filter((m) => m !== 'local@offline'), email]);
    const createdBy =
      t.createdBy && t.createdBy !== 'local@offline' && t.createdBy.includes('@') ? t.createdBy.toLowerCase() : email;
    return { ...t, memberEmails: members, createdBy };
  });

  storeState = { ...storeState, trips: localTrips };

  const currentTripIds = new Set(localTrips.filter((t) => t && t.id).map((t) => String(t.id)));
  const tripOps: Array<{ type: 'set' | 'delete'; ref: ReturnType<typeof doc>; data?: Record<string, unknown> }> = [];

  existingTripsSnap.docs.forEach((d) => {
    if (!currentTripIds.has(d.id)) {
      tripOps.push({ type: 'delete', ref: d.ref });
    }
  });

  for (const trip of localTrips) {
    if (!trip || !trip.id) continue;
    tripOps.push({
      type: 'set',
      ref: doc(db, 'trips', String(trip.id)),
      data: sanitizeTripForFirestore(trip, email),
    });
  }

  await commitInChunks(tripOps);

  // 3. Diff et push des sous-collections places, days, journal pour chaque voyage actif
  for (const trip of localTrips) {
    const tripId = String(trip.id);

    // Places
    const placesRef = collection(db, 'trips', tripId, 'places');
    const existingPlacesSnap = await getDocs(placesRef);
    const localPlaces = storeState.placesByTrip[tripId] || [];
    const placeIds = new Set(localPlaces.filter((p) => p && p.id).map((p) => String(p.id)));
    const placeOps: Array<{ type: 'set' | 'delete'; ref: ReturnType<typeof doc>; data?: Record<string, unknown> }> = [];

    existingPlacesSnap.docs.forEach((d) => {
      if (!placeIds.has(d.id)) placeOps.push({ type: 'delete', ref: d.ref });
    });
    localPlaces.forEach((p) => {
      if (p && p.id) {
        placeOps.push({
          type: 'set',
          ref: doc(placesRef, String(p.id)),
          data: sanitizePlaceForFirestore(p),
        });
      }
    });
    await commitInChunks(placeOps);

    // Days
    const daysRef = collection(db, 'trips', tripId, 'days');
    const existingDaysSnap = await getDocs(daysRef);
    const localDaysMap = storeState.daysByTrip[tripId] || {};
    const localDays = Object.values(localDaysMap).filter((d) => d && d.id);
    const dayIds = new Set(localDays.map((d) => String(d.id)));
    const dayOps: Array<{ type: 'set' | 'delete'; ref: ReturnType<typeof doc>; data?: Record<string, unknown> }> = [];

    existingDaysSnap.docs.forEach((d) => {
      if (!dayIds.has(d.id)) dayOps.push({ type: 'delete', ref: d.ref });
    });
    localDays.forEach((d) => {
      if (d && d.id && /^\d{4}-\d{2}-\d{2}$/.test(d.id)) {
        dayOps.push({
          type: 'set',
          ref: doc(daysRef, String(d.id)),
          data: sanitizeDayForFirestore(d),
        });
      }
    });
    await commitInChunks(dayOps);

    // Journal
    const journalRef = collection(db, 'trips', tripId, 'journal');
    const existingJournalSnap = await getDocs(journalRef);
    const localJournal = storeState.journalByTrip[tripId] || [];
    const journalIds = new Set(localJournal.filter((j) => j && j.id).map((j) => String(j.id)));
    const journalOps: Array<{ type: 'set' | 'delete'; ref: ReturnType<typeof doc>; data?: Record<string, unknown> }> = [];

    existingJournalSnap.docs.forEach((d) => {
      if (!journalIds.has(d.id)) journalOps.push({ type: 'delete', ref: d.ref });
    });
    localJournal.forEach((j) => {
      if (j && j.id) {
        journalOps.push({
          type: 'set',
          ref: doc(journalRef, String(j.id)),
          data: sanitizeJournalForFirestore(j, currentUser!),
        });
      }
    });
    await commitInChunks(journalOps);
  }
}

export async function activerSyncCloud(user: User | null) {
  currentUser = user;
  arreterListenersFirestore();
  if (!isFirebaseConfigured || !db || !user || !user.email) {
    reinitialiserEtatCloud();
    return;
  }

  reinitialiserEtatCloud();
  cloudState.syncStatus = 'syncing';
  notifySubscribers();

  const currentUid = user.uid;
  const email = user.email.trim().toLowerCase();
  const previousUid = localStorage.getItem(LAST_UID_KEY);
  const isNewDeviceLogin = Boolean(currentUid && previousUid !== currentUid);
  let needsPushAfterInit = false;

  const expectedCols = new Set<string>(['trips']);

  const checkInitialSyncComplete = () => {
    for (const colKey of expectedCols) {
      if (!cloudState.syncedCols[colKey]) return;
    }
    if (!cloudState.initialSyncDone) {
      cloudState.initialSyncDone = true;
      cloudState.syncStatus = 'synced';
      cloudState.lastSyncedAt = new Date().toISOString();
      localStorage.setItem(LAST_UID_KEY, currentUid);
      notifySubscribers();
      if (needsPushAfterInit) {
        needsPushAfterInit = false;
        sauvegarderDonnees(false);
      }
    }
  };

  const handleSyncError = (label: string, err: unknown) => {
    console.warn(`Sync ${label}:`, err);
    cloudState.syncStatus = 'error';
    cloudState.syncError = formatFirestoreError(err);
    notifySubscribers();
  };

  const attachTripSubListeners = (tripId: string) => {
    if (tripSubUnsubscribers.has(tripId)) return;
    const subUnsubs: Unsubscribe[] = [];

    const placesKey = `places_${tripId}`;
    const daysKey = `days_${tripId}`;
    const journalKey = `journal_${tripId}`;
    expectedCols.add(placesKey);
    expectedCols.add(daysKey);
    expectedCols.add(journalKey);

    // 1. Places
    subUnsubs.push(
      onSnapshot(
        collection(db, 'trips', tripId, 'places'),
        { includeMetadataChanges: true },
        (snap) => {
          const fromCache = snap.metadata.fromCache;
          const serverList = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Place)
            .sort((a, b) => a.order - b.order);

          if (fromCache && serverList.length === 0) return;

          const isFirstServer = !fromCache && !cloudState.syncedCols[placesKey];
          const localList = storeState.placesByTrip[tripId] || [];

          if (isFirstServer) {
            cloudState.syncedCols[placesKey] = true;
            if (serverList.length === 0 && localList.length > 0) {
              needsPushAfterInit = true;
            } else if (serverList.length > 0 && localList.length > 0 && isNewDeviceLogin) {
              const serverIds = new Set(serverList.map((i) => String(i.id)));
              const localOnly = localList.filter((i) => i && i.id && !serverIds.has(String(i.id)));
              _suppressCloudSync = true;
              storeState = {
                ...storeState,
                placesByTrip: { ...storeState.placesByTrip, [tripId]: [...serverList, ...localOnly] },
              };
              sauvegarderDonnees(true);
              _suppressCloudSync = false;
              if (localOnly.length > 0) needsPushAfterInit = true;
            } else {
              _suppressCloudSync = true;
              storeState = {
                ...storeState,
                placesByTrip: { ...storeState.placesByTrip, [tripId]: serverList },
              };
              sauvegarderDonnees(true);
              _suppressCloudSync = false;
            }
            checkInitialSyncComplete();
          } else {
            _suppressCloudSync = true;
            storeState = {
              ...storeState,
              placesByTrip: { ...storeState.placesByTrip, [tripId]: serverList },
            };
            sauvegarderDonnees(true);
            _suppressCloudSync = false;
          }
        },
        (err) => handleSyncError(placesKey, err),
      ),
    );

    // 2. Days
    subUnsubs.push(
      onSnapshot(
        collection(db, 'trips', tripId, 'days'),
        { includeMetadataChanges: true },
        (snap) => {
          const fromCache = snap.metadata.fromCache;
          const serverDays: Record<string, DayInfo> = {};
          snap.docs.forEach((d) => {
            serverDays[d.id] = { id: d.id, ...d.data() } as DayInfo;
          });
          const serverKeys = Object.keys(serverDays);

          if (fromCache && serverKeys.length === 0) return;

          const isFirstServer = !fromCache && !cloudState.syncedCols[daysKey];
          const localDays = storeState.daysByTrip[tripId] || {};
          const localKeys = Object.keys(localDays);

          if (isFirstServer) {
            cloudState.syncedCols[daysKey] = true;
            if (serverKeys.length === 0 && localKeys.length > 0) {
              needsPushAfterInit = true;
            } else if (serverKeys.length > 0 && localKeys.length > 0 && isNewDeviceLogin) {
              const merged: Record<string, DayInfo> = { ...localDays, ...serverDays };
              _suppressCloudSync = true;
              storeState = {
                ...storeState,
                daysByTrip: { ...storeState.daysByTrip, [tripId]: merged },
              };
              sauvegarderDonnees(true);
              _suppressCloudSync = false;
              if (localKeys.some((k) => !(k in serverDays))) needsPushAfterInit = true;
            } else {
              _suppressCloudSync = true;
              storeState = {
                ...storeState,
                daysByTrip: { ...storeState.daysByTrip, [tripId]: serverDays },
              };
              sauvegarderDonnees(true);
              _suppressCloudSync = false;
            }
            checkInitialSyncComplete();
          } else {
            _suppressCloudSync = true;
            storeState = {
              ...storeState,
              daysByTrip: { ...storeState.daysByTrip, [tripId]: serverDays },
            };
            sauvegarderDonnees(true);
            _suppressCloudSync = false;
          }
        },
        (err) => handleSyncError(daysKey, err),
      ),
    );

    // 3. Journal
    subUnsubs.push(
      onSnapshot(
        collection(db, 'trips', tripId, 'journal'),
        { includeMetadataChanges: true },
        (snap) => {
          const fromCache = snap.metadata.fromCache;
          const serverList = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as JournalEntry)
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

          if (fromCache && serverList.length === 0) return;

          const isFirstServer = !fromCache && !cloudState.syncedCols[journalKey];
          const localList = storeState.journalByTrip[tripId] || [];

          if (isFirstServer) {
            cloudState.syncedCols[journalKey] = true;
            if (serverList.length === 0 && localList.length > 0) {
              needsPushAfterInit = true;
            } else if (serverList.length > 0 && localList.length > 0 && isNewDeviceLogin) {
              const serverIds = new Set(serverList.map((i) => String(i.id)));
              const localOnly = localList.filter((i) => i && i.id && !serverIds.has(String(i.id)));
              _suppressCloudSync = true;
              storeState = {
                ...storeState,
                journalByTrip: { ...storeState.journalByTrip, [tripId]: [...serverList, ...localOnly] },
              };
              sauvegarderDonnees(true);
              _suppressCloudSync = false;
              if (localOnly.length > 0) needsPushAfterInit = true;
            } else {
              _suppressCloudSync = true;
              storeState = {
                ...storeState,
                journalByTrip: { ...storeState.journalByTrip, [tripId]: serverList },
              };
              sauvegarderDonnees(true);
              _suppressCloudSync = false;
            }
            checkInitialSyncComplete();
          } else {
            _suppressCloudSync = true;
            storeState = {
              ...storeState,
              journalByTrip: { ...storeState.journalByTrip, [tripId]: serverList },
            };
            sauvegarderDonnees(true);
            _suppressCloudSync = false;
          }
        },
        (err) => handleSyncError(journalKey, err),
      ),
    );

    tripSubUnsubscribers.set(tripId, subUnsubs);
  };

  // Listener principal sur trips de l'utilisateur
  const tripsQuery = query(collection(db, 'trips'), where('memberEmails', 'array-contains', email));
  unsubListeners.push(
    onSnapshot(
      tripsQuery,
      { includeMetadataChanges: true },
      (snap) => {
        const fromCache = snap.metadata.fromCache;
        const serverTrips = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Trip)
          .sort((a, b) => a.startDate.localeCompare(b.startDate));

        if (fromCache && serverTrips.length === 0) return;

        const isFirstServer = !fromCache && !cloudState.syncedCols['trips'];
        const localTrips = storeState.trips || [];

        let activeTrips = serverTrips;

        if (isFirstServer) {
          cloudState.syncedCols['trips'] = true;

          if (serverTrips.length === 0 && localTrips.length > 0) {
            needsPushAfterInit = true;
            activeTrips = localTrips;
          } else if (serverTrips.length > 0 && localTrips.length > 0 && isNewDeviceLogin) {
            const serverIds = new Set(serverTrips.map((i) => String(i.id)));
            const localOnly = localTrips.filter((i) => i && i.id && !serverIds.has(String(i.id)));
            activeTrips = [...serverTrips, ...localOnly].sort((a, b) => a.startDate.localeCompare(b.startDate));
            _suppressCloudSync = true;
            storeState = { ...storeState, trips: activeTrips };
            sauvegarderDonnees(true);
            _suppressCloudSync = false;
            if (localOnly.length > 0) needsPushAfterInit = true;
          } else {
            _suppressCloudSync = true;
            storeState = { ...storeState, trips: serverTrips };
            sauvegarderDonnees(true);
            _suppressCloudSync = false;
          }
        } else {
          _suppressCloudSync = true;
          storeState = { ...storeState, trips: serverTrips };
          sauvegarderDonnees(true);
          _suppressCloudSync = false;
        }

        // Attacher les listeners de sous-collections pour chaque voyage connu
        const activeIds = new Set(activeTrips.map((t) => String(t.id)));
        activeTrips.forEach((t) => attachTripSubListeners(String(t.id)));

        // Nettoyer les listeners des voyages supprimés
        for (const [tId, unsubs] of tripSubUnsubscribers.entries()) {
          if (!activeIds.has(tId)) {
            unsubs.forEach((u) => {
              try {
                u();
              } catch {}
            });
            tripSubUnsubscribers.delete(tId);
          }
        }

        checkInitialSyncComplete();
      },
      (err) => handleSyncError('trips', err),
    ),
  );
}

export async function forcerSyncCloud(): Promise<boolean> {
  if (!currentUser) throw new Error('Non connecté au Cloud.');
  cloudState.syncStatus = 'syncing';
  cloudState.syncError = null;
  notifySubscribers();
  try {
    await syncAllUserDataToFirestore();
    cloudState.initialSyncDone = true;
    cloudState.syncStatus = 'synced';
    cloudState.lastSyncedAt = new Date().toISOString();
    if (currentUser.uid) localStorage.setItem(LAST_UID_KEY, currentUser.uid);
    notifySubscribers();
    return true;
  } catch (err) {
    cloudState.syncStatus = 'error';
    cloudState.syncError = formatFirestoreError(err);
    notifySubscribers();
    throw new Error(cloudState.syncError);
  }
}

/* ------------------------------------------------------------------ */
/* Mutations locales (Local-First) + déclenchement du push debounced  */
/* ------------------------------------------------------------------ */

export function getActiveUserEmail(): string {
  return currentUser?.email?.trim().toLowerCase() || 'local@offline';
}

export async function createTripLocal(input: Omit<Trip, 'id' | 'createdAt'>): Promise<string> {
  const id = genId('trip');
  const now = Date.now();
  const activeEmail = getActiveUserEmail();
  const memberEmails = normalizeEmails([activeEmail, ...(input.memberEmails || [])]);
  const newTrip: Trip = {
    ...input,
    id,
    memberEmails: memberEmails.length > 0 ? memberEmails : [activeEmail],
    createdBy: input.createdBy || activeEmail,
    createdAt: now,
    updatedAt: now,
  };

  storeState = {
    ...storeState,
    trips: [...storeState.trips, newTrip].sort((a, b) => a.startDate.localeCompare(b.startDate)),
    placesByTrip: { ...storeState.placesByTrip, [id]: storeState.placesByTrip[id] || [] },
    daysByTrip: { ...storeState.daysByTrip, [id]: storeState.daysByTrip[id] || {} },
    journalByTrip: { ...storeState.journalByTrip, [id]: storeState.journalByTrip[id] || [] },
  };
  sauvegarderDonnees(false);
  return id;
}

export async function updateTripLocal(tripId: string, patch: Partial<Omit<Trip, 'id'>>) {
  const updatedTrips = storeState.trips.map((t) => {
    if (t.id !== tripId) return t;
    const next: Trip = {
      ...t,
      ...patch,
      updatedAt: Date.now(),
    };
    if (patch.memberEmails) {
      next.memberEmails = normalizeEmails(patch.memberEmails);
    }
    return next;
  });
  storeState = { ...storeState, trips: updatedTrips };
  sauvegarderDonnees(false);
}

export async function setDayInfoLocal(tripId: string, date: string, patch: Omit<DayInfo, 'id'>) {
  const currentDays = storeState.daysByTrip[tripId] || {};
  const existing = currentDays[date] || { id: date };
  const updated: DayInfo = {
    ...existing,
    ...patch,
    id: date,
  };
  storeState = {
    ...storeState,
    daysByTrip: {
      ...storeState.daysByTrip,
      [tripId]: { ...currentDays, [date]: updated },
    },
  };
  sauvegarderDonnees(false);
}

export function nextOrder(places: Place[], date: string | null): number {
  const same = places.filter((p) => p.date === date);
  return same.length ? Math.max(...same.map((p) => p.order)) + 1 : 0;
}

export async function addPlaceLocal(tripId: string, place: NewPlace, existing?: Place[]) {
  const currentPlaces = existing ?? storeState.placesByTrip[tripId] ?? [];
  const newPlace: Place = {
    ...place,
    id: genId('place'),
    order: place.order ?? nextOrder(currentPlaces, place.date),
    createdAt: Date.now(),
  };
  const nextList = [...currentPlaces, newPlace].sort((a, b) => a.order - b.order);
  storeState = {
    ...storeState,
    placesByTrip: { ...storeState.placesByTrip, [tripId]: nextList },
  };
  sauvegarderDonnees(false);
}

export async function addPlacesBatchLocal(tripId: string, places: NewPlace[], existing?: Place[]) {
  const currentPlaces = existing ?? storeState.placesByTrip[tripId] ?? [];
  const orders = new Map<string, number>();
  const added: Place[] = [];
  const now = Date.now();

  for (const p of places) {
    const key = p.date ?? '__ideas__';
    const start = orders.get(key) ?? nextOrder([...currentPlaces, ...added], p.date);
    orders.set(key, start + 1);
    added.push({
      ...p,
      id: genId('place'),
      order: p.order ?? start,
      createdAt: now,
    });
  }

  const nextList = [...currentPlaces, ...added].sort((a, b) => a.order - b.order);
  storeState = {
    ...storeState,
    placesByTrip: { ...storeState.placesByTrip, [tripId]: nextList },
  };
  sauvegarderDonnees(false);
}

export async function updatePlaceLocal(tripId: string, placeId: string, patch: Partial<Omit<Place, 'id'>>) {
  const currentPlaces = storeState.placesByTrip[tripId] || [];
  const nextList = currentPlaces
    .map((p) => {
      if (p.id !== placeId) return p;
      const copy: Record<string, unknown> = { ...p };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) {
          delete copy[k];
        } else {
          copy[k] = v;
        }
      }
      return copy as unknown as Place;
    })
    .sort((a, b) => a.order - b.order);

  storeState = {
    ...storeState,
    placesByTrip: { ...storeState.placesByTrip, [tripId]: nextList },
  };
  sauvegarderDonnees(false);
}

export async function deletePlaceLocal(tripId: string, placeId: string) {
  const currentPlaces = storeState.placesByTrip[tripId] || [];
  storeState = {
    ...storeState,
    placesByTrip: {
      ...storeState.placesByTrip,
      [tripId]: currentPlaces.filter((p) => p.id !== placeId),
    },
  };
  sauvegarderDonnees(false);
}

export async function swapOrderLocal(tripId: string, a: Place, b: Place) {
  const currentPlaces = storeState.placesByTrip[tripId] || [];
  const newOrderA = b.order;
  const newOrderB = a.order === b.order ? a.order + 1 : a.order;

  const nextList = currentPlaces
    .map((p) => {
      if (p.id === a.id) return { ...p, order: newOrderA };
      if (p.id === b.id) return { ...p, order: newOrderB };
      return p;
    })
    .sort((a, b) => a.order - b.order);

  storeState = {
    ...storeState,
    placesByTrip: { ...storeState.placesByTrip, [tripId]: nextList },
  };
  sauvegarderDonnees(false);
}

export async function addJournalEntryLocal(tripId: string, entry: NewJournalEntry) {
  const currentJournal = storeState.journalByTrip[tripId] || [];
  const now = Date.now();
  const newEntry: JournalEntry = {
    ...entry,
    id: genId('journal'),
    createdAt: now,
    updatedAt: now,
  };
  const nextList = [newEntry, ...currentJournal].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt,
  );
  storeState = {
    ...storeState,
    journalByTrip: { ...storeState.journalByTrip, [tripId]: nextList },
  };
  sauvegarderDonnees(false);
}

export async function updateJournalEntryLocal(
  tripId: string,
  entryId: string,
  patch: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>,
) {
  const currentJournal = storeState.journalByTrip[tripId] || [];
  const nextList = currentJournal
    .map((j) => {
      if (j.id !== entryId) return j;
      const copy: Record<string, unknown> = { ...j, updatedAt: Date.now() };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) {
          delete copy[k];
        } else {
          copy[k] = v;
        }
      }
      return copy as unknown as JournalEntry;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  storeState = {
    ...storeState,
    journalByTrip: { ...storeState.journalByTrip, [tripId]: nextList },
  };
  sauvegarderDonnees(false);
}

export async function deleteJournalEntryLocal(tripId: string, entryId: string) {
  const currentJournal = storeState.journalByTrip[tripId] || [];
  storeState = {
    ...storeState,
    journalByTrip: {
      ...storeState.journalByTrip,
      [tripId]: currentJournal.filter((j) => j.id !== entryId),
    },
  };
  sauvegarderDonnees(false);
}
