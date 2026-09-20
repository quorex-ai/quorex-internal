/**
 * Rejoue les etapes de demarrage une par une, en annoncant chaque etape AVANT
 * de l'executer. Les ecritures sont synchrones : si le processus meurt d'un
 * coup (SIGSEGV), la derniere ligne affichee designe l'etape fautive.
 *
 * Lance par deploy/doctor.sh, dans le conteneur.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const say = (text) => fs.writeSync(1, text);
const step = (index, label) => say(`   ${index}. ${label} … `);
const done = (detail = 'ok') => say(`${detail}\n`);

try {
  step(1, 'lecture de la configuration');
  const documentsDir = process.env.DOCUMENTS_DIR;
  const databasePath = process.env.DATABASE_PATH;
  if (!documentsDir || !databasePath) {
    done('ÉCHEC : DOCUMENTS_DIR ou DATABASE_PATH absent du .env');
    process.exit(1);
  }
  done(databasePath);

  step(2, 'création du dossier des documents');
  fs.mkdirSync(documentsDir, { recursive: true, mode: 0o700 });
  done();

  step(3, 'écriture dans le dossier des documents');
  const witness = path.join(documentsDir, '.doctor-probe');
  fs.writeFileSync(witness, 'x');
  fs.rmSync(witness);
  done();

  step(4, 'création du dossier de la base');
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  done();

  step(5, 'chargement de better-sqlite3');
  const Database = require('better-sqlite3');
  done();

  // Trois ouvertures de plus en plus exigeantes : si la premiere tue deja le
  // processus, le probleme est le binaire natif, pas le montage.
  step(6, 'base en memoire');
  new Database(':memory:').close();
  done();

  step(7, 'base sur le disque du conteneur');
  const local = '/tmp/doctor-probe.db';
  new Database(local).close();
  fs.rmSync(local, { force: true });
  done();

  step(8, 'base sur le dossier monte');
  const db = new Database(databasePath);
  done();

  step(9, 'passage en journal WAL');
  done(String(db.pragma('journal_mode = WAL', { simple: true })));

  step(10, "contrôle d'intégrité");
  done(String(db.pragma('integrity_check', { simple: true })));

  step(11, 'lecture des migrations appliquées');
  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  done(
    table
      ? `${db.prepare('SELECT COUNT(*) AS c FROM schema_migrations').get().c} migration(s)`
      : 'base vierge',
  );

  db.close();
  say('   → toutes les étapes passent\n');
} catch (error) {
  done(`ÉCHEC : ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
