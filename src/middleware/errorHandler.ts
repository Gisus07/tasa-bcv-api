import type { Context, ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { AppError, toErrorResponse, type ErrorCode } from '../lib/errors.js';
import { logger } from '../logger.js';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Centralized error handler. Maps:
 *  - AppError subclasses → their `code` + `httpStatus`
 *  - ZodError (manual throws) → 400 INVALID_INPUT
 *  - hono HTTPException → the status hono chose
 *  - anything else → 500 INTERNAL (logged with stack)
 */
export const errorHandler: ErrorHandler = (err, c: Context) => {
  if (err instanceof AppError) {
    const { status, body } = toErrorResponse(err);
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
    return c.json(
      {
        error: err.message || 'Solicitud fallida',
        code: 'INTERNAL' satisfies ErrorCode,
      },
      err.status,
    );
  }

  // Unknown error — log full stack, return generic message.
  logger().error({ err: err instanceof Error ? { message: err.message, stack: err.stack } : err }, 'unhandled error');
  return c.json(
    { error: 'Error interno del servidor', code: 'INTERNAL' satisfies ErrorCode },
    500,
  );
};
