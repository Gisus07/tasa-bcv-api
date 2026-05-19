/**
 * Application-specific errors. Each one carries an HTTP status and a stable
 * `code` consumed by the central error handler and by API clients.
 */

export type ErrorCode =
  | 'INVALID_DATE_FORMAT'
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
      `Invalid date format: "${value}" (expected YYYY-MM-DD)`,
      { value },
    );
  }
}

export class DateOutOfRangeError extends AppError {
  constructor(date: string, maxDate: string) {
    super(
      'DATE_OUT_OF_RANGE',
      400,
      `Date ${date} is in the future. Max allowed is ${maxDate}.`,
      { date, maxDate },
    );
  }
}

export class DateBeforeHistoryError extends AppError {
  constructor(date: string, minDate: string, currency: string) {
    super(
      'DATE_BEFORE_HISTORY',
      400,
      `No historical data available for ${currency} before ${minDate}. Requested: ${date}.`,
      { date, minDate, currency },
    );
  }
}

export class InvalidRangeError extends AppError {
  constructor(from: string, to: string) {
    super(
      'INVALID_RANGE',
      400,
      `Invalid range: "from" (${from}) must be on or before "to" (${to}).`,
      { from, to },
    );
  }
}

export class RangeTooLargeError extends AppError {
  constructor(days: number, maxDays: number) {
    super(
      'RANGE_TOO_LARGE',
      400,
      `Requested range of ${days} days exceeds the maximum of ${maxDays} days.`,
      { days, maxDays },
    );
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super('NOT_FOUND', 404, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Missing or invalid credentials') {
    super('UNAUTHORIZED', 401, message);
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super('RATE_LIMITED', 429, 'Too many requests', { retryAfterSeconds });
  }
}

export class UpstreamFormatError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('UPSTREAM_FORMAT', 502, `BCV upstream format issue: ${message}`, details);
  }
}

export class UpstreamUnavailableError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('UPSTREAM_UNAVAILABLE', 502, `BCV upstream unavailable: ${message}`, details);
  }
}

export class DatabaseDownError extends AppError {
  constructor(cause?: unknown) {
    super('DB_DOWN', 503, 'Database is unreachable', { cause: String(cause ?? '') });
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
    body: { error: 'Internal server error', code: 'INTERNAL' },
  };
}
