import { Router } from 'express';
import type { TeamMember } from '@quorex/shared';
import type { Db } from '../db.js';

/** Les deux comptes de l'equipe : sert aux selecteurs d'assigne et aux filtres. */
export function createUsersRouter(db: Db): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const rows = db
      .prepare<[], { id: string; login: string; display_name: string }>(
        'SELECT id, login, display_name FROM users ORDER BY display_name ASC',
      )
      .all();

    const members: TeamMember[] = rows.map((row) => ({
      id: row.id,
      login: row.login,
      displayName: row.display_name,
    }));

    res.json({ users: members });
  });

  return router;
}
