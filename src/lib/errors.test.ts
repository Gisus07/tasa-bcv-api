import { describe, it, expect } from 'vitest';
import {
  AppError,
  DateBeforeHistoryError,
  DateOutOfRangeError,
  InvalidDateFormatError,
  InvalidRangeError,
  NotFoundError,
  RangeTooLargeError,
  RateLimitError,
  UnauthorizedError,
  UpstreamFormatError,
  toErrorResponse,
} from './errors.js';

describe('AppError subclasses', () => {
  it('InvalidDateFormatError carries the original value', () => {
    const err = new InvalidDateFormatError('14/05/2026');
    expect(err.httpStatus).toBe(400);
    expect(err.code).toBe('INVALID_DATE_FORMAT');
    expect(err.details).toEqual({ value: '14/05/2026' });
  });

  it('DateOutOfRangeError reports the offending date and the boundary', () => {
    const err = new DateOutOfRangeError('2030-01-01', '2026-05-20');
    expect(err.httpStatus).toBe(400);
    expect(err.code).toBe('DATE_OUT_OF_RANGE');
    expect(err.details).toEqual({ date: '2030-01-01', maxDate: '2026-05-20' });
  });

  it('DateBeforeHistoryError mentions the currency', () => {
    const err = new DateBeforeHistoryError('2015-01-01', '2016-01-04', 'USD');
    expect(err.code).toBe('DATE_BEFORE_HISTORY');
    expect(err.message).toContain('USD');
    expect(err.message).toContain('2016-01-04');
    expect(err.message).toContain('2015-01-01');
  });

  it('InvalidRangeError preserves bounds', () => {
    const err = new InvalidRangeError('2026-05-19', '2026-05-14');
    expect(err.code).toBe('INVALID_RANGE');
    expect(err.details).toEqual({ from: '2026-05-19', to: '2026-05-14' });
  });

  it('RangeTooLargeError carries the day count', () => {
    const err = new RangeTooLargeError(400, 365);
    expect(err.code).toBe('RANGE_TOO_LARGE');
    expect(err.details).toEqual({ days: 400, maxDays: 365 });
  });

  it('NotFoundError defaults to a generic message', () => {
    expect(new NotFoundError().httpStatus).toBe(404);
  });

  it('UnauthorizedError uses 401', () => {
    expect(new UnauthorizedError().httpStatus).toBe(401);
  });

  it('RateLimitError reports retry-after', () => {
    const err = new RateLimitError(42);
    expect(err.httpStatus).toBe(429);
    expect(err.details).toEqual({ retryAfterSeconds: 42 });
  });

  it('UpstreamFormatError is 502', () => {
    expect(new UpstreamFormatError('missing VENTA column').httpStatus).toBe(
      502,
    );
  });
});

describe('toErrorResponse', () => {
  it('maps AppError instances to {status, body}', () => {
    const err = new InvalidDateFormatError('not-a-date');
    const { status, body } = toErrorResponse(err);
    expect(status).toBe(400);
    expect(body.code).toBe('INVALID_DATE_FORMAT');
    expect(body.error).toContain('not-a-date');
    expect(body.details).toEqual({ value: 'not-a-date' });
  });

  it('falls back to 500 INTERNAL for unknown errors', () => {
    const { status, body } = toErrorResponse(new Error('boom'));
    expect(status).toBe(500);
    expect(body.code).toBe('INTERNAL');
    expect(body.error).toBe('Error interno del servidor');
    expect((body as { details?: unknown }).details).toBeUndefined();
  });

  it('falls back to 500 for non-Error throws', () => {
    expect(toErrorResponse('something').status).toBe(500);
    expect(toErrorResponse(null).status).toBe(500);
  });

  it('omits the details field when AppError has none', () => {
    const subclass = new (class extends AppError {
      constructor() {
        super('INTERNAL', 500, 'no details here');
      }
    })();
    const { body } = toErrorResponse(subclass);
    expect('details' in body).toBe(false);
  });
});
