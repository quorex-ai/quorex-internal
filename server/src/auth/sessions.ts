import { createHmac, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import { SESSION_TTL_DAYS, type SessionUser } from '@quorex/shared';
import type { Db } from '../db.js';
import { addDays, nowIso } from '../lib/time.js';

export const SESSION_COOKIE = 'quorex_session';

/** Renouvelle la session quand il lui reste moins de 29 jours (30 jours glissants). */
const REFRESH_AFTER_DAYS = 1;

interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
}

interface UserRow {
  id: string;
  login: string;
  display_name: string;
}

/** La base ne stocke jamais le jeton du cookie, seulement son HMAC. */
function tokenId(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function toSessionUser(row: UserRow): SessionUser {
  return { id: row.id, login: row.login, displayName: row.display_name };
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export function createSession(db: Db, secret: string, userId: string): CreatedSession {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = addDays(new Date(), SESSION_TTL_DAYS);
  const at = nowIso();

  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(tokenId(token, secret), userId, nowIso(expiresAt), at, at);

  return { token, expiresAt };
}

export interface ResolvedSession {
  sessionId: string;
  user: SessionUser;
  expiresAt: Date;
}

/**
 * Retrouve la session d'un jeton de cookie. Supprime la session si elle est
 * expiree, et la prolonge de 30 jours si elle a plus d'un jour.
 */
export function resolveSession(db: Db, secret: string, token: string): ResolvedSession | null {
  const id = tokenId(token, secret);

  const session = db
    .prepare<[string], SessionRow>('SELECT id, user_id, expires_at FROM sessions WHERE id = ?')
    .get(id);
  if (!session) return null;

  const now = new Date();
  let expiresAt = new Date(session.expires_at);

  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return null;
  }

  const user = db
    .prepare<[string], UserRow>('SELECT id, login, display_name FROM users WHERE id = ?')
    .get(session.user_id);
  if (!user) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
    return null;
  }

  const renewedAt = addDays(now, SESSION_TTL_DAYS);
  if (renewedAt.getTime() - expiresAt.getTime() > REFRESH_AFTER_DAYS * 24 * 60 * 60 * 1000) {
    db.prepare('UPDATE sessions SET expires_at = ?, updated_at = ? WHERE id = ?').run(
      nowIso(renewedAt),
      nowIso(now),
      id,
    );
    expiresAt = renewedAt;
  }

  return { sessionId: id, user: toSessionUser(user), expiresAt };
}

export function destroySession(db: Db, secret: string, token: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(tokenId(token, secret));
}

export function deleteExpiredSessions(db: Db): number {
  return db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso()).changes;
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
  });
}
