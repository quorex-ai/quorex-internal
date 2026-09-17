import argon2, { type HashOptions } from 'argon2';

/** Parametres argon2id : profil recommande OWASP (19 Mio, 2 passes). */
const OPTIONS: HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Hash illisible ou tronque : on refuse, sans distinguer le cas pour l'appelant.
    return false;
  }
}
