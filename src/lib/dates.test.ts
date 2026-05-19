import { describe, it, expect } from 'vitest';
import {
  todayCaracas,
  parseBCVDate,
  isValidISODate,
  addDays,
  diffDays,
  iterateDays,
  isoDayOfWeek,
  isWeekend,
  getApplicationDate,
} from './dates.js';

describe('todayCaracas', () => {
  it('returns YYYY-MM-DD for a fixed UTC instant', () => {
    // 2026-05-19T03:00:00Z = 2026-05-18 23:00:00 Caracas (UTC-4)
    const before = new Date('2026-05-19T03:00:00Z');
    expect(todayCaracas(before)).toBe('2026-05-18');

    const after = new Date('2026-05-19T04:00:01Z');
    expect(todayCaracas(after)).toBe('2026-05-19');
  });
});

describe('parseBCVDate', () => {
  it('parses DD/MM/YYYY into YYYY-MM-DD', () => {
    expect(parseBCVDate('14/05/2026')).toBe('2026-05-14');
    expect(parseBCVDate('1/1/2016')).toBe('2016-01-01');
    expect(parseBCVDate('  31/12/2025  ')).toBe('2025-12-31');
  });

  it('throws on invalid format', () => {
    expect(() => parseBCVDate('2026-05-14')).toThrow();
    expect(() => parseBCVDate('14-05-2026')).toThrow();
    expect(() => parseBCVDate('hola')).toThrow();
  });

  it('throws on impossible dates', () => {
    expect(() => parseBCVDate('31/02/2026')).toThrow();
    expect(() => parseBCVDate('00/05/2026')).toThrow();
    expect(() => parseBCVDate('15/13/2026')).toThrow();
  });
});

describe('isValidISODate', () => {
  it('accepts real Gregorian dates', () => {
    expect(isValidISODate('2026-05-14')).toBe(true);
    expect(isValidISODate('2024-02-29')).toBe(true); // leap
  });
  it('rejects malformed strings and impossible dates', () => {
    expect(isValidISODate('2026-5-14')).toBe(false);
    expect(isValidISODate('2025-02-29')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('not-a-date')).toBe(false);
  });
});

describe('addDays', () => {
  it('moves forward and backward across month boundaries', () => {
    expect(addDays('2026-05-14', 1)).toBe('2026-05-15');
    expect(addDays('2026-05-31', 1)).toBe('2026-06-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('handles leap years correctly', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });
});

describe('diffDays', () => {
  it('returns the inclusive day count between two ISO dates', () => {
    expect(diffDays('2026-05-14', '2026-05-14')).toBe(0);
    expect(diffDays('2026-05-14', '2026-05-19')).toBe(5);
    expect(diffDays('2026-05-19', '2026-05-14')).toBe(-5);
  });
  it('handles year boundaries', () => {
    expect(diffDays('2025-12-31', '2026-01-01')).toBe(1);
  });
});

describe('iterateDays', () => {
  it('yields each day in the inclusive range', () => {
    const days = [...iterateDays('2026-05-14', '2026-05-18')];
    expect(days).toEqual([
      '2026-05-14',
      '2026-05-15',
      '2026-05-16',
      '2026-05-17',
      '2026-05-18',
    ]);
  });
  it('yields a single day when from === to', () => {
    expect([...iterateDays('2026-05-14', '2026-05-14')]).toEqual(['2026-05-14']);
  });
});

describe('isoDayOfWeek', () => {
  it('uses ISO weekdays where Monday=1 ... Sunday=7', () => {
    expect(isoDayOfWeek('2026-05-18')).toBe(1); // Monday
    expect(isoDayOfWeek('2026-05-15')).toBe(5); // Friday
    expect(isoDayOfWeek('2026-05-16')).toBe(6); // Saturday
    expect(isoDayOfWeek('2026-05-17')).toBe(7); // Sunday
  });
});

describe('isWeekend', () => {
  it('returns true only for Saturday and Sunday', () => {
    expect(isWeekend('2026-05-15')).toBe(false); // Friday
    expect(isWeekend('2026-05-16')).toBe(true); // Sat
    expect(isWeekend('2026-05-17')).toBe(true); // Sun
    expect(isWeekend('2026-05-18')).toBe(false); // Mon
  });
});

describe('getApplicationDate', () => {
  it('shifts a Friday announcement to the following Monday', () => {
    expect(getApplicationDate('2026-05-15')).toBe('2026-05-18');
  });
  it('shifts a non-Friday weekday announcement to the next day', () => {
    expect(getApplicationDate('2026-05-14')).toBe('2026-05-15'); // Thu → Fri
    expect(getApplicationDate('2026-05-18')).toBe('2026-05-19'); // Mon → Tue
  });
  // BCV never publishes on weekends, but the function should be well-defined.
  it('shifts weekend dates by one day (degenerate case)', () => {
    expect(getApplicationDate('2026-05-16')).toBe('2026-05-17'); // Sat → Sun
    expect(getApplicationDate('2026-05-17')).toBe('2026-05-18'); // Sun → Mon
  });
});
