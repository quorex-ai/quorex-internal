import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestContext, sessionCookie, TEST_PASSWORD, type TestContext } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const TEXT = Buffer.from('Un simple fichier texte, renommé en .pdf.\n');

/** Archive zip minimale contenant une entree word/, comme un vrai .docx. */
function fakeDocx(): Buffer {
  const name = Buffer.from('word/document.xml');
  const content = Buffer.from('<document/>');
  const crc = zlib.crc32 ? zlib.crc32(content) : 0;

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(content.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(name.length, 26);

  return Buffer.concat([localHeader, name, content]);
}

describe('coffre', () => {
  let context: TestContext;
  let directory: string;
  let cookie: string;

  beforeEach(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'quorex-test-'));
    fs.mkdirSync(path.join(directory, 'documents'), { recursive: true, mode: 0o700 });
    context = await createTestContext(path.join(directory, 'documents'));

    const login = await request(context.app)
      .post('/api/auth/login')
      .send({ login: 'clement', password: TEST_PASSWORD });
    cookie = sessionCookie(login.headers['set-cookie'] as unknown as string[]);
  });

  afterEach(() => {
    context.db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const upload = (file: Buffer, filename: string, contentType: string): request.Test =>
    request(context.app)
      .post('/api/documents')
      .set('Cookie', cookie)
      .field('title', 'Contrat de prestation')
      .field('type', 'contract')
      .field('parties', 'QUOREX / ACME')
      .field('tags', 'contrat, acme')
      .attach('file', file, { filename, contentType });

  it('accepte un PDF et le stocke sous un nom généré', async () => {
    const response = await upload(PDF, 'contrat signé.pdf', 'application/pdf');

    expect(response.status).toBe(201);
    expect(response.body.document.mimeType).toBe('application/pdf');
    expect(response.body.document.tags).toEqual(['contrat', 'acme']);

    const files = fs.readdirSync(context.documentsDir);
    expect(files).toHaveLength(1);
    // Le nom d'origine ne touche jamais le disque.
    expect(files[0]).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect(files[0]).not.toContain('contrat');
  });

  it('reconnait un docx a son contenu, pas a son extension', async () => {
    const response = await request(context.app)
      .post('/api/documents')
      .set('Cookie', cookie)
      .field('title', 'Devis')
      .field('type', 'quote')
      .attach('file', fakeDocx(), { filename: 'devis.bin', contentType: 'application/octet-stream' });

    expect(response.status).toBe(201);
    expect(response.body.document.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(fs.readdirSync(context.documentsDir)[0]).toMatch(/\.docx$/);
  });

  it('refuse un fichier texte renommé en .pdf, malgré son en-tête', async () => {
    const response = await upload(TEXT, 'faux.pdf', 'application/pdf');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(fs.readdirSync(context.documentsDir)).toHaveLength(0);
  });

  it('ne laisse télécharger qu’avec une session valide', async () => {
    const created = await upload(PNG, 'scan.png', 'image/png');
    const id = String(created.body.document.id);

    const anonymous = await request(context.app).get(`/api/documents/${id}/download`);
    expect(anonymous.status).toBe(401);

    const forged = await request(context.app)
      .get(`/api/documents/${id}/download`)
      .set('Cookie', 'quorex_session=jeton-invente');
    expect(forged.status).toBe(401);

    const allowed = await request(context.app).get(`/api/documents/${id}/download`).set('Cookie', cookie);
    expect(allowed.status).toBe(200);
    expect(allowed.headers['content-disposition']).toBe('attachment; filename="scan.png"');
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
  });

  it('ne sert jamais le dossier des documents, ni son contenu', async () => {
    await upload(PDF, 'contrat.pdf', 'application/pdf');
    const stored = fs.readdirSync(context.documentsDir)[0] ?? '';

    const direct = await request(context.app).get(`/documents/${stored}`);
    // Aucune route ne sert le fichier : au mieux le front, jamais l'octet.
    expect(direct.headers['content-type'] ?? '').not.toContain('application/pdf');

    const traversal = await request(context.app)
      .get('/api/documents/..%2F..%2Fetc%2Fpasswd/download')
      .set('Cookie', cookie);
    expect(traversal.status).toBe(404);
  });

  it('range un document dans un dossier sans perdre ses autres métadonnées', async () => {
    const created = await upload(PDF, 'contrat.pdf', 'application/pdf');
    const id = String(created.body.document.id);

    const folder = await request(context.app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: 'Contrats' });
    const folderId = String(folder.body.folder.id);

    // Seul le dossier est envoyé : parties et tags doivent survivre.
    const moved = await request(context.app)
      .patch(`/api/documents/${id}`)
      .set('Cookie', cookie)
      .send({ folderId });

    expect(moved.status).toBe(200);
    expect(moved.body.document.folderPath).toBe('Contrats');
    expect(moved.body.document.parties).toBe('QUOREX / ACME');
    expect(moved.body.document.tags).toEqual(['contrat', 'acme']);
    expect(moved.body.document.title).toBe('Contrat de prestation');
  });

  it('refuse de supprimer un dossier qui n’est pas vide', async () => {
    const folder = await request(context.app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: 'Factures' });
    const folderId = String(folder.body.folder.id);

    const created = await upload(PDF, 'facture.pdf', 'application/pdf');
    await request(context.app)
      .patch(`/api/documents/${String(created.body.document.id)}`)
      .set('Cookie', cookie)
      .send({ folderId })
      .expect(200);

    const refused = await request(context.app).delete(`/api/folders/${folderId}`).set('Cookie', cookie);

    expect(refused.status).toBe(409);
    expect(refused.body.error.details.documentCount).toBe(1);
  });

  it('refuse un dossier rangé dans lui-même ou dans son enfant', async () => {
    const parent = await request(context.app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: 'Parent' });
    const parentId = String(parent.body.folder.id);

    const child = await request(context.app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: 'Enfant', parentId });
    const childId = String(child.body.folder.id);

    const cycle = await request(context.app)
      .patch(`/api/folders/${parentId}`)
      .set('Cookie', cookie)
      .send({ parentId: childId });

    expect(cycle.status).toBe(400);

    const twin = await request(context.app)
      .post('/api/folders')
      .set('Cookie', cookie)
      .send({ name: 'parent' });
    expect(twin.status).toBe(409);
  });

  it('supprime la ligne, le fichier, et le note au journal', async () => {
    const created = await upload(PDF, 'contrat.pdf', 'application/pdf');
    const id = String(created.body.document.id);

    await request(context.app).delete(`/api/documents/${id}`).set('Cookie', cookie).expect(204);

    expect(fs.readdirSync(context.documentsDir)).toHaveLength(0);

    const entries = context.db
      .prepare<[], { field: string; old_value: string | null }>(
        "SELECT field, old_value FROM journal WHERE entity_type = 'document' ORDER BY at ASC",
      )
      .all();

    expect(entries.map((entry) => entry.field)).toEqual(['created', 'deleted']);
    expect(entries[1]?.old_value).toBe('Contrat de prestation');
  });
});
