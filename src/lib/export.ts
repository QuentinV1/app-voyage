import * as XLSX from 'xlsx';
import { CATEGORIES } from './categories';
import type { DayInfo, JournalEntry, JournalMood, Place, Trip } from './types';

const MOOD_LABELS: Record<JournalMood, string> = {
  amazing: 'Inoubliable',
  happy: 'Super',
  chill: 'Détente',
  tired: 'Fatiguant',
  food: 'Gourmand',
};

function safeFilename(name: string): string {
  return name.replace(/[^\w-]+/g, '_') || 'voyage';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sortPlaces(places: Place[]): Place[] {
  return [...places].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.order - b.order);
}

export function exportTripCsv(
  trip: Trip,
  places: Place[],
  days: Record<string, DayInfo>,
  dayIndex: (date: string | null) => number,
) {
  const rows = [
    [
      'Jour',
      'Date',
      'Titre du jour',
      'Ville du jour',
      'Heure',
      'Lieu',
      'Catégorie',
      'Adresse',
      'Latitude',
      'Longitude',
      'Notes',
      'Lien Google Maps',
      'Ajouté par',
    ],
  ];

  for (const p of sortPlaces(places)) {
    const i = dayIndex(p.date);
    const d = p.date ? days[p.date] : undefined;
    rows.push([
      i >= 0 ? String(i + 1) : 'Idée',
      p.date ?? '',
      d?.title ?? '',
      d?.city ?? p.city ?? '',
      p.time ?? '',
      p.name,
      CATEGORIES[p.category]?.label ?? '',
      p.address ?? '',
      p.lat != null ? String(p.lat) : '',
      p.lng != null ? String(p.lng) : '',
      p.notes ?? '',
      p.googleMapsUri ?? '',
      p.addedBy ?? '',
    ]);
  }

  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${safeFilename(trip.name)}.csv`);
}

export function exportTripExcel(
  trip: Trip,
  places: Place[],
  days: Record<string, DayInfo>,
  journal: JournalEntry[],
  dayIndex: (date: string | null) => number,
) {
  const wb = XLSX.utils.book_new();

  const sorted = sortPlaces(places);
  const scheduled = sorted.filter((p) => dayIndex(p.date) >= 0);
  const ideas = sorted.filter((p) => dayIndex(p.date) < 0);

  const planningRows = scheduled.map((p) => {
    const i = dayIndex(p.date);
    const d = p.date ? days[p.date] : undefined;
    return {
      Jour: `J${i + 1}`,
      Date: p.date ?? '',
      'Titre du jour': d?.title ?? '',
      Ville: d?.city ?? p.city ?? '',
      Heure: p.time ?? '',
      Lieu: p.name,
      Catégorie: CATEGORIES[p.category]?.label ?? '',
      Adresse: p.address ?? '',
      Latitude: p.lat ?? '',
      Longitude: p.lng ?? '',
      Notes: p.notes ?? '',
      'Google Maps': p.googleMapsUri ?? '',
      'Ajouté par': p.addedBy ?? '',
    };
  });

  const ideaRows = ideas.map((p) => ({
    Lieu: p.name,
    Catégorie: CATEGORIES[p.category]?.label ?? '',
    Ville: p.city ?? '',
    Adresse: p.address ?? '',
    Notes: p.notes ?? '',
    'Google Maps': p.googleMapsUri ?? '',
    'Ajouté par': p.addedBy ?? '',
  }));

  const journalSorted = [...journal].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const journalRows = journalSorted.map((j) => {
    const i = dayIndex(j.date);
    return {
      Jour: i >= 0 ? `J${i + 1}` : '',
      Date: j.date,
      Titre: j.title ?? '',
      Lieu: j.location ?? '',
      Humeur: j.mood ? MOOD_LABELS[j.mood] : '',
      Récit: j.content,
      'Nb photos': j.photos?.length ?? 0,
      Auteur: j.authorName || j.authorEmail || '',
    };
  });

  const wsPlanning = XLSX.utils.json_to_sheet(
    planningRows.length ? planningRows : [{ Info: 'Aucun lieu planifié pour le moment' }],
  );
  const wsIdeas = XLSX.utils.json_to_sheet(ideaRows.length ? ideaRows : [{ Info: 'Aucune idée enregistrée' }]);
  const wsJournal = XLSX.utils.json_to_sheet(
    journalRows.length ? journalRows : [{ Info: 'Aucune entrée dans le carnet de voyage' }],
  );

  XLSX.utils.book_append_sheet(wb, wsPlanning, 'Planning');
  XLSX.utils.book_append_sheet(wb, wsIdeas, 'Idées');
  XLSX.utils.book_append_sheet(wb, wsJournal, 'Carnet');

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, `${safeFilename(trip.name)}.xlsx`);
}
