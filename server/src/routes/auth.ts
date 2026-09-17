import { Router } from 'express';
import { loginInputSchema } from '@quorex/shared';
import type { Db } from '../db.js';
import { ApiError, parseBody } from '../errors.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { RateLimiter } from '../auth/rate-limit.js';
import { currentUser, requireSession, type SessionContext } from '../auth/middleware.js';
import {
  SESSION_COOKIE,
  clearSessionCookie,
  createSession,
  destroySession,
  setSessionCookie,
  toSessionUser,
} from '../auth/sessions.js';

interface UserRow {
  id: string;
  login: string;
  display_name: string;
  password_hash: string;
}

export function createAuthRouter(context: SessionContext, limiter: RateLimiter = new RateLimiter()): Router {
  const { db, secret, secureCookies } = context;
  const router = Router();

  router.post('/login', async (req, res) => {
    const ip = req.ip ?? 'inconnue';
    const verdict = limiter.consume(ip);
    if (!verdict.allowed) {
      res.setHeader('Retry-After', String(verdict.retryAfterSeconds));
      throw ApiError.rateLimited('Trop de tentatives de connexion. Reessayez plus tard.', {
        retryAfterSeconds: verdict.retryAfterSeconds,
      });
    }

    const input = parseBody(loginInputSchema, req.body);

    const user = findUserByLogin(db, input.login);
    if (!user) {
      // Meme cout de calcul que pour un login connu : pas d'enumeration des comptes.
      await hashPassword(input.password);
      throw ApiError.unauthorized('Identifiants invalides.');
    }

    const ok = await verifyPassword(user.password_hash, input.password);
    if (!ok) {
      throw ApiError.unauthorized('Identifiants invalides.');
    }

    limiter.reset(ip);

    const session = createSession(db, secret, user.id);
    setSessionCookie(res, session.token, session.expiresAt, secureCookies);

    res.status(200).json({ user: toSessionUser(user) });
  });

  router.post('/logout', (req, res) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string' && token.length > 0) {
      destroySession(db, secret, token);
    }
    clearSessionCookie(res, secureCookies);
    res.status(204).end();
  });

  router.get('/me', requireSession(context), (req, res) => {
    res.status(200).json({ user: currentUser(req) });
  });

  return router;
}

function findUserByLogin(db: Db, login: string): UserRow | undefined {
  return db
    .prepare<[string], UserRow>(
      'SELECT id, login, display_name, password_hash FROM users WHERE login = ?',
    )
    .get(login);
}
