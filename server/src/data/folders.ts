import type { Folder } from '@quorex/shared';
import type { Db } from '../db.js';
import { nowIso } from '../lib/time.js';
import { uuidv7 } from '../lib/uuid.js';

interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  position: number;
  document_count: number;
  subfolder_count: number;
}

const SELECT_FOLDER = `
  SELECT
    f.id, f.name, f.parent_id, f.position,
    (SELECT COUNT(*) FROM documents d WHERE d.folder_id = f.id) AS document_count,
    (SELECT COUNT(*) FROM folders c WHERE c.parent_id = f.id) AS subfolder_count
  FROM folders f
`;

/** Chemin lisible d'un dossier : « Contrats / 2026 ». */
function buildPaths(rows: FolderRow[]): Map<string, string> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const paths = new Map<string, string>();

  const resolve = (id: string, seen: Set<string>): string => {
    const cached = paths.get(id);
    if (cached !== undefined) return cached;

    const row = byId.get(id);
    if (!row || seen.has(id)) return '';

    seen.add(id);
    const parentPath = row.parent_id === null ? '' : resolve(row.parent_id, seen);
    const path = parentPath === '' ? row.name : `${parentPath} / ${row.name}`;
    paths.set(id, path);
    return path;
  };

  for (const row of rows) resolve(row.id, new Set());
  return paths;
}

export function listFolders(db: Db): Folder[] {
  const rows = db
    .prepare<[], FolderRow>(`${SELECT_FOLDER} ORDER BY f.position ASC, f.name ASC`)
    .all();
  const paths = buildPaths(rows);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    position: row.position,
    path: paths.get(row.id) ?? row.name,
    documentCount: row.document_count,
    subfolderCount: row.subfolder_count,
  }));
}

export function getFolder(db: Db, id: string): Folder | undefined {
  return listFolders(db).find((folder) => folder.id === id);
}

export function folderPaths(db: Db): Map<string, string> {
  const rows = db.prepare<[], FolderRow>(SELECT_FOLDER).all();
  return buildPaths(rows);
}

export function findSibling(db: Db, parentId: string | null, name: string): string | undefined {
  const row =
    parentId === null
      ? db
          .prepare<[string], { id: string }>(
            'SELECT id FROM folders WHERE parent_id IS NULL AND LOWER(name) = LOWER(?)',
          )
          .get(name)
      : db
          .prepare<[string, string], { id: string }>(
            'SELECT id FROM folders WHERE parent_id = ? AND LOWER(name) = LOWER(?)',
          )
          .get(parentId, name);

  return row?.id;
}

export function insertFolder(db: Db, name: string, parentId: string | null): string {
  const id = uuidv7();
  const at = nowIso();
  const next =
    db.prepare<[], { next: number | null }>('SELECT MAX(position) + 1 AS next FROM folders').get()?.next ?? 0;

  db.prepare(
    'INSERT INTO folders (id, name, parent_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, name, parentId, next, at, at);

  return id;
}

export function updateFolder(db: Db, id: string, values: { name?: string; parentId?: string | null }): void {
  const at = nowIso();

  if (values.name !== undefined) {
    db.prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?').run(values.name, at, id);
  }
  if (values.parentId !== undefined) {
    db.prepare('UPDATE folders SET parent_id = ?, updated_at = ? WHERE id = ?').run(values.parentId, at, id);
  }
}

export function deleteFolder(db: Db, id: string): void {
  db.prepare('DELETE FROM folders WHERE id = ?').run(id);
}

/** Vrai si `candidateParent` est le dossier lui-meme ou l'un de ses descendants. */
export function wouldCycle(db: Db, id: string, candidateParent: string | null): boolean {
  let current = candidateParent;
  const seen = new Set<string>();

  while (current !== null) {
    if (current === id || seen.has(current)) return true;
    seen.add(current);

    const row = db
      .prepare<[string], { parent_id: string | null }>('SELECT parent_id FROM folders WHERE id = ?')
      .get(current);
    if (!row) return false;
    current = row.parent_id;
  }

  return false;
}
