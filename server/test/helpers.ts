import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { openDatabase, type Db } from '../src/db.js';
import { runMigrations } from '../src/migrate.js';
import type { Env } from '../src/env.js';
import { hashPassword } from '../src/auth/passwords.js';
import { uuidv7 } from '../src/lib/uuid.js';
import { nowIso } from '../src/lib/time.js';

const migrations = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export const TEST_PASSWORD = 'mot-de-passe-de-test';

export interface TestContext {
  app: Express;
  db: Db;
  userId: string;
  documentsDir: string;
}

export function createTestEnv(documentsDir: string): Env {
  return {
    NODE_ENV: 'test',
    PORT: 0,
    DATABASE_PATH: ':memory:',
    DOCUMENTS_DIR: documentsDir,
    BACKUP_DIR: documentsDir,
    SESSION_SECRET: 'secret-de-test-suffisamment-long-pour-passer',
    TRUST_PROXY: 'loopback',
  };
}

/** Application complete sur une base en memoire, avec un compte pret a l'emploi. */
export async function createTestContext(documentsDir: string): Promise<TestContext> {
  const db = openDatabase(':memory:');
  runMigrations(db, migrations);

  const userId = uuidv7();
  const at = nowIso();
  db.prepare(
    `INSERT INTO users (id, login, password_hash, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(userId, 'clement', await hashPassword(TEST_PASSWORD), 'Clément', at, at);

  return { app: createApp({ db, env: createTestEnv(documentsDir) }), db, userId, documentsDir };
}

/** Valeur du cookie de session, a rejouer sur les requetes suivantes. */
export function sessionCookie(setCookie: string[] | undefined): string {
  const cookie = (setCookie ?? []).find((value) => value.startsWith('quorex_session='));
  if (!cookie) throw new Error('Aucun cookie de session dans la réponse.');
  return cookie.split(';')[0] ?? '';
}
