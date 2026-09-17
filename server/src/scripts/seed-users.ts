/**
 * npm run seed:users
 * Cree ou met a jour les comptes en demandant login et mot de passe au terminal.
 * Pas de page d'inscription dans l'application : c'est le seul chemin de creation.
 */
import { openDatabase } from '../db.js';
import { loadStorageEnv } from '../env.js';
import { runMigrations } from '../migrate.js';
import { hashPassword } from '../auth/passwords.js';
import { ask, askHidden } from '../lib/prompt.js';
import { nowIso } from '../lib/time.js';
import { uuidv7 } from '../lib/uuid.js';

const MIN_PASSWORD_LENGTH = 12;

interface ExistingUser {
  id: string;
  login: string;
}

async function main(): Promise<void> {
  const env = loadStorageEnv();
  const db = openDatabase(env.DATABASE_PATH);
  runMigrations(db);

  console.log(`Base : ${env.DATABASE_PATH}`);
  console.log('Creation des comptes de quorex-internal. Ctrl+C pour arreter.\n');

  let again = true;
  while (again) {
    await upsertUser(db);
    const answer = (await ask('Creer ou mettre a jour un autre compte ? [o/N] ')).toLowerCase();
    again = answer === 'o' || answer === 'oui';
    console.log('');
  }

  const total = db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM users').get();
  console.log(`Termine. ${total?.count ?? 0} compte(s) en base.`);
  db.close();
}

async function upsertUser(db: ReturnType<typeof openDatabase>): Promise<void> {
  const login = await ask('Login : ');
  if (login.length === 0) {
    console.log('Login vide, on recommence.\n');
    return upsertUser(db);
  }

  const existing = db
    .prepare<[string], ExistingUser>('SELECT id, login FROM users WHERE login = ?')
    .get(login);

  const defaultName = existing
    ? (db.prepare<[string], { display_name: string }>('SELECT display_name FROM users WHERE id = ?')
        .get(existing.id)?.display_name ?? login)
    : login;

  const displayNameInput = await ask(`Nom affiche [${defaultName}] : `);
  const displayName = displayNameInput.length > 0 ? displayNameInput : defaultName;

  const password = await askHidden(`Mot de passe (${MIN_PASSWORD_LENGTH} caracteres minimum) : `);
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.log(`Mot de passe trop court (${MIN_PASSWORD_LENGTH} caracteres minimum).\n`);
    return upsertUser(db);
  }

  const confirmation = await askHidden('Confirmation : ');
  if (confirmation !== password) {
    console.log('Les deux saisies different.\n');
    return upsertUser(db);
  }

  const passwordHash = await hashPassword(password);
  const at = nowIso();

  if (existing) {
    db.prepare('UPDATE users SET password_hash = ?, display_name = ?, updated_at = ? WHERE id = ?').run(
      passwordHash,
      displayName,
      at,
      existing.id,
    );
    // Un changement de mot de passe deconnecte les sessions ouvertes du compte.
    const revoked = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id).changes;
    console.log(`Compte "${login}" mis a jour (${revoked} session(s) revoquee(s)).`);
    return;
  }

  db.prepare(
    `INSERT INTO users (id, login, password_hash, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(uuidv7(), login, passwordHash, displayName, at, at);

  console.log(`Compte "${login}" cree.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
