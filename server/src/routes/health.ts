import { Router } from 'express';
import type { Db } from '../db.js';
import { nowIso } from '../lib/time.js';

/** Seule route d'API accessible sans session, pour la supervision du VPS. */
export function createHealthRouter(db: Db): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const probe = db.prepare<[], { ok: number }>('SELECT 1 AS ok').get();
    res.status(200).json({
      status: probe?.ok === 1 ? 'ok' : 'degraded',
      database: probe?.ok === 1 ? 'ok' : 'unreachable',
      time: nowIso(),
    });
  });

  return router;
}
