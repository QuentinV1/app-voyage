/** Utilitaires de dates au format YYYY-MM-DD (sans souci de fuseau horaire) */

function parse(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function listDates(start: string, end: string): string[] {
  if (!start || !end) return [];
  const out: string[] = [];
  const cur = parse(start);
  const last = parse(end);
  let guard = 0;
  while (cur <= last && guard < 120) {
    out.push(toIso(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
    guard++;
  }
  return out;
}

export function formatDay(date: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return parse(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    ...opts,
  });
}

export function formatShort(date: string): string {
  return parse(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function daysUntil(date: string): number {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parse(date).getTime() - today) / 86_400_000);
}
