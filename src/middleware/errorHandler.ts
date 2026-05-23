import type { Context, ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { env } from '../env.js';
import { AppError, toErrorResponse, type ErrorCode } from '../lib/errors.js';
import { logger } from '../logger.js';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Centralized error handler. Maps:
 *  - AppError subclasses → their `code` + `httpStatus`
 *  - ZodError (manual throws) → 400 VALIDATION_ERROR
 *  - hono HTTPException → the status hono chose
 *  - anything else → 500 INTERNAL (logged with stack)
 */
export const errorHandler: ErrorHandler = (err, c: Context) => {
  if (err instanceof AppError) {
    const { status, body } = toErrorResponse(err);
    if (status >= 500) {
      // Full detail to the logs; never ship internal details (DB cause,
      // upstream stack) to clients in production (SEC-3).
      logger().error({ code: body.code, details: err.details }, 'server-side AppError');
      if (env().NODE_ENV === 'production') delete body.details;
    }
    return c.json(body, status as ContentfulStatusCode);
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'Entrada inválida',
        code: 'VALIDATION_ERROR' satisfies ErrorCode,
        details: { issues: err.issues },
      },
      400,
    );
  }

  if (err instanceof HTTPException) {
    // Map hono's status to our stable code instead of always 'INTERNAL' (BE-6).
    const code: ErrorCode =
      err.status === 404
        ? 'NOT_FOUND'
        : err.status === 401
          ? 'UNAUTHORIZED'
          : err.status === 429
            ? 'RATE_LIMITED'
            : err.status >= 400 && err.status < 500
              ? 'VALIDATION_ERROR'
              : 'INTERNAL';
    return c.json({ error: err.message || 'Solicitud fallida', code }, err.status);
  }

  // Unknown error — log full stack, return generic message.
  logger().error(
    { err: err instanceof Error ? { message: err.message, stack: err.stack } : err },
    'unhandled error',
  );
  return c.json(
    { error: 'Error interno del servidor', code: 'INTERNAL' satisfies ErrorCode },
    500,
  );
};
