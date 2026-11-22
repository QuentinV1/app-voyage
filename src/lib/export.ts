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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface DayGroup {
  dayNum: number;
  date: string;
  info?: DayInfo;
  places: Place[];
}

function groupPlacesForWanderlog(
  places: Place[],
  days: Record<string, DayInfo>,
  dayIndex: (date: string | null) => number,
): { dayGroups: DayGroup[]; ideas: Place[] } {
  const sorted = sortPlaces(places);
  const byDate = new Map<string, DayGroup>();
  const ideas: Place[] = [];

  for (const p of sorted) {
    const idx = dayIndex(p.date);
    if (idx >= 0 && p.date) {
      const existing = byDate.get(p.date);
      if (existing) {
        existing.places.push(p);
      } else {
        byDate.set(p.date, {
          dayNum: idx + 1,
          date: p.date,
          info: days[p.date],
          places: [p],
        });
      }
    } else {
      ideas.push(p);
    }
  }

  return { dayGroups: [...byDate.values()], ideas };
}

function formatPlaceTextLine(p: Place): string {
  const parts: string[] = [];
  if (p.time) parts.push(p.time);
  parts.push(p.name);
  const loc = p.address || p.city;
  if (loc) parts.push(`(${loc})`);
  const main = `- ${parts.join(' — ')}`;
  const extra: string[] = [];
  if (p.notes) extra.push(`  Note : ${p.notes.replace(/\s+/g, ' ').trim()}`);
  if (p.googleMapsUri) extra.push(`  ${p.googleMapsUri}`);
  return [main, ...extra].join('\n');
}

/** Génère un texte structuré prêt à coller dans Wanderlog (« Import from anywhere » / IA) */
export function buildWanderlogText(
  trip: Trip,
  places: Place[],
  days: Record<string, DayInfo>,
  dayIndex: (date: string | null) => number,
): string {
  const { dayGroups, ideas } = groupPlacesForWanderlog(places, days, dayIndex);
  const lines: string[] = [`${trip.name} (${trip.startDate} → ${trip.endDate})`, ''];

  for (const g of dayGroups) {
    const meta = [g.info?.title, g.info?.city].filter(Boolean).join(' · ');
    lines.push(`Day ${g.dayNum} - ${g.date}${meta ? ` : ${meta}` : ''}`);
    for (const p of g.places) {
      lines.push(formatPlaceTextLine(p));
    }
    lines.push('');
  }

  if (ideas.length > 0) {
    lines.push('Saved places / Idées à placer :');
    for (const p of ideas) {
      lines.push(formatPlaceTextLine(p));
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function exportWanderlogTextFile(
  trip: Trip,
  places: Place[],
  days: Record<string, DayInfo>,
  dayIndex: (date: string | null) => number,
) {
  const text = buildWanderlogText(trip, places, days, dayIndex);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${safeFilename(trip.name)}_wanderlog.txt`);
}

/** Exporte une page HTML autonome lisible par l'extension Chrome Wanderlog */
export function exportWanderlogHtml(
  trip: Trip,
  places: Place[],
  days: Record<string, DayInfo>,
  dayIndex: (date: string | null) => number,
) {
  const { dayGroups, ideas } = groupPlacesForWanderlog(places, days, dayIndex);

  const renderPlaceHtml = (p: Place) => {
    const title = p.googleMapsUri
      ? `<a href="${escapeHtml(p.googleMapsUri)}" target="_blank" rel="noopener noreferrer">${escapeHtml(p.name)}</a>`
      : `<strong>${escapeHtml(p.name)}</strong>`;
    const meta = [p.time, CATEGORIES[p.category]?.label, p.address || p.city]
      .filter((v): v is string => Boolean(v))
      .map(escapeHtml)
      .join(' · ');
    const notes = p.notes ? `<div class="notes">${escapeHtml(p.notes)}</div>` : '';
    return `<li><div class="place">${title}${meta ? ` <span class="meta">(${meta})</span>` : ''}</div>${notes}</li>`;
  };

  const daysHtml = dayGroups
    .map((g) => {
      const meta = [g.info?.title, g.info?.city].filter(Boolean).join(' — ');
      return `<section>
        <h2>Day ${g.dayNum} · ${escapeHtml(g.date)}${meta ? ` — ${escapeHtml(meta)}` : ''}</h2>
        <ul>${g.places.map(renderPlaceHtml).join('')}</ul>
      </section>`;
    })
    .join('');

  const ideasHtml =
    ideas.length > 0
      ? `<section>
          <h2>Idées à placer</h2>
          <ul>${ideas.map(renderPlaceHtml).join('')}</ul>
        </section>`
      : '';

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(trip.name)} — Export Wanderlog</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 780px; margin: 2rem auto; padding: 0 1rem; color: #1e293b; line-height: 1.5; }
    h1 { margin-bottom: 0.25rem; }
    .dates { color: #64748b; margin-top: 0; }
    section { margin-top: 1.75rem; }
    h2 { font-size: 1.1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.35rem; color: #0f172a; }
    ul { padding-left: 1.25rem; }
    li { margin-bottom: 0.65rem; }
    a { color: #e11d48; font-weight: 600; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .meta { color: #64748b; font-size: 0.9em; }
    .notes { color: #475569; font-size: 0.9em; margin-top: 0.15rem; }
  </style>
</head>
<body>
  <h1>${escapeHtml(trip.name)}</h1>
  <p class="dates">${escapeHtml(trip.startDate)} → ${escapeHtml(trip.endDate)}</p>
  ${daysHtml}
  ${ideasHtml}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  downloadBlob(blob, `${safeFilename(trip.name)}_wanderlog.html`);
}

function serializePlaceForJson(p: Place) {
  return {
    type: 'place',
    time: p.time,
    notes: p.notes,
    place: {
      name: p.name,
      category: p.category,
      city: p.city,
      address: p.address,
      lat: p.lat,
      lng: p.lng,
      googlePlaceId: p.googlePlaceId,
      googleMapsUri: p.googleMapsUri,
    },
  };
}

/** Exporte un JSON structuré compatible Wanderlog (sections/blocks/ideas) et réimportable dans l'app */
export function exportWanderlogJson(
  trip: Trip,
  places: Place[],
  days: Record<string, DayInfo>,
  dayIndex: (date: string | null) => number,
) {
  const { dayGroups, ideas } = groupPlacesForWanderlog(places, days, dayIndex);
  const payload = {
    trip: {
      name: trip.name,
      startDate: trip.startDate,
      endDate: trip.endDate,
    },
    sections: dayGroups.map((g) => ({
      dayNumber: g.dayNum,
      date: g.date,
      heading: g.info?.title,
      city: g.info?.city,
      blocks: g.places.map(serializePlaceForJson),
    })),
    ideas: ideas.map((p) => serializePlaceForJson(p).place),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `${safeFilename(trip.name)}_wanderlog.json`);
}
