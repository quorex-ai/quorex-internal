import { Router } from 'express';
import { linkCreateSchema, linkUpdateSchema, reorderSchema, type Link } from '@quorex/shared';
import type { Db } from '../db.js';
import { ApiError, parseBody } from '../errors.js';
import { nowIso } from '../lib/time.js';
import { uuidv7 } from '../lib/uuid.js';

interface LinkRow {
  id: string;
  label: string;
  url: string;
  position: number;
}

function listLinks(db: Db): Link[] {
  return db
    .prepare<[], LinkRow>('SELECT id, label, url, position FROM links ORDER BY position ASC, created_at ASC')
    .all();
}

export function createLinksRouter(db: Db): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ links: listLinks(db) });
  });

  router.post('/', (req, res) => {
    const input = parseBody(linkCreateSchema, req.body);
    const at = nowIso();
    const next =
      db.prepare<[], { next: number | null }>('SELECT MAX(position) + 1 AS next FROM links').get()?.next ?? 0;

    db.prepare(
      'INSERT INTO links (id, label, url, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    ).run(uuidv7(), input.label, input.url, next, at, at);

    res.status(201).json({ links: listLinks(db) });
  });

  router.patch('/:id', (req, res) => {
    const id = req.params.id ?? '';
    const existing = db.prepare<[string], { id: string }>('SELECT id FROM links WHERE id = ?').get(id);
    if (!existing) throw ApiError.notFound('Lien introuvable.');

    const input = parseBody(linkUpdateSchema, req.body);
    const at = nowIso();

    if (input.label !== undefined) {
      db.prepare('UPDATE links SET label = ?, updated_at = ? WHERE id = ?').run(input.label, at, id);
    }
    if (input.url !== undefined) {
      db.prepare('UPDATE links SET url = ?, updated_at = ? WHERE id = ?').run(input.url, at, id);
    }

    res.json({ links: listLinks(db) });
  });

  router.delete('/:id', (req, res) => {
    const id = req.params.id ?? '';
    const changes = db.prepare('DELETE FROM links WHERE id = ?').run(id).changes;
    if (changes === 0) throw ApiError.notFound('Lien introuvable.');

    res.json({ links: listLinks(db) });
  });

  router.post('/reorder', (req, res) => {
    const input = parseBody(reorderSchema, req.body);
    const known = new Set(listLinks(db).map((link) => link.id));

    for (const id of input.ids) {
      if (!known.has(id)) throw ApiError.badRequest(`Lien inconnu dans le nouvel ordre : ${id}`);
    }

    const at = nowIso();
    const update = db.prepare('UPDATE links SET position = ?, updated_at = ? WHERE id = ?');
    const apply = db.transaction(() => {
      input.ids.forEach((id, index) => update.run(index, at, id));
    });
    apply();

    res.json({ links: listLinks(db) });
  });

  return router;
}
