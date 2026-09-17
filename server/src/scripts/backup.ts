/**
 * npm run backup
 * Produit BACKUP_DIR/quorex-internal-AAAAMMJJ-HHMMSS.tar.gz contenant :
 *   - database.db : copie coherente de la base, via l'API de backup de SQLite
 *   - documents/  : le contenu de DOCUMENTS_DIR
 * La base n'est jamais copiee a chaud avec un simple cp.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../db.js';
import { loadStorageEnv } from '../env.js';

function stamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

async function main(): Promise<void> {
  const env = loadStorageEnv();

  if (!fs.existsSync(env.DATABASE_PATH)) {
    throw new Error(`Base introuvable : ${env.DATABASE_PATH}`);
  }

  fs.mkdirSync(env.BACKUP_DIR, { recursive: true, mode: 0o700 });

  const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'quorex-backup-'));
  const archiveName = `quorex-internal-${stamp(new Date())}.tar.gz`;
  const archivePath = path.join(env.BACKUP_DIR, archiveName);

  try {
    // Copie coherente meme si le serveur ecrit pendant la sauvegarde.
    const db = openDatabase(env.DATABASE_PATH);
    await db.backup(path.join(staging, 'database.db'));
    db.close();

    const documentsTarget = path.join(staging, 'documents');
    fs.mkdirSync(documentsTarget, { recursive: true, mode: 0o700 });

    if (fs.existsSync(env.DOCUMENTS_DIR)) {
      for (const entry of fs.readdirSync(env.DOCUMENTS_DIR, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        fs.copyFileSync(path.join(env.DOCUMENTS_DIR, entry.name), path.join(documentsTarget, entry.name));
      }
    }

    execFileSync('tar', ['-czf', archivePath, '-C', staging, 'database.db', 'documents'], {
      stdio: 'pipe',
    });
    fs.chmodSync(archivePath, 0o600);

    const size = fs.statSync(archivePath).size;
    console.log(`Sauvegarde écrite : ${archivePath} (${(size / 1024 / 1024).toFixed(2)} Mo)`);
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
