import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import {
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  documentMetadataSchema,
  documentUpdateSchema,
  type DocumentType,
} from '@quorex/shared';
import type { Db } from '../db.js';
import { ApiError, parseBody } from '../errors.js';
import { currentUser } from '../auth/middleware.js';
import { created, deleted, diff, record, recordChanges } from '../journal.js';
import { getMilestone } from '../data/milestones.js';
import {
  deleteDocument,
  getDocument,
  getDocumentFields,
  insertDocument,
  listDocuments,
  listTags,
  updateDocumentFields,
  type DocumentFilters,
} from '../data/documents.js';
import { getFolder } from '../data/folders.js';
import { detectDocumentType, sanitizeFilename } from '../lib/magic-bytes.js';
import { uuidv7 } from '../lib/uuid.js';

/** Champs de metadonnees suivis par le journal. */
const DOCUMENT_FIELDS = [
  'title',
  'type',
  'parties',
  'doc_date',
  'tags',
  'milestone_id',
  'folder_id',
] as const;

/**
 * Le fichier passe par la memoire : c'est le serveur qui ecrit sur disque,
 * avec un nom qu'il choisit, apres avoir verifie le contenu.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1, fields: 20 },
});

export function createDocumentsRouter(db: Db, documentsDir: string): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const filters: DocumentFilters = {};
    const { type, milestoneId, tag, from, to, search } = req.query;

    const folderId = req.query.folderId;
    if (typeof folderId === 'string' && folderId) filters.folderId = folderId;
    if (typeof type === 'string' && isDocumentType(type)) filters.type = type;
    if (typeof milestoneId === 'string' && milestoneId) filters.milestoneId = milestoneId;
    if (typeof tag === 'string' && tag) filters.tag = tag;
    if (typeof from === 'string' && from) filters.from = from;
    if (typeof to === 'string' && to) filters.to = to;
    if (typeof search === 'string' && search.trim()) filters.search = search.trim();

    res.json({ documents: listDocuments(db, filters), tags: listTags(db) });
  });

  router.post('/', upload.single('file'), (req, res) => {
    const actor = currentUser(req);
    const file = req.file;
    if (!file) throw ApiError.badRequest('Aucun fichier reçu.');

    // Le type est deduit du contenu, jamais de l'extension ni de l'en-tete client.
    const detected = detectDocumentType(file.buffer);
    if (!detected) {
      throw ApiError.badRequest(
        'Format de fichier refusé. Formats acceptés : PDF, docx, xlsx, png, jpg.',
      );
    }

    const metadata = parseBody(documentMetadataSchema, parseMetadata(req.body));
    if (metadata.milestoneId !== null && !getMilestone(db, metadata.milestoneId)) {
      throw ApiError.badRequest('Jalon inconnu.', [{ field: 'milestoneId', message: 'Jalon introuvable' }]);
    }
    if (metadata.folderId !== null && !getFolder(db, metadata.folderId)) {
      throw ApiError.badRequest('Dossier inconnu.', [{ field: 'folderId', message: 'Dossier introuvable' }]);
    }

    const id = uuidv7();
    // Nom sur disque : UUID v7 + extension normalisee. Le nom d'origine ne touche jamais le disque.
    const storedFilename = `${id}${detected.extension}`;

    fs.writeFileSync(path.join(documentsDir, storedFilename), file.buffer, { mode: 0o600 });

    try {
      insertDocument(db, {
        id,
        ...metadata,
        originalFilename: sanitizeFilename(file.originalname),
        storedFilename,
        mimeType: detected.mimeType,
        sizeBytes: file.buffer.byteLength,
        uploadedBy: actor.id,
      });
    } catch (error) {
      // Pas de fichier orphelin si la ligne n'a pas pu etre ecrite.
      fs.rmSync(path.join(documentsDir, storedFilename), { force: true });
      throw error;
    }

    record(db, { entityType: 'document', entityId: id, actorId: actor.id }, created(metadata.title));

    res.status(201).json({ document: getDocument(db, id) });
  });

  router.patch('/:id', (req, res) => {
    const document = getDocument(db, req.params.id ?? '');
    if (!document) throw ApiError.notFound('Document introuvable.');

    const input = parseBody(documentUpdateSchema, req.body);
    const actor = currentUser(req);

    if (input.milestoneId !== undefined && input.milestoneId !== null && !getMilestone(db, input.milestoneId)) {
      throw ApiError.badRequest('Jalon inconnu.', [{ field: 'milestoneId', message: 'Jalon introuvable' }]);
    }
    if (input.folderId !== undefined && input.folderId !== null && !getFolder(db, input.folderId)) {
      throw ApiError.badRequest('Dossier inconnu.', [{ field: 'folderId', message: 'Dossier introuvable' }]);
    }

    const before = getDocumentFields(db, document.id);
    if (!before) throw ApiError.notFound('Document introuvable.');

    // Le fichier lui-meme ne bouge pas : seules ses metadonnees changent.
    const after = {
      ...('title' in input ? { title: input.title } : {}),
      ...('type' in input ? { type: input.type } : {}),
      ...('parties' in input ? { parties: input.parties } : {}),
      ...('docDate' in input ? { doc_date: input.docDate } : {}),
      ...('tags' in input ? { tags: JSON.stringify(input.tags ?? []) } : {}),
      ...('milestoneId' in input ? { milestone_id: input.milestoneId } : {}),
      ...('folderId' in input ? { folder_id: input.folderId } : {}),
    };

    updateDocumentFields(db, document.id, after);
    recordChanges(
      db,
      { entityType: 'document', entityId: document.id, actorId: actor.id },
      diff(before, after, DOCUMENT_FIELDS),
    );

    res.json({ document: getDocument(db, document.id) });
  });

  router.get('/:id/download', (req, res) => {
    const document = getDocument(db, req.params.id ?? '');
    if (!document) throw ApiError.notFound('Document introuvable.');

    const filePath = path.join(documentsDir, path.basename(document.storedFilename));
    if (!fs.existsSync(filePath)) throw ApiError.notFound('Fichier introuvable sur le disque.');

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Length', String(document.sizeBytes));
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizeFilename(document.originalFilename)}"`,
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(filePath).pipe(res);
  });

  router.delete('/:id', (req, res) => {
    const document = getDocument(db, req.params.id ?? '');
    if (!document) throw ApiError.notFound('Document introuvable.');

    const actor = currentUser(req);

    // La ligne d'abord, le fichier ensuite, et le journal note la suppression.
    deleteDocument(db, document.id);
    fs.rmSync(path.join(documentsDir, path.basename(document.storedFilename)), { force: true });
    record(db, { entityType: 'document', entityId: document.id, actorId: actor.id }, deleted(document.title));

    res.status(204).end();
  });

  return router;
}

function isDocumentType(value: string): value is DocumentType {
  return (DOCUMENT_TYPES as readonly string[]).includes(value);
}

/** Les champs d'un envoi multipart sont des chaines : on rend leur forme attendue. */
function parseMetadata(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) return {};
  const source = body as Record<string, unknown>;

  const tags = typeof source.tags === 'string' && source.tags.length > 0 ? safeParseTags(source.tags) : [];

  return {
    title: source.title,
    type: source.type,
    parties: source.parties ?? '',
    docDate: source.docDate === '' || source.docDate === undefined ? null : source.docDate,
    tags,
    milestoneId: source.milestoneId === '' || source.milestoneId === undefined ? null : source.milestoneId,
    folderId: source.folderId === '' || source.folderId === undefined ? null : source.folderId,
  };
}

function safeParseTags(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((tag): tag is string => typeof tag === 'string');
  } catch {
    // Champ envoye en texte simple : « a, b, c ».
  }
  return raw
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}
