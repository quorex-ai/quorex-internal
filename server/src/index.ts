import fs from 'node:fs';
import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { loadEnv } from './env.js';
import { runMigrations } from './migrate.js';
import { deleteExpiredSessions } from './auth/sessions.js';

function main(): void {
  const env = loadEnv();

  // Le coffre vit hors du depot et hors de la racine web, en 700.
  fs.mkdirSync(env.DOCUMENTS_DIR, { recursive: true, mode: 0o700 });
  fs.chmodSync(env.DOCUMENTS_DIR, 0o700);

  const db = openDatabase(env.DATABASE_PATH);
  const applied = runMigrations(db);
  if (applied.length > 0) {
    console.log(`[db] migrations appliquees : ${applied.join(', ')}`);
  }

  const purged = deleteExpiredSessions(db);
  if (purged > 0) {
    console.log(`[auth] ${purged} session(s) expiree(s) supprimee(s)`);
  }

  const app = createApp({ db, env });
  const server = app.listen(env.PORT, () => {
    console.log(`[http] quorex-internal ecoute sur http://127.0.0.1:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string): void => {
    console.log(`[http] ${signal} recu, arret en cours`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
