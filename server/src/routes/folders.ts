import { Router } from 'express';
import { folderCreateSchema, folderUpdateSchema } from '@quorex/shared';
import type { Db } from '../db.js';
import { ApiError, parseBody } from '../errors.js';
import {
  deleteFolder,
  findSibling,
  getFolder,
  insertFolder,
  listFolders,
  updateFolder,
  wouldCycle,
} from '../data/folders.js';

/**
 * Dossiers du coffre. Ils rangent les documents, rien de plus : le journal ne
 * connait que jalons, taches, criteres et documents, donc le deplacement d'un
 * document est trace, la vie du dossier ne l'est pas.
 */
export function createFoldersRouter(db: Db): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ folders: listFolders(db) });
  });

  router.post('/', (req, res) => {
    const input = parseBody(folderCreateSchema, req.body);

    if (input.parentId !== null && !getFolder(db, input.parentId)) {
      throw ApiError.badRequest('Dossier parent introuvable.');
    }
    if (findSibling(db, input.parentId, input.name)) {
      throw ApiError.conflict('Un dossier porte déjà ce nom à cet endroit.');
    }

    const id = insertFolder(db, input.name, input.parentId);
    res.status(201).json({ folders: listFolders(db), folder: getFolder(db, id) });
  });

  router.patch('/:id', (req, res) => {
    const folder = getFolder(db, req.params.id ?? '');
    if (!folder) throw ApiError.notFound('Dossier introuvable.');

    const input = parseBody(folderUpdateSchema, req.body);
    const parentId = input.parentId === undefined ? folder.parentId : input.parentId;

    if (input.parentId !== undefined && input.parentId !== null && !getFolder(db, input.parentId)) {
      throw ApiError.badRequest('Dossier parent introuvable.');
    }
    if (input.parentId !== undefined && wouldCycle(db, folder.id, input.parentId)) {
      throw ApiError.badRequest("Un dossier ne peut pas être rangé dans lui-même.");
    }

    const name = input.name ?? folder.name;
    const twin = findSibling(db, parentId, name);
    if (twin && twin !== folder.id) {
      throw ApiError.conflict('Un dossier porte déjà ce nom à cet endroit.');
    }

    updateFolder(db, folder.id, input);
    res.json({ folders: listFolders(db) });
  });

  router.delete('/:id', (req, res) => {
    const folder = getFolder(db, req.params.id ?? '');
    if (!folder) throw ApiError.notFound('Dossier introuvable.');

    // Jamais de suppression en cascade : rien ne disparait par surprise.
    if (folder.documentCount > 0 || folder.subfolderCount > 0) {
      throw ApiError.conflict('Ce dossier n’est pas vide : videz-le avant de le supprimer.', {
        documentCount: folder.documentCount,
        subfolderCount: folder.subfolderCount,
      });
    }

    deleteFolder(db, folder.id);
    res.json({ folders: listFolders(db) });
  });

  return router;
}
