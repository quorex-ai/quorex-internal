import { Router } from 'express';
import {
  criterionCreateSchema,
  criterionUpdateSchema,
  milestoneCreateSchema,
  milestoneUpdateSchema,
  reorderSchema,
} from '@quorex/shared';
import type { Db } from '../db.js';
import { ApiError, parseBody } from '../errors.js';
import { currentUser } from '../auth/middleware.js';
import { created, deleted, diff, record, recordChanges } from '../journal.js';
import {
  deleteCriterion,
  getCriterion,
  getMilestone,
  getMilestoneFields,
  insertCriterion,
  insertMilestone,
  listCriteria,
  listMilestones,
  reorderMilestones,
  unmetCriteria,
  updateCriterion,
  updateMilestoneFields,
} from '../data/milestones.js';
import { listTasksOfMilestone } from '../data/tasks.js';

const MILESTONE_FIELDS = ['title', 'description', 'target_date', 'status'] as const;

export function createMilestonesRouter(db: Db): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ milestones: listMilestones(db) });
  });

  router.post('/', (req, res) => {
    const input = parseBody(milestoneCreateSchema, req.body);
    const actor = currentUser(req);

    const id = insertMilestone(db, input);
    record(db, { entityType: 'milestone', entityId: id, actorId: actor.id }, created(input.title));

    res.status(201).json({ milestone: getMilestone(db, id) });
  });

  router.get('/:id', (req, res) => {
    const milestone = requireMilestone(db, req.params.id);
    res.json({
      milestone: {
        ...milestone,
        criteria: listCriteria(db, milestone.id),
        tasks: listTasksOfMilestone(db, milestone.id),
      },
    });
  });

  router.patch('/:id', (req, res) => {
    const milestone = requireMilestone(db, req.params.id);
    const input = parseBody(milestoneUpdateSchema, req.body);
    const actor = currentUser(req);

    const before = getMilestoneFields(db, milestone.id);
    if (!before) throw ApiError.notFound('Jalon introuvable.');

    // Regle metier unique du brief : pas de fermeture avec un critere non coche.
    if (input.status === 'closed' && before.status !== 'closed') {
      const missing = unmetCriteria(db, milestone.id);
      if (missing.length > 0) {
        throw ApiError.conflict(
          "Ce jalon ne peut pas être fermé : des critères d'acceptation ne sont pas cochés.",
          { missing: missing.map((criterion) => ({ id: criterion.id, label: criterion.label })) },
        );
      }
    }

    const after = {
      ...('title' in input ? { title: input.title } : {}),
      ...('description' in input ? { description: input.description } : {}),
      ...('targetDate' in input ? { target_date: input.targetDate } : {}),
      ...('status' in input ? { status: input.status } : {}),
    };

    updateMilestoneFields(db, milestone.id, after);
    recordChanges(
      db,
      { entityType: 'milestone', entityId: milestone.id, actorId: actor.id },
      diff(before, after, MILESTONE_FIELDS),
    );

    res.json({ milestone: getMilestone(db, milestone.id) });
  });

  router.post('/reorder', (req, res) => {
    const input = parseBody(reorderSchema, req.body);
    const known = new Set(listMilestones(db).map((milestone) => milestone.id));

    for (const id of input.ids) {
      if (!known.has(id)) throw ApiError.badRequest(`Jalon inconnu dans le nouvel ordre : ${id}`);
    }

    reorderMilestones(db, input.ids);
    res.json({ milestones: listMilestones(db) });
  });

  /* ----------------------------------------------- criteres d'acceptation */

  router.post('/:id/criteria', (req, res) => {
    const milestone = requireMilestone(db, req.params.id);
    const input = parseBody(criterionCreateSchema, req.body);
    const actor = currentUser(req);

    const id = insertCriterion(db, milestone.id, input.label);
    record(db, { entityType: 'criterion', entityId: id, actorId: actor.id }, created(input.label));

    res.status(201).json({ criteria: listCriteria(db, milestone.id) });
  });

  router.patch('/criteria/:criterionId', (req, res) => {
    const criterion = getCriterion(db, req.params.criterionId ?? '');
    if (!criterion) throw ApiError.notFound('Critère introuvable.');

    const input = parseBody(criterionUpdateSchema, req.body);
    const actor = currentUser(req);

    updateCriterion(db, criterion.id, { ...input, actorId: actor.id });

    recordChanges(
      db,
      { entityType: 'criterion', entityId: criterion.id, actorId: actor.id },
      diff(
        { label: criterion.label, checked: criterion.checked },
        {
          ...('label' in input ? { label: input.label } : {}),
          ...('checked' in input ? { checked: input.checked } : {}),
        },
        ['label', 'checked'],
      ),
    );

    res.json({ criteria: listCriteria(db, criterion.milestoneId) });
  });

  router.delete('/criteria/:criterionId', (req, res) => {
    const criterion = getCriterion(db, req.params.criterionId ?? '');
    if (!criterion) throw ApiError.notFound('Critère introuvable.');

    const actor = currentUser(req);
    deleteCriterion(db, criterion.id);
    record(db, { entityType: 'criterion', entityId: criterion.id, actorId: actor.id }, deleted(criterion.label));

    res.json({ criteria: listCriteria(db, criterion.milestoneId) });
  });

  return router;
}

function requireMilestone(db: Db, id: string | undefined) {
  const milestone = id ? getMilestone(db, id) : undefined;
  if (!milestone) throw ApiError.notFound('Jalon introuvable.');
  return milestone;
}
