import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

/** Racine du depot, que le serveur tourne depuis src/ (tsx) ou dist/ (build). */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

dotenv.config({ path: path.join(repoRoot, '.env'), quiet: true });

/** Une variable vide dans .env vaut variable absente. */
function present(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4317),
  DATABASE_PATH: z.string().min(1).default(path.join(repoRoot, 'data', 'quorex-internal.db')),
  DOCUMENTS_DIR: z.string().min(1).default(path.join(repoRoot, 'data', 'documents')),
  BACKUP_DIR: z.string().min(1).default(path.join(repoRoot, 'data', 'backups')),
  SESSION_SECRET: z
    .string({ error: 'SESSION_SECRET est obligatoire' })
    .min(32, 'SESSION_SECRET doit faire au moins 32 caracteres'),
  /**
   * Reverse proxy de confiance, pour que req.ip soit l'IP reelle et que la
   * limitation du login compte par visiteur. « loopback » quand le proxy tourne
   * sur la machine (systemd), « 1 » quand il est dans un autre conteneur.
   */
  TRUST_PROXY: z.string().default('loopback'),
});

export type Env = z.infer<typeof envSchema>;

/** Sous-ensemble suffisant pour les scripts hors serveur (seed, sauvegarde). */
const storageSchema = envSchema.pick({
  NODE_ENV: true,
  DATABASE_PATH: true,
  DOCUMENTS_DIR: true,
  BACKUP_DIR: true,
});

export type StorageEnv = z.infer<typeof storageSchema>;

export function loadStorageEnv(source: NodeJS.ProcessEnv = process.env): StorageEnv {
  return parseOrThrow(storageSchema, {
    NODE_ENV: present(source.NODE_ENV),
    DATABASE_PATH: present(source.DATABASE_PATH),
    DOCUMENTS_DIR: present(source.DOCUMENTS_DIR),
    BACKUP_DIR: present(source.BACKUP_DIR),
  });
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return parseOrThrow(envSchema, {
    NODE_ENV: present(source.NODE_ENV),
    PORT: present(source.PORT),
    DATABASE_PATH: present(source.DATABASE_PATH),
    DOCUMENTS_DIR: present(source.DOCUMENTS_DIR),
    BACKUP_DIR: present(source.BACKUP_DIR),
    SESSION_SECRET: present(source.SESSION_SECRET),
    TRUST_PROXY: present(source.TRUST_PROXY),
  });
}

/** « 1 » devient le nombre 1, « false » le booleen : Express distingue les trois formes. */
export function trustProxySetting(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  return value;
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Configuration invalide, le serveur ne demarre pas :\n${details.join('\n')}`);
  }
  return parsed.data;
}
