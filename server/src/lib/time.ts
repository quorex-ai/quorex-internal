/** Toutes les dates stockees en base sont des ISO-8601 UTC. */
export function nowIso(date: Date = new Date()): string {
  return date.toISOString();
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Date du jour au format AAAA-MM-JJ, dans le fuseau du serveur. */
export function todayIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Lundi de la semaine d'une date, au format AAAA-MM-JJ. */
export function mondayOf(date: Date = new Date()): string {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = (copy.getDay() + 6) % 7; // 0 = lundi
  copy.setDate(copy.getDate() - weekday);
  return todayIso(copy);
}

/** Décale une date AAAA-MM-JJ d'un nombre de jours. */
export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + days);
  return todayIso(date);
}
