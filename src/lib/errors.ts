/**
 * Application-specific errors. Each one carries an HTTP status and a stable
 * `code` consumed by the central error handler and by API clients.
 */

export type ErrorCode =
  | 'INVALID_DATE_FORMAT'
  | 'VALIDATION_ERROR'
  | 'DATE_OUT_OF_RANGE'
  | 'DATE_BEFORE_HISTORY'
  | 'INVALID_RANGE'
  | 'RANGE_TOO_LARGE'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_FORMAT'
  | 'UPSTREAM_UNAVAILABLE'
  | 'DB_DOWN'
  | 'INTERNAL';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    httpStatus: number,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export class InvalidDateFormatError extends AppError {
  constructor(value: string) {
    super(
      'INVALID_DATE_FORMAT',
      400,
      `Formato de fecha inválido: "${value}" (se esperaba YYYY-MM-DD)`,
      { value },
    );
  }
}

export class DateOutOfRangeError extends AppError {
  constructor(date: string, maxDate: string) {
    super(
      'DATE_OUT_OF_RANGE',
      400,
      `La fecha ${date} está en el futuro. Máxima permitida: ${maxDate}.`,
      { date, maxDate },
    );
  }
}

export class DateBeforeHistoryError extends AppError {
  constructor(date: string, minDate: string, currency: string) {
    super(
      'DATE_BEFORE_HISTORY',
      400,
      `No hay datos históricos para ${currency} antes de ${minDate}. Solicitado: ${date}.`,
      { date, minDate, currency },
    );
  }
}

export class InvalidRangeError extends AppError {
  constructor(from: string, to: string) {
    super(
      'INVALID_RANGE',
      400,
      `Rango inválido: "from" (${from}) debe ser igual o anterior a "to" (${to}).`,
      { from, to },
    );
  }
}

export class RangeTooLargeError extends AppError {
  constructor(days: number, maxDays: number) {
    super(
      'RANGE_TOO_LARGE',
      400,
      `El rango solicitado de ${days} días excede el máximo de ${maxDays} días.`,
      { days, maxDays },
    );
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super('NOT_FOUND', 404, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Credenciales faltantes o inválidas') {
    super('UNAUTHORIZED', 401, message);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super('RATE_LIMITED', 429, 'Demasiadas solicitudes', { retryAfterSeconds });
  }
}

export class UpstreamFormatError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      'UPSTREAM_FORMAT',
      502,
      `Problema de formato en la fuente del BCV: ${message}`,
      details,
    );
  }
}

export class UpstreamUnavailableError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(
      'UPSTREAM_UNAVAILABLE',
      502,
      `Fuente del BCV no disponible: ${message}`,
      details,
    );
  }
}

/** Serializa una causa `unknown` de catch sin caer en `[object Object]`. */
function describeCause(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === 'string') return cause;
  try {
    return JSON.stringify(cause) ?? '';
  } catch {
    return '';
  }
}

export class DatabaseDownError extends AppError {
  constructor(cause?: unknown) {
    super('DB_DOWN', 503, 'Base de datos no disponible', {
      cause: describeCause(cause),
    });
  }
}

export function toErrorResponse(err: unknown): {
  status: number;
  body: { error: string; code: ErrorCode; details?: Record<string, unknown> };
} {
  if (err instanceof AppError) {
    return {
      status: err.httpStatus,
      body: {
        error: err.message,
        code: err.code,
        ...(err.details ? { details: err.details } : {}),
      },
    };
  }
  return {
    status: 500,
    body: { error: 'Error interno del servidor', code: 'INTERNAL' },
  };
}
