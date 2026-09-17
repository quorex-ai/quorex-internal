import { randomBytes } from 'node:crypto';

/**
 * UUID v7 : 48 bits d'horodatage en millisecondes, 4 bits de version,
 * 12 bits de compteur, 2 bits de variante, 62 bits aleatoires.
 *
 * Le compteur rend les identifiants strictement croissants a l'interieur d'une
 * meme milliseconde : deux lignes de journal ecrites dans le meme battement se
 * relisent dans l'ordre ou elles ont ete ecrites.
 */
let lastMs = -1;
let sequence = 0;

export function uuidv7(now: number = Date.now()): string {
  if (now > lastMs) {
    lastMs = now;
    sequence = 0;
  } else {
    // Meme milliseconde, ou horloge qui recule : on avance le compteur.
    sequence += 1;
    if (sequence > 0x0fff) {
      lastMs += 1;
      sequence = 0;
    }
    now = lastMs;
  }

  const bytes = randomBytes(16);

  bytes[0] = (now / 2 ** 40) & 0xff;
  bytes[1] = (now / 2 ** 32) & 0xff;
  bytes[2] = (now / 2 ** 24) & 0xff;
  bytes[3] = (now / 2 ** 16) & 0xff;
  bytes[4] = (now / 2 ** 8) & 0xff;
  bytes[5] = now & 0xff;

  bytes[6] = 0x70 | ((sequence >> 8) & 0x0f);
  bytes[7] = sequence & 0xff;
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}
