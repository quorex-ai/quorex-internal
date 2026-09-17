import { Router } from 'express';
import { JOURNAL_ENTITY_TYPES, type JournalEntityType, type JournalEntry } from '@quorex/shared';
import type { Db } from '../db.js';

interface JournalRow {
  id: string;
  entity_type: JournalEntityType;
  entity_id: string;
  entity_label: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  actor_id: string | null;
  actor_name: string | null;
  at: string;
}

/**
 * Le libelle de l'entite est resolu depuis la table concernee ; si la ligne a
 * ete supprimee, on retombe sur le libelle note a la creation.
 */
const SELECT_JOURNAL = `
  SELECT
    j.id, j.entity_type, j.entity_id, j.field, j.old_value, j.new_value, j.actor_id, j.at,
    u.display_name AS actor_name,
    COALESCE(
      m.title, t.title, c.label, d.title,
      (SELECT jj.new_value FROM journal jj
        WHERE jj.entity_id = j.entity_id AND jj.field = 'created' LIMIT 1),
      '(supprimé)'
    ) AS entity_label
  FROM journal j
  LEFT JOIN users u ON u.id = j.actor_id
  LEFT JOIN milestones m ON j.entity_type = 'milestone' AND m.id = j.entity_id
  LEFT JOIN tasks t ON j.entity_type = 'task' AND t.id = j.entity_id
  LEFT JOIN acceptance_criteria c ON j.entity_type = 'criterion' AND c.id = j.entity_id
  LEFT JOIN documents d ON j.entity_type = 'document' AND d.id = j.entity_id
`;

const PAGE_SIZE = 50;

export function createJournalRouter(db: Db): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const conditions: string[] = [];
    const parameters: string[] = [];

    const entityType = req.query.entityType;
    if (typeof entityType === 'string' && isEntityType(entityType)) {
      conditions.push('j.entity_type = ?');
      parameters.push(entityType);
    }

    const actorId = req.query.actorId;
    if (typeof actorId === 'string' && actorId) {
      if (actorId === 'system') {
        conditions.push('j.actor_id IS NULL');
      } else {
        conditions.push('j.actor_id = ?');
        parameters.push(actorId);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const total =
      db
        .prepare<string[], { count: number }>(`SELECT COUNT(*) AS count FROM journal j ${where}`)
        .get(...parameters)?.count ?? 0;

    const rows = db
      .prepare<string[], JournalRow>(
        `${SELECT_JOURNAL} ${where} ORDER BY j.at DESC, j.id DESC LIMIT ? OFFSET ?`,
      )
      .all(...parameters, String(PAGE_SIZE), String(offset));

    const entries: JournalEntry[] = rows.map((row) => ({
      id: row.id,
      entityType: row.entity_type,
      entityId: row.entity_id,
      entityLabel: row.entity_label,
      field: row.field,
      oldValue: row.old_value,
      newValue: row.new_value,
      actorId: row.actor_id,
      actorName: row.actor_name,
      at: row.at,
    }));

    res.json({ entries, total, page, pageSize: PAGE_SIZE });
  });

  return router;
}

function isEntityType(value: string): value is JournalEntityType {
  return (JOURNAL_ENTITY_TYPES as readonly string[]).includes(value);
}
