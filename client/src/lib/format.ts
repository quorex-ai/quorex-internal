const longDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

/** « Jeudi 20 février », comme la ligne de date de la reference. */
export function formatLongDate(date: Date = new Date()): string {
  return capitalize(longDate.format(date));
}

/** « Bonjour », « Bon apres-midi » ou « Bonsoir » selon l'heure. */
export function greeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Bonjour';
  if (hour < 18) return 'Bon après-midi';
  return 'Bonsoir';
}

/** Initiales d'un nom affiche, pour les avatars sans image. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const shortDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const dateTime = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** « 2026-03-31 » vers une date locale sans decalage de fuseau. */
export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function formatIsoDate(iso: string): string {
  return shortDate.format(parseIsoDate(iso));
}

export function formatShortDate(iso: string): string {
  return dayMonth.format(parseIsoDate(iso));
}

export function formatDateTime(isoInstant: string): string {
  return dateTime.format(new Date(isoInstant));
}

/** Nombre de jours entiers entre aujourd'hui et une date AAAA-MM-JJ. */
export function daysUntil(iso: string, from: Date = new Date()): number {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const target = parseIsoDate(iso);
  return Math.round((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

export function todayIso(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
