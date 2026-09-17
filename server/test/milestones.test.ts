import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import type { Response } from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, sessionCookie, TEST_PASSWORD, type TestContext } from './helpers.js';

interface JournalRow {
  entity_type: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  actor_id: string | null;
}

describe('jalons, critères et journal', () => {
  let context: TestContext;
  let directory: string;
  let cookie: string;

  const authed = (method: 'get' | 'post' | 'patch' | 'delete', url: string): request.Test =>
    request(context.app)[method](url).set('Cookie', cookie);

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quorex-test-'));
    context = await createTestContext(directory);

    const login = await request(context.app)
      .post('/api/auth/login')
      .send({ login: 'clement', password: TEST_PASSWORD });
    cookie = sessionCookie(login.headers['set-cookie'] as unknown as string[]);
  });

  afterEach(() => {
    context.db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const journal = (): JournalRow[] =>
    context.db
      .prepare<[], JournalRow>(
        'SELECT entity_type, field, old_value, new_value, actor_id FROM journal ORDER BY at ASC, id ASC',
      )
      .all();

  const createMilestone = async (title = 'Stockage et modèle de données'): Promise<string> => {
    const response: Response = await authed('post', '/api/milestones').send({ title });
    expect(response.status).toBe(201);
    return String(response.body.milestone.id);
  };

  it('refuse la fermeture tant qu’un critère n’est pas coché, et dit lesquels', async () => {
    const id = await createMilestone();
    await authed('post', `/api/milestones/${id}/criteria`).send({ label: 'Migrations rejouables' }).expect(201);
    await authed('post', `/api/milestones/${id}/criteria`).send({ label: 'Isolation testée' }).expect(201);

    const refused = await authed('patch', `/api/milestones/${id}`).send({ status: 'closed' });

    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('CONFLICT');
    expect(refused.body.error.details.missing).toHaveLength(2);
    expect(refused.body.error.details.missing[0].label).toBe('Migrations rejouables');

    // Le jalon n'a pas bouge.
    const after = await authed('get', `/api/milestones/${id}`);
    expect(after.body.milestone.status).toBe('upcoming');
  });

  it('accepte la fermeture une fois tous les critères cochés', async () => {
    const id = await createMilestone();
    const created = await authed('post', `/api/milestones/${id}/criteria`).send({ label: 'Un critère' });

    const criterionId = String(created.body.criteria[0].id);
    await authed('patch', `/api/milestones/criteria/${criterionId}`).send({ checked: true }).expect(200);

    const closed = await authed('patch', `/api/milestones/${id}`).send({ status: 'closed' });
    expect(closed.status).toBe(200);
    expect(closed.body.milestone.status).toBe('closed');
    expect(closed.body.milestone.criteriaChecked).toBe(1);
  });

  it('un jalon sans critère se ferme sans condition', async () => {
    const id = await createMilestone();
    const closed = await authed('patch', `/api/milestones/${id}`).send({ status: 'closed' });
    expect(closed.status).toBe(200);
  });

  it('écrit le journal à chaque mutation, avec son auteur', async () => {
    const id = await createMilestone('Jalon journalisé');

    expect(journal()).toEqual([
      {
        entity_type: 'milestone',
        field: 'created',
        old_value: null,
        new_value: 'Jalon journalisé',
        actor_id: context.userId,
      },
    ]);

    await authed('patch', `/api/milestones/${id}`).send({ targetDate: '2026-03-31', status: 'in_progress' });

    const fields = journal().map((row) => row.field);
    expect(fields).toEqual(['created', 'target_date', 'status']);

    const statusEntry = journal().find((row) => row.field === 'status');
    expect(statusEntry?.old_value).toBe('upcoming');
    expect(statusEntry?.new_value).toBe('in_progress');
  });

  it('journalise les critères, les tâches et leurs déplacements', async () => {
    const milestoneId = await createMilestone();
    const criteria = await authed('post', `/api/milestones/${milestoneId}/criteria`).send({ label: 'Critère' });
    const criterionId = String(criteria.body.criteria[0].id);

    await authed('patch', `/api/milestones/criteria/${criterionId}`).send({ checked: true });

    const task = await authed('post', '/api/tasks').send({ milestoneId, title: 'Écrire les migrations' });
    const taskId = String(task.body.task.id);
    await authed('post', '/api/tasks/move').send({ status: 'in_progress', ids: [taskId] });

    const entries = journal().map((row) => `${row.entity_type}:${row.field}`);
    expect(entries).toEqual([
      'milestone:created',
      'criterion:created',
      'criterion:checked',
      'task:created',
      'task:status',
    ]);
  });

  it('ne journalise rien quand une mise à jour ne change rien', async () => {
    const id = await createMilestone('Titre stable');
    const before = journal().length;

    await authed('patch', `/api/milestones/${id}`).send({ title: 'Titre stable' }).expect(200);

    expect(journal()).toHaveLength(before);
  });

  it('refuse une tâche sans jalon connu', async () => {
    const response = await authed('post', '/api/tasks').send({ milestoneId: 'inconnu', title: 'Orpheline' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('une mise à jour partielle ne touche que le champ envoyé', async () => {
    const id = await createMilestone('Jalon complet');
    await authed('patch', `/api/milestones/${id}`).send({
      description: 'Description à garder',
      targetDate: '2026-03-31',
      status: 'in_progress',
    });

    // Un seul champ envoyé : les autres doivent survivre intacts.
    await authed('patch', `/api/milestones/${id}`).send({ title: 'Titre modifié' }).expect(200);

    const after = await authed('get', `/api/milestones/${id}`);
    expect(after.body.milestone.title).toBe('Titre modifié');
    expect(after.body.milestone.description).toBe('Description à garder');
    expect(after.body.milestone.targetDate).toBe('2026-03-31');
    expect(after.body.milestone.status).toBe('in_progress');
  });

  it('une tâche ne perd ni son assigné ni son lien sur une mise à jour partielle', async () => {
    const milestoneId = await createMilestone();
    const users = await authed('get', '/api/users');
    const assigneeId = String(users.body.users[0].id);

    const created = await authed('post', '/api/tasks').send({
      milestoneId,
      title: 'Tâche complète',
      assigneeId,
      externalUrl: 'https://github.com/quorex/quorex/pull/12',
    });
    const taskId = String(created.body.task.id);
    await authed('post', '/api/tasks/move').send({ status: 'review', ids: [taskId] });

    const patched = await authed('patch', `/api/tasks/${taskId}`).send({ title: 'Titre seul' });

    expect(patched.status).toBe(200);
    expect(patched.body.task.title).toBe('Titre seul');
    expect(patched.body.task.assigneeId).toBe(assigneeId);
    expect(patched.body.task.status).toBe('review');
    expect(patched.body.task.externalUrl).toBe('https://github.com/quorex/quorex/pull/12');
  });

  it('réordonne les jalons et refuse un identifiant étranger', async () => {
    const first = await createMilestone('Premier');
    const second = await createMilestone('Deuxième');

    const reordered = await authed('post', '/api/milestones/reorder').send({ ids: [second, first] });
    expect(reordered.status).toBe(200);
    expect(reordered.body.milestones.map((milestone: { id: string }) => milestone.id)).toEqual([second, first]);

    const refused = await authed('post', '/api/milestones/reorder').send({ ids: [first, 'inconnu'] });
    expect(refused.status).toBe(400);
  });
});
