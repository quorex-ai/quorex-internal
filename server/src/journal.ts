import type { JournalEntityType } from '@quorex/shared';
import type { Db } from './db.js';
import { uuidv7 } from './lib/uuid.js';
import { nowIso } from './lib/time.js';

export interface Change {
  field: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface JournalTarget {
  entityType: JournalEntityType;
  entityId: string;
  actorId: string | null;
}

/**
 * Le journal est ecrit ici et nulle part ailleurs : chaque mutation de l'API
 * passe par record() ou recordChanges(), jamais par le client.
 */
export function recordChanges(db: Db, target: JournalTarget, changes: Change[], at: string = nowIso()): void {
  if (changes.length === 0) return;

  const insert = db.prepare(
    `INSERT INTO journal (id, entity_type, entity_id, field, old_value, new_value, actor_id, at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const change of changes) {
    insert.run(
      uuidv7(),
      target.entityType,
      target.entityId,
      change.field,
      change.oldValue,
      change.newValue,
      target.actorId,
      at,
      at,
      at,
    );
  }
}

export function record(db: Db, target: JournalTarget, change: Change, at?: string): void {
  recordChanges(db, target, [change], at);
}

/** Champ conventionnel pose a la creation d'une entite : le libelle sert de trace. */
export function created(label: string): Change {
  return { field: 'created', oldValue: null, newValue: label };
}

/** Champ conventionnel pose a la suppression : le libelle survit a la ligne effacee. */
export function deleted(label: string): Change {
  return { field: 'deleted', oldValue: label, newValue: null };
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? '1' : '0';
  return String(value);
}

/**
 * Compare deux etats d'une entite et rend une ligne de journal par champ modifie.
 * Les champs absents de `after` ne sont pas compares : une mise a jour partielle
 * ne produit pas de fausse trace.
 */
export function diff<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: readonly (keyof T & string)[],
): Change[] {
  const changes: Change[] = [];

  for (const field of fields) {
    if (!(field in after)) continue;

    const oldValue = asText(before[field]);
    const newValue = asText(after[field]);
    if (oldValue === newValue) continue;

    changes.push({ field, oldValue, newValue });
  }

  return changes;
}
