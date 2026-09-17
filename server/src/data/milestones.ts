import type { Criterion, Milestone, MilestoneStatus } from '@quorex/shared';
import type { Db } from '../db.js';
import { nowIso, todayIso } from '../lib/time.js';
import { uuidv7 } from '../lib/uuid.js';

interface MilestoneRow {
  id: string;
  title: string;
  description: string;
  target_date: string | null;
  status: MilestoneStatus;
  position: number;
  criteria_total: number;
  criteria_checked: number;
  tasks_open: number;
  created_at: string;
  updated_at: string;
}

interface CriterionRow {
  id: string;
  milestone_id: string;
  label: string;
  checked: number;
  checked_at: string | null;
  checked_by: string | null;
}

const SELECT_MILESTONE = `
  SELECT
    m.id, m.title, m.description, m.target_date, m.status, m.position, m.created_at, m.updated_at,
    (SELECT COUNT(*) FROM acceptance_criteria c WHERE c.milestone_id = m.id) AS criteria_total,
    (SELECT COUNT(*) FROM acceptance_criteria c WHERE c.milestone_id = m.id AND c.checked = 1) AS criteria_checked,
    (SELECT COUNT(*) FROM tasks t WHERE t.milestone_id = m.id AND t.status <> 'done') AS tasks_open
  FROM milestones m
`;

function toMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    targetDate: row.target_date,
    status: row.status,
    position: row.position,
    criteriaTotal: row.criteria_total,
    criteriaChecked: row.criteria_checked,
    tasksOpen: row.tasks_open,
    // En retard : date cible depassee et jalon non ferme.
    late: row.target_date !== null && row.status !== 'closed' && row.target_date < todayIso(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toCriterion(row: CriterionRow): Criterion {
  return {
    id: row.id,
    milestoneId: row.milestone_id,
    label: row.label,
    checked: row.checked === 1,
    checkedAt: row.checked_at,
    checkedBy: row.checked_by,
  };
}

export function listMilestones(db: Db): Milestone[] {
  return db
    .prepare<[], MilestoneRow>(`${SELECT_MILESTONE} ORDER BY m.position ASC, m.created_at ASC`)
    .all()
    .map(toMilestone);
}

export function getMilestone(db: Db, id: string): Milestone | undefined {
  const row = db.prepare<[string], MilestoneRow>(`${SELECT_MILESTONE} WHERE m.id = ?`).get(id);
  return row ? toMilestone(row) : undefined;
}

export interface MilestoneWritableFields extends Record<string, unknown> {
  title: string;
  description: string;
  target_date: string | null;
  status: MilestoneStatus;
}

export function getMilestoneFields(db: Db, id: string): MilestoneWritableFields | undefined {
  return db
    .prepare<[string], MilestoneWritableFields>(
      'SELECT title, description, target_date, status FROM milestones WHERE id = ?',
    )
    .get(id);
}

export function insertMilestone(
  db: Db,
  values: { title: string; description: string; targetDate: string | null; status: MilestoneStatus },
): string {
  const id = uuidv7();
  const at = nowIso();
  const next = nextPosition(db);

  db.prepare(
    `INSERT INTO milestones (id, title, description, target_date, status, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, values.title, values.description, values.targetDate, values.status, next, at, at);

  return id;
}

export function updateMilestoneFields(db: Db, id: string, values: Partial<MilestoneWritableFields>): void {
  const columns = Object.keys(values);
  if (columns.length === 0) return;

  const assignments = columns.map((column) => `${column} = ?`).join(', ');
  const parameters = columns.map((column) => values[column] as string | null);

  db.prepare(`UPDATE milestones SET ${assignments}, updated_at = ? WHERE id = ?`).run(
    ...parameters,
    nowIso(),
    id,
  );
}

export function deleteMilestone(db: Db, id: string): void {
  db.prepare('DELETE FROM milestones WHERE id = ?').run(id);
}

export function reorderMilestones(db: Db, ids: string[]): void {
  const update = db.prepare('UPDATE milestones SET position = ?, updated_at = ? WHERE id = ?');
  const at = nowIso();
  const apply = db.transaction(() => {
    ids.forEach((id, index) => update.run(index, at, id));
  });
  apply();
}

function nextPosition(db: Db): number {
  const row = db
    .prepare<[], { next: number | null }>('SELECT MAX(position) + 1 AS next FROM milestones')
    .get();
  return row?.next ?? 0;
}

/* --------------------------------------------------- criteres d'acceptation */

export function listCriteria(db: Db, milestoneId: string): Criterion[] {
  return db
    .prepare<[string], CriterionRow>(
      `SELECT id, milestone_id, label, checked, checked_at, checked_by
       FROM acceptance_criteria WHERE milestone_id = ? ORDER BY created_at ASC`,
    )
    .all(milestoneId)
    .map(toCriterion);
}

export function getCriterion(db: Db, id: string): Criterion | undefined {
  const row = db
    .prepare<[string], CriterionRow>(
      'SELECT id, milestone_id, label, checked, checked_at, checked_by FROM acceptance_criteria WHERE id = ?',
    )
    .get(id);
  return row ? toCriterion(row) : undefined;
}

export function insertCriterion(db: Db, milestoneId: string, label: string): string {
  const id = uuidv7();
  const at = nowIso();

  db.prepare(
    `INSERT INTO acceptance_criteria (id, milestone_id, label, checked, created_at, updated_at)
     VALUES (?, ?, ?, 0, ?, ?)`,
  ).run(id, milestoneId, label, at, at);

  return id;
}

export function updateCriterion(
  db: Db,
  id: string,
  values: { label?: string; checked?: boolean; actorId: string },
): void {
  const at = nowIso();

  if (values.label !== undefined) {
    db.prepare('UPDATE acceptance_criteria SET label = ?, updated_at = ? WHERE id = ?').run(
      values.label,
      at,
      id,
    );
  }

  if (values.checked !== undefined) {
    db.prepare(
      'UPDATE acceptance_criteria SET checked = ?, checked_at = ?, checked_by = ?, updated_at = ? WHERE id = ?',
    ).run(values.checked ? 1 : 0, values.checked ? at : null, values.checked ? values.actorId : null, at, id);
  }
}

export function deleteCriterion(db: Db, id: string): void {
  db.prepare('DELETE FROM acceptance_criteria WHERE id = ?').run(id);
}

/** Critères non cochés d'un jalon : ce qui bloque sa fermeture. */
export function unmetCriteria(db: Db, milestoneId: string): Criterion[] {
  return listCriteria(db, milestoneId).filter((criterion) => !criterion.checked);
}
