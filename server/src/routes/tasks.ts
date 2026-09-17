import { Router } from 'express';
import { taskCreateSchema, taskMoveSchema, taskUpdateSchema } from '@quorex/shared';
import type { Db } from '../db.js';
import { ApiError, parseBody } from '../errors.js';
import { currentUser } from '../auth/middleware.js';
import { created, deleted, diff, record, recordChanges } from '../journal.js';
import { getMilestone } from '../data/milestones.js';
import {
  deleteTask,
  getTask,
  getTaskFields,
  insertTask,
  listTasks,
  moveTasks,
  updateTaskFields,
} from '../data/tasks.js';

const TASK_FIELDS = ['milestone_id', 'title', 'assignee_id', 'status', 'external_url'] as const;

export function createTasksRouter(db: Db): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const milestoneId = typeof req.query.milestoneId === 'string' ? req.query.milestoneId : undefined;
    const assigneeId = typeof req.query.assigneeId === 'string' ? req.query.assigneeId : undefined;

    res.json({
      tasks: listTasks(db, {
        ...(milestoneId ? { milestoneId } : {}),
        ...(assigneeId ? { assigneeId } : {}),
      }),
    });
  });

  router.post('/', (req, res) => {
    const input = parseBody(taskCreateSchema, req.body);
    const actor = currentUser(req);

    // milestone_id est non null : une tache appartient toujours a un jalon.
    if (!getMilestone(db, input.milestoneId)) {
      throw ApiError.badRequest('Jalon inconnu.', [{ field: 'milestoneId', message: 'Jalon introuvable' }]);
    }
    assertKnownAssignee(db, input.assigneeId);

    const id = insertTask(db, input);
    record(db, { entityType: 'task', entityId: id, actorId: actor.id }, created(input.title));

    res.status(201).json({ task: getTask(db, id) });
  });

  router.patch('/:id', (req, res) => {
    const task = getTask(db, req.params.id ?? '');
    if (!task) throw ApiError.notFound('Tâche introuvable.');

    const input = parseBody(taskUpdateSchema, req.body);
    const actor = currentUser(req);

    if (input.milestoneId !== undefined && !getMilestone(db, input.milestoneId)) {
      throw ApiError.badRequest('Jalon inconnu.', [{ field: 'milestoneId', message: 'Jalon introuvable' }]);
    }
    if ('assigneeId' in input) assertKnownAssignee(db, input.assigneeId ?? null);

    const before = getTaskFields(db, task.id);
    if (!before) throw ApiError.notFound('Tâche introuvable.');

    const after = {
      ...('milestoneId' in input ? { milestone_id: input.milestoneId } : {}),
      ...('title' in input ? { title: input.title } : {}),
      ...('assigneeId' in input ? { assignee_id: input.assigneeId } : {}),
      ...('status' in input ? { status: input.status } : {}),
      ...('externalUrl' in input ? { external_url: input.externalUrl } : {}),
    };

    updateTaskFields(db, task.id, after);
    recordChanges(
      db,
      { entityType: 'task', entityId: task.id, actorId: actor.id },
      diff(before, after, TASK_FIELDS),
    );

    res.json({ task: getTask(db, task.id) });
  });

  router.post('/move', (req, res) => {
    const input = parseBody(taskMoveSchema, req.body);
    const actor = currentUser(req);

    const before = new Map(
      input.ids.map((id) => {
        const task = getTask(db, id);
        if (!task) throw ApiError.badRequest(`Tâche inconnue : ${id}`);
        return [id, task.status];
      }),
    );

    moveTasks(db, input.status, input.ids);

    // Seul le changement de colonne est une information ; l'ordre interne ne l'est pas.
    for (const [id, previous] of before) {
      if (previous === input.status) continue;
      record(
        db,
        { entityType: 'task', entityId: id, actorId: actor.id },
        { field: 'status', oldValue: previous, newValue: input.status },
      );
    }

    res.json({ tasks: listTasks(db) });
  });

  router.delete('/:id', (req, res) => {
    const task = getTask(db, req.params.id ?? '');
    if (!task) throw ApiError.notFound('Tâche introuvable.');

    const actor = currentUser(req);
    deleteTask(db, task.id);
    record(db, { entityType: 'task', entityId: task.id, actorId: actor.id }, deleted(task.title));

    res.status(204).end();
  });

  return router;
}

function assertKnownAssignee(db: Db, assigneeId: string | null): void {
  if (assigneeId === null) return;

  const user = db.prepare<[string], { id: string }>('SELECT id FROM users WHERE id = ?').get(assigneeId);
  if (!user) {
    throw ApiError.badRequest('Compte inconnu.', [{ field: 'assigneeId', message: 'Compte introuvable' }]);
  }
}
