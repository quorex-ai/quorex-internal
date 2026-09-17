import type { AllowedDocumentMimeType } from '@quorex/shared';

/**
 * Detection du type reel d'un fichier a partir de son contenu.
 * L'extension et l'en-tete Content-Type envoyes par le client ne sont jamais crus.
 */

const PDF = Buffer.from('%PDF-');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/** Les formats Office sont des archives zip : on regarde ce qu'il y a dedans. */
const DOCX_MARKER = Buffer.from('word/');
const XLSX_MARKER = Buffer.from('xl/');

export interface DetectedType {
  mimeType: AllowedDocumentMimeType;
  extension: string;
}

export function detectDocumentType(content: Buffer): DetectedType | null {
  if (content.subarray(0, PDF.length).equals(PDF)) {
    return { mimeType: 'application/pdf', extension: '.pdf' };
  }

  if (content.subarray(0, PNG.length).equals(PNG)) {
    return { mimeType: 'image/png', extension: '.png' };
  }

  if (content.subarray(0, JPEG.length).equals(JPEG)) {
    return { mimeType: 'image/jpeg', extension: '.jpg' };
  }

  if (content.subarray(0, ZIP.length).equals(ZIP)) {
    // Les noms d'entrees du zip apparaissent en clair dans l'archive.
    if (content.includes(DOCX_MARKER)) {
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extension: '.docx',
      };
    }
    if (content.includes(XLSX_MARKER)) {
      return {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        extension: '.xlsx',
      };
    }
  }

  return null;
}

/**
 * Nom d'origine nettoye pour l'en-tete Content-Disposition : ni chemin,
 * ni caractere de controle, ni guillemet.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'document';
  const cleaned = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : 'document';
}
