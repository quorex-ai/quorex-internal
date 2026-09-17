import type { Task, TaskStatus } from '@quorex/shared';
import type { Db } from '../db.js';
import { nowIso } from '../lib/time.js';
import { uuidv7 } from '../lib/uuid.js';

interface TaskRow {
  id: string;
  milestone_id: string;
  milestone_title: string;
  title: string;
  assignee_id: string | null;
  assignee_name: string | null;
  status: TaskStatus;
  external_url: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

const SELECT_TASK = `
  SELECT
    t.id, t.milestone_id, t.title, t.assignee_id, t.status, t.external_url, t.position,
    t.created_at, t.updated_at,
    m.title AS milestone_title,
    u.display_name AS assignee_name
  FROM tasks t
  JOIN milestones m ON m.id = t.milestone_id
  LEFT JOIN users u ON u.id = t.assignee_id
`;

function toTask(row: TaskRow): Task {
  return {
    id: row.id,
    milestoneId: row.milestone_id,
    milestoneTitle: row.milestone_title,
    title: row.title,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    status: row.status,
    externalUrl: row.external_url,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ORDER = 'ORDER BY t.status ASC, t.position ASC, t.created_at ASC';

export function listTasks(db: Db, filters: { milestoneId?: string; assigneeId?: string } = {}): Task[] {
  const conditions: string[] = [];
  const parameters: string[] = [];

  if (filters.milestoneId) {
    conditions.push('t.milestone_id = ?');
    parameters.push(filters.milestoneId);
  }
  if (filters.assigneeId) {
    conditions.push('t.assignee_id = ?');
    parameters.push(filters.assigneeId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return db
    .prepare<string[], TaskRow>(`${SELECT_TASK} ${where} ${ORDER}`)
    .all(...parameters)
    .map(toTask);
}

export function listTasksOfMilestone(db: Db, milestoneId: string): Task[] {
  return listTasks(db, { milestoneId });
}

export function getTask(db: Db, id: string): Task | undefined {
  const row = db.prepare<[string], TaskRow>(`${SELECT_TASK} WHERE t.id = ?`).get(id);
  return row ? toTask(row) : undefined;
}

export interface TaskWritableFields extends Record<string, unknown> {
  milestone_id: string;
  title: string;
  assignee_id: string | null;
  status: TaskStatus;
  external_url: string | null;
}

export function getTaskFields(db: Db, id: string): TaskWritableFields | undefined {
  return db
    .prepare<[string], TaskWritableFields>(
      'SELECT milestone_id, title, assignee_id, status, external_url FROM tasks WHERE id = ?',
    )
    .get(id);
}

export function insertTask(
  db: Db,
  values: {
    milestoneId: string;
    title: string;
    assigneeId: string | null;
    status: TaskStatus;
    externalUrl: string | null;
  },
): string {
  const id = uuidv7();
  const at = nowIso();
  const position = nextPosition(db, values.status);

  db.prepare(
    `INSERT INTO tasks (id, milestone_id, title, assignee_id, status, external_url, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    values.milestoneId,
    values.title,
    values.assigneeId,
    values.status,
    values.externalUrl,
    position,
    at,
    at,
  );

  return id;
}

export function updateTaskFields(db: Db, id: string, values: Partial<TaskWritableFields>): void {
  const columns = Object.keys(values);
  if (columns.length === 0) return;

  const assignments = columns.map((column) => `${column} = ?`).join(', ');
  const parameters = columns.map((column) => values[column] as string | null);

  db.prepare(`UPDATE tasks SET ${assignments}, updated_at = ? WHERE id = ?`).run(...parameters, nowIso(), id);
}

export function deleteTask(db: Db, id: string): void {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
}

/** Pose la colonne et l'ordre complet de cette colonne, en une transaction. */
export function moveTasks(db: Db, status: TaskStatus, ids: string[]): void {
  const at = nowIso();
  const update = db.prepare('UPDATE tasks SET status = ?, position = ?, updated_at = ? WHERE id = ?');
  const apply = db.transaction(() => {
    ids.forEach((id, index) => update.run(status, index, at, id));
  });
  apply();
}

function nextPosition(db: Db, status: TaskStatus): number {
  const row = db
    .prepare<[TaskStatus], { next: number | null }>(
      'SELECT MAX(position) + 1 AS next FROM tasks WHERE status = ?',
    )
    .get(status);
  return row?.next ?? 0;
}
