import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { Db } from './db.js';
import { trustProxySetting, type Env } from './env.js';
import { apiNotFoundHandler, createErrorHandler } from './errors.js';
import { requireSession } from './auth/middleware.js';
import { createAuthRouter } from './routes/auth.js';
import { createDocumentsRouter } from './routes/documents.js';
import { createFoldersRouter } from './routes/folders.js';
import { createHealthRouter } from './routes/health.js';
import { createJournalRouter } from './routes/journal.js';
import { createLinksRouter } from './routes/links.js';
import { createMilestonesRouter } from './routes/milestones.js';
import { createTasksRouter } from './routes/tasks.js';
import { createUsersRouter } from './routes/users.js';
import { createWeeklyRouter } from './routes/weekly.js';

/** Front compile, depose par le build de client/ dans server/dist/public. */
export const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'public');

export interface AppOptions {
  db: Db;
  env: Env;
}

export function createApp({ db, env }: AppOptions): Express {
  const isProduction = env.NODE_ENV === 'production';
  const sessionContext = { db, secret: env.SESSION_SECRET, secureCookies: isProduction };

  const app = express();

  // req.ip doit etre l'IP du visiteur, pas celle du reverse proxy : la
  // limitation du login compte par IP.
  app.set('trust proxy', trustProxySetting(env.TRUST_PROXY));
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // 'unsafe-inline' : styles en ligne poses par React et framer-motion.
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'same-origin' },
    }),
  );

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').send('User-agent: *\nDisallow: /\n');
  });

  const api = express.Router();
  api.use('/health', createHealthRouter(db));
  api.use('/auth', createAuthRouter(sessionContext));

  // Tout le reste de l'API exige une session valide.
  api.use(requireSession(sessionContext));
  api.use('/users', createUsersRouter(db));
  api.use('/milestones', createMilestonesRouter(db));
  api.use('/tasks', createTasksRouter(db));
  api.use('/documents', createDocumentsRouter(db, env.DOCUMENTS_DIR));
  api.use('/folders', createFoldersRouter(db));
  api.use('/journal', createJournalRouter(db));
  api.use('/weekly', createWeeklyRouter(db));
  api.use('/links', createLinksRouter(db));
  api.use(apiNotFoundHandler);

  app.use('/api', api);

  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir, { index: false, maxAge: isProduction ? '1h' : 0 }));

    // Toutes les routes du front sont servies par le meme index.html.
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      res.sendFile(path.join(publicDir, 'index.html'));
    });
  }

  app.use(createErrorHandler(isProduction));

  return app;
}
