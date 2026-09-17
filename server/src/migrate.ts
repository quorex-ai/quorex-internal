import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Db } from './db.js';
import { nowIso } from './lib/time.js';

/** server/migrations, que l'on tourne depuis src/ (tsx) ou dist/ (build). */
export const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'migrations',
);

/**
 * Applique les migrations SQL manquantes, dans l'ordre alphabetique des fichiers.
 * Chaque migration est jouee dans une transaction et notee dans schema_migrations.
 */
export function runMigrations(db: Db, dir: string = migrationsDir): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    db.prepare<[], { name: string }>('SELECT name FROM schema_migrations').all().map((row) => row.name),
  );

  const files = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.sql'))
    .sort();

  const justApplied: string[] = [];
  const record = db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)');

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    const apply = db.transaction(() => {
      db.exec(sql);
      record.run(file, nowIso());
    });

    apply();
    justApplied.push(file);
  }

  return justApplied;
}
