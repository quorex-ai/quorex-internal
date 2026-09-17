import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ErrorCode } from '@quorex/shared';
import type { ZodType } from 'zod';

/** Erreur metier : tout ce qui sort de l'API a la forme { error: { code, message, details? } }. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Session absente ou expiree.'): ApiError {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static notFound(message = 'Ressource introuvable.'): ApiError {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, details?: unknown): ApiError {
    return new ApiError(409, 'CONFLICT', message, details);
  }

  static rateLimited(message: string, details?: unknown): ApiError {
    return new ApiError(429, 'RATE_LIMITED', message, details);
  }
}

/** Valide un corps de requete avec zod et renvoie 400 + details lisibles sinon. */
export function parseBody<T>(schema: ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw ApiError.badRequest(
      'Donnees invalides.',
      result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}

export const apiNotFoundHandler: RequestHandler = (_req, _res, next) => {
  next(ApiError.notFound("Cette route d'API n'existe pas."));
};

/** Les erreurs de multer arrivent avec leur propre forme : on les traduit. */
function fromUpload(err: unknown): ApiError | null {
  if (typeof err !== 'object' || err === null || !('name' in err) || err.name !== 'MulterError') return null;

  const code = 'code' in err ? String(err.code) : '';
  if (code === 'LIMIT_FILE_SIZE') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Fichier trop volumineux : 25 Mo maximum.');
  }
  return ApiError.badRequest("Envoi de fichier invalide.");
}

export function createErrorHandler(isProduction: boolean): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const uploadError = fromUpload(err);
    if (uploadError) {
      res.status(uploadError.status).json({
        error: { code: uploadError.code, message: uploadError.message },
      });
      return;
    }

    if (err instanceof ApiError) {
      res.status(err.status).json({
        error: {
          code: err.code,
          message: err.message,
          ...(err.details === undefined ? {} : { details: err.details }),
        },
      });
      return;
    }

    // Jamais de stack vers le client : elle part dans les logs du serveur.
    if (!isProduction) {
      console.error(err);
    } else {
      console.error('[api] erreur interne :', err instanceof Error ? err.message : err);
    }

    res.status(500).json({
      error: { code: 'INTERNAL', message: 'Erreur interne du serveur.' },
    });
  };
}
