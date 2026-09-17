/**
 * Couleur pastel propre a chaque jalon, derivee de son identifiant : elle est
 * donc stable dans le temps et identique partout ou le jalon apparait
 * (barre laterale, barre verticale des listes, pastilles).
 */
const MILESTONE_COLORS = [
  '#C8A2F3',
  '#A8D8B9',
  '#F5C6EC',
  '#BFD4FF',
  '#F7D08A',
  '#9FD8E8',
  '#F2A9A0',
] as const;

export function milestoneColor(id: string): string {
  let sum = 0;
  for (const char of id) sum = (sum * 31 + (char.codePointAt(0) ?? 0)) % 100003;
  return MILESTONE_COLORS[sum % MILESTONE_COLORS.length]!;
}
