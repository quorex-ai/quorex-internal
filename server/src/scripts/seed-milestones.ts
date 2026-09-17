/**
 * npm run seed:milestones
 * Cree les sept jalons du brief, dans l'ordre, en statut upcoming et sans date.
 * Idempotent : un jalon deja present (meme titre) n'est ni duplique ni modifie.
 */
import { openDatabase } from '../db.js';
import { loadStorageEnv } from '../env.js';
import { runMigrations } from '../migrate.js';
import { insertMilestone } from '../data/milestones.js';
import { created, record } from '../journal.js';

const MILESTONES = [
  'Stockage et modèle de données (schéma, migrations, FactStore Postgres, isolation par tenant)',
  'remember structuré et contradiction niveau (a)',
  'recall avec as_of, et diff',
  'Démo enregistrée (fait remplacé, time travel, diff, en deux minutes)',
  'Embeddings et contradiction niveau (b), mesure des seuils',
  'Extraction LLM et niveau (c)',
  'API complète avec grille d’erreurs, README, exemples curl',
] as const;

function main(): void {
  const env = loadStorageEnv();
  const db = openDatabase(env.DATABASE_PATH);
  runMigrations(db);

  let inserted = 0;

  for (const title of MILESTONES) {
    const existing = db
      .prepare<[string], { id: string }>('SELECT id FROM milestones WHERE title = ?')
      .get(title);

    if (existing) continue;

    const id = insertMilestone(db, { title, description: '', targetDate: null, status: 'upcoming' });
    // Le seed est un acteur du systeme : pas d'auteur humain dans le journal.
    record(db, { entityType: 'milestone', entityId: id, actorId: null }, created(title));
    inserted += 1;
  }

  const total = db.prepare<[], { count: number }>('SELECT COUNT(*) AS count FROM milestones').get();
  console.log(`${inserted} jalon(s) créé(s). ${total?.count ?? 0} jalon(s) en base.`);
  db.close();
}

main();
