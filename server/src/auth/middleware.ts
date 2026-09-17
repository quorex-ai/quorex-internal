import type { RequestHandler } from 'express';
import type { SessionUser } from '@quorex/shared';
import type { Db } from '../db.js';
import { ApiError } from '../errors.js';
import { SESSION_COOKIE, resolveSession, setSessionCookie } from './sessions.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      sessionToken?: string;
    }
  }
}

export interface SessionContext {
  db: Db;
  secret: string;
  secureCookies: boolean;
}

/**
 * Exige une session valide. Prolonge le cookie quand la session a ete prolongee,
 * et repond 401 sinon : le front redirige alors vers /login.
 */
export function requireSession({ db, secret, secureCookies }: SessionContext): RequestHandler {
  return (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      next(ApiError.unauthorized());
      return;
    }

    const session = resolveSession(db, secret, token);
    if (!session) {
      next(ApiError.unauthorized());
      return;
    }

    setSessionCookie(res, token, session.expiresAt, secureCookies);
    req.user = session.user;
    req.sessionToken = token;
    next();
  };
}

/** Utilisateur de la requete, une fois requireSession passe. */
export function currentUser(req: { user?: SessionUser }): SessionUser {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
