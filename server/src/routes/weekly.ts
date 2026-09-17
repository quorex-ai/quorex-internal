import { Router } from 'express';
import {
  weeklyReportSchema,
  type JournalEntityType,
  type WeeklyLateItem,
  type WeeklyReport,
  type WeeklySummaryItem,
} from '@quorex/shared';
import type { Db } from '../db.js';
import { ApiError, parseBody } from '../errors.js';
import { currentUser } from '../auth/middleware.js';
import { mondayOf, nowIso, shiftIsoDate, todayIso } from '../lib/time.js';
import { uuidv7 } from '../lib/uuid.js';

interface SummaryRow {
  entity_type: JournalEntityType;
  entity_id: string;
  label: string;
  old_value: string | null;
  new_value: string | null;
  at: string;
  actor_name: string | null;
}

interface ReportRow {
  closed_text: string;
  in_progress_text: string;
  blocked_text: string;
  author_name: string | null;
  updated_at: string;
}

/** Bornes d'une semaine locale, exprimees en instants ISO pour le journal. */
function weekBounds(weekStart: string): { from: string; to: string } {
  const [year, month, day] = weekStart.split('-').map(Number);
  const start = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
  const end = new Date(start.getTime());
  end.setDate(end.getDate() + 7);
  return { from: start.toISOString(), to: end.toISOString() };
}

const SUMMARY_QUERY = `
  SELECT
    j.entity_type, j.entity_id, j.old_value, j.new_value, j.at,
    u.display_name AS actor_name,
    COALESCE(
      m.title, t.title,
      (SELECT jj.new_value FROM journal jj WHERE jj.entity_id = j.entity_id AND jj.field = 'created' LIMIT 1),
      '(supprimé)'
    ) AS label
  FROM journal j
  LEFT JOIN users u ON u.id = j.actor_id
  LEFT JOIN milestones m ON j.entity_type = 'milestone' AND m.id = j.entity_id
  LEFT JOIN tasks t ON j.entity_type = 'task' AND t.id = j.entity_id
  WHERE j.entity_type = ? AND j.field = ? AND j.at >= ? AND j.at < ?
`;

export function createWeeklyRouter(db: Db): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const weekStart = normalizeWeek(req.query.week);
    res.json({ weekly: buildReport(db, weekStart) });
  });

  router.put('/:weekStart', (req, res) => {
    const weekStart = normalizeWeek(req.params.weekStart);
    const input = parseBody(weeklyReportSchema, req.body);
    const actor = currentUser(req);
    const at = nowIso();

    // Le compte rendu est saisi a la main : une ligne par semaine, mise a jour en place.
    db.prepare(
      `INSERT INTO weekly_reports (id, week_start, closed_text, in_progress_text, blocked_text, author_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(week_start) DO UPDATE SET
         closed_text = excluded.closed_text,
         in_progress_text = excluded.in_progress_text,
         blocked_text = excluded.blocked_text,
         author_id = excluded.author_id,
         updated_at = excluded.updated_at`,
    ).run(
      uuidv7(),
      weekStart,
      input.closedText,
      input.inProgressText,
      input.blockedText,
      actor.id,
      at,
      at,
    );

    res.json({ weekly: buildReport(db, weekStart) });
  });

  return router;
}

function buildReport(db: Db, weekStart: string): WeeklyReport {
  const { from, to } = weekBounds(weekStart);

  const query = (entityType: JournalEntityType, field: string, value?: string): WeeklySummaryItem[] =>
    db
      .prepare<string[], SummaryRow>(`${SUMMARY_QUERY} ORDER BY j.at ASC`)
      .all(entityType, field, from, to)
      .filter((row) => (value === undefined ? true : row.new_value === value))
      .map((row) => ({
        entityType: row.entity_type,
        entityId: row.entity_id,
        label: row.label,
        detail:
          row.old_value === null && row.new_value === null
            ? null
            : `${row.old_value ?? '—'} → ${row.new_value ?? '—'}`,
        at: row.at,
        actorName: row.actor_name,
      }));

  const today = todayIso();
  const late: WeeklyLateItem[] = db
    .prepare<[string], { id: string; title: string; target_date: string }>(
      `SELECT id, title, target_date FROM milestones
       WHERE target_date IS NOT NULL AND status <> 'closed' AND target_date < ?
       ORDER BY target_date ASC`,
    )
    .all(today)
    .map((row) => ({
      id: row.id,
      title: row.title,
      targetDate: row.target_date,
      daysLate: Math.round(
        (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${row.target_date}T00:00:00Z`)) /
          (24 * 60 * 60 * 1000),
      ),
    }));

  const report = db
    .prepare<[string], ReportRow>(
      `SELECT w.closed_text, w.in_progress_text, w.blocked_text, w.updated_at, u.display_name AS author_name
       FROM weekly_reports w
       LEFT JOIN users u ON u.id = w.author_id
       WHERE w.week_start = ?`,
    )
    .get(weekStart);

  return {
    weekStart,
    weekEnd: shiftIsoDate(weekStart, 6),
    summary: {
      milestonesClosed: query('milestone', 'status', 'closed'),
      tasksDone: query('task', 'status', 'done'),
      tasksStarted: query('task', 'status', 'in_progress'),
      datesChanged: query('milestone', 'target_date'),
      late,
    },
    report: report
      ? {
          closedText: report.closed_text,
          inProgressText: report.in_progress_text,
          blockedText: report.blocked_text,
          authorName: report.author_name,
          updatedAt: report.updated_at,
        }
      : null,
  };
}

/** Une semaine est toujours designee par son lundi. */
function normalizeWeek(value: unknown): string {
  if (typeof value !== 'string' || value === '') return mondayOf();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw ApiError.badRequest('Semaine attendue au format AAAA-MM-JJ.');

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest('Semaine inexistante.');

  return mondayOf(date);
}
