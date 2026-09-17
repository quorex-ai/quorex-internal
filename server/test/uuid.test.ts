import { describe, expect, it } from 'vitest';
import { uuidv7 } from '../src/lib/uuid.js';

describe('uuid v7', () => {
  it('a la bonne forme, la bonne version et la bonne variante', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('croit strictement, meme a l’interieur d’une milliseconde', () => {
    const ids = Array.from({ length: 5000 }, () => uuidv7());
    const sorted = [...ids].sort();

    expect(ids).toEqual(sorted);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('reste croissant si l’horloge recule', () => {
    const before = uuidv7(1_800_000_000_000);
    const after = uuidv7(1_700_000_000_000);

    expect(after > before).toBe(true);
  });

  it('porte l’horodatage demande quand il avance', () => {
    // Superieur a tout ce que les cas precedents ont pose : le compteur ne bride pas.
    const stamp = 2_000_000_000_000;
    const id = uuidv7(stamp);
    const millis = Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16);

    expect(millis).toBe(stamp);
  });
});
