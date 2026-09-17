import type { DocumentSummary, DocumentType } from '@quorex/shared';
import type { Db } from '../db.js';
import { nowIso } from '../lib/time.js';
import { folderPaths } from './folders.js';

interface DocumentRow {
  id: string;
  title: string;
  type: DocumentType;
  parties: string;
  doc_date: string | null;
  tags: string;
  milestone_id: string | null;
  milestone_title: string | null;
  folder_id: string | null;
  original_filename: string;
  stored_filename: string;
  mime_type: string;
  size_bytes: number;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

const SELECT_DOCUMENT = `
  SELECT
    d.id, d.title, d.type, d.parties, d.doc_date, d.tags, d.milestone_id, d.folder_id,
    d.original_filename, d.stored_filename, d.mime_type, d.size_bytes, d.uploaded_by, d.created_at,
    m.title AS milestone_title,
    u.display_name AS uploaded_by_name
  FROM documents d
  LEFT JOIN milestones m ON m.id = d.milestone_id
  LEFT JOIN users u ON u.id = d.uploaded_by
`;

function parseTags(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

function toSummary(row: DocumentRow, paths: Map<string, string>): DocumentSummary {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    parties: row.parties,
    docDate: row.doc_date,
    tags: parseTags(row.tags),
    milestoneId: row.milestone_id,
    milestoneTitle: row.milestone_title,
    folderId: row.folder_id,
    folderPath: row.folder_id === null ? '' : (paths.get(row.folder_id) ?? ''),
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by_name,
    createdAt: row.created_at,
  };
}

export interface DocumentFilters {
  type?: DocumentType;
  milestoneId?: string;
  /** Dossier exact ; « root » pour la racine. Ignore si absent. */
  folderId?: string;
  tag?: string;
  from?: string;
  to?: string;
  /** Recherche libre sur titre, parties et tags. */
  search?: string;
}

export function listDocuments(db: Db, filters: DocumentFilters = {}): DocumentSummary[] {
  const conditions: string[] = [];
  const parameters: string[] = [];

  if (filters.type) {
    conditions.push('d.type = ?');
    parameters.push(filters.type);
  }
  if (filters.milestoneId) {
    conditions.push('d.milestone_id = ?');
    parameters.push(filters.milestoneId);
  }
  if (filters.folderId === 'root') {
    conditions.push('d.folder_id IS NULL');
  } else if (filters.folderId) {
    conditions.push('d.folder_id = ?');
    parameters.push(filters.folderId);
  }
  if (filters.tag) {
    conditions.push('LOWER(d.tags) LIKE ?');
    parameters.push(`%"${filters.tag.toLowerCase()}"%`);
  }
  if (filters.from) {
    conditions.push('d.doc_date >= ?');
    parameters.push(filters.from);
  }
  if (filters.to) {
    conditions.push('d.doc_date <= ?');
    parameters.push(filters.to);
  }
  if (filters.search) {
    conditions.push('(LOWER(d.title) LIKE ? OR LOWER(d.parties) LIKE ? OR LOWER(d.tags) LIKE ?)');
    const needle = `%${filters.search.toLowerCase()}%`;
    parameters.push(needle, needle, needle);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const paths = folderPaths(db);

  return db
    .prepare<string[], DocumentRow>(
      `${SELECT_DOCUMENT} ${where} ORDER BY COALESCE(d.doc_date, d.created_at) DESC, d.created_at DESC`,
    )
    .all(...parameters)
    .map((row) => toSummary(row, paths));
}

export function getDocument(db: Db, id: string): (DocumentSummary & { storedFilename: string }) | undefined {
  const row = db.prepare<[string], DocumentRow>(`${SELECT_DOCUMENT} WHERE d.id = ?`).get(id);
  return row ? { ...toSummary(row, folderPaths(db)), storedFilename: row.stored_filename } : undefined;
}

export interface DocumentInsert {
  id: string;
  title: string;
  type: DocumentType;
  parties: string;
  docDate: string | null;
  tags: string[];
  milestoneId: string | null;
  folderId: string | null;
  originalFilename: string;
  storedFilename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
}

export function insertDocument(db: Db, values: DocumentInsert): void {
  const at = nowIso();

  db.prepare(
    `INSERT INTO documents (
       id, title, type, parties, doc_date, tags, milestone_id, folder_id,
       original_filename, stored_filename, mime_type, size_bytes, uploaded_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    values.id,
    values.title,
    values.type,
    values.parties,
    values.docDate,
    JSON.stringify(values.tags),
    values.milestoneId,
    values.folderId,
    values.originalFilename,
    values.storedFilename,
    values.mimeType,
    values.sizeBytes,
    values.uploadedBy,
    at,
    at,
  );
}

/** Champs modifiables d'un document : le fichier lui-meme ne change jamais. */
export interface DocumentWritableFields extends Record<string, unknown> {
  title: string;
  type: DocumentType;
  parties: string;
  doc_date: string | null;
  tags: string;
  milestone_id: string | null;
  folder_id: string | null;
}

export function getDocumentFields(db: Db, id: string): DocumentWritableFields | undefined {
  return db
    .prepare<[string], DocumentWritableFields>(
      'SELECT title, type, parties, doc_date, tags, milestone_id, folder_id FROM documents WHERE id = ?',
    )
    .get(id);
}

export function updateDocumentFields(db: Db, id: string, values: Partial<DocumentWritableFields>): void {
  const columns = Object.keys(values);
  if (columns.length === 0) return;

  const assignments = columns.map((column) => `${column} = ?`).join(', ');
  const parameters = columns.map((column) => values[column] as string | null);

  db.prepare(`UPDATE documents SET ${assignments}, updated_at = ? WHERE id = ?`).run(
    ...parameters,
    nowIso(),
    id,
  );
}

export function deleteDocument(db: Db, id: string): void {
  db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}

/** Tous les tags utilises, pour le filtre. */
export function listTags(db: Db): string[] {
  const rows = db.prepare<[], { tags: string }>('SELECT tags FROM documents').all();
  const tags = new Set<string>();
  for (const row of rows) for (const tag of parseTags(row.tags)) tags.add(tag);
  return [...tags].sort((a, b) => a.localeCompare(b, 'fr'));
}
