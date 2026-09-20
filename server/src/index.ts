import fs from 'node:fs';
import { createApp } from './app.js';
import { openDatabase } from './db.js';
import { loadEnv } from './env.js';
import { runMigrations } from './migrate.js';
import { deleteExpiredSessions } from './auth/sessions.js';

/**
 * Le coffre vit hors du depot et hors de la racine web, en 700.
 * Le dossier vient souvent d'un montage : on n'en est alors pas proprietaire et
 * poser les permissions echoue. Ce n'est bloquant que si l'on ne peut pas y
 * ecrire, et dans ce cas le message dit quoi faire au lieu de boucler sur EPERM.
 */
function ensureDocumentsDir(directory: string): void {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });

  try {
    if ((fs.statSync(directory).mode & 0o777) !== 0o700) fs.chmodSync(directory, 0o700);
  } catch {
    console.warn(`[coffre] permissions de ${directory} laissees telles quelles : le serveur n'en est pas proprietaire.`);
  }

  try {
    fs.accessSync(directory, fs.constants.W_OK | fs.constants.X_OK);
  } catch {
    const uid = typeof process.getuid === 'function' ? process.getuid() : null;
    throw new Error(
      [
        `Le dossier des documents n'est pas accessible en ecriture : ${directory}`,
        `  Le serveur tourne en uid ${uid ?? 'inconnu'}.`,
        `  En Docker : chown -R 1000:1000 ${directory}`,
      ].join('\n'),
    );
  }
}

function main(): void {
  const env = loadEnv();

  ensureDocumentsDir(env.DOCUMENTS_DIR);

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
    // Un demarrage doit se lire d'un coup d'oeil : ou sont les donnees, sur quel port.
    console.log(`[http] quorex-internal ecoute sur http://127.0.0.1:${env.PORT} (${env.NODE_ENV})`);
    console.log(`[db]   ${env.DATABASE_PATH}`);
    console.log(`[coffre] ${env.DOCUMENTS_DIR}`);
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
