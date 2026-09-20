import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type Db = Database.Database;

/** Ouvre la base, cree le dossier parent si besoin, et pose les pragmas. */
export function openDatabase(file: string): Db {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }

  const db = new Database(file);

  // Le premier acces reel au fichier a lieu ici : c'est le moment ou une base
  // abimee se revele, et ou le message doit nommer le fichier en cause.
  if (file !== ':memory:') assertIntact(db, file);

  setJournalMode(db);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  return db;
}

/** Une base abimee doit se dire au demarrage, pas au premier ecran blanc. */
function assertIntact(db: Db, file: string): void {
  let verdict: string;

  try {
    verdict = String(db.pragma('quick_check', { simple: true }));
  } catch (error) {
    db.close();
    throw new Error(explain(file, error instanceof Error ? error.message : String(error)));
  }

  if (verdict === 'ok') return;

  db.close();
  throw new Error(explain(file, verdict));
}

function explain(file: string, detail: string): string {
  return [
    `Impossible d'utiliser la base : ${file}`,
    `  SQLite repond : ${detail}`,
    `  Restaurer la derniere sauvegarde, ou deplacer le fichier pour repartir d'une base vierge.`,
  ].join('\n');
}

/**
 * Le journal WAL demande de la memoire partagee, que certains montages ne
 * fournissent pas. On regarde ce que SQLite a retenu plutot que de le supposer,
 * et on retombe sur DELETE — plus lent, mais correct — le cas echeant.
 */
function setJournalMode(db: Db): void {
  let mode = 'inconnu';

  try {
    mode = String(db.pragma('journal_mode = WAL', { simple: true }));
  } catch (error) {
    mode = error instanceof Error ? error.message : 'refuse';
  }

  if (mode.toLowerCase() === 'wal') return;

  db.pragma('journal_mode = DELETE');
  console.warn(`[db] journal WAL indisponible (${mode}) : repli sur DELETE.`);
}
