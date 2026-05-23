import { describe, it, expect, beforeAll } from 'vitest';
import {
  enumerateEurQuarters,
  eurQuarterUrl,
  eurUrlForDate,
  monthToQuarterLetter,
} from './urls.js';

beforeAll(() => {
  // urls.ts reads env() for the EUR URL template; env requires DATABASE_URL.
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
});

describe('monthToQuarterLetter', () => {
  it('maps each month to its BCV quarter letter', () => {
    expect([1, 2, 3].map(monthToQuarterLetter)).toEqual(['a', 'a', 'a']);
    expect([4, 5, 6].map(monthToQuarterLetter)).toEqual(['b', 'b', 'b']);
    expect([7, 8, 9].map(monthToQuarterLetter)).toEqual(['c', 'c', 'c']);
    expect([10, 11, 12].map(monthToQuarterLetter)).toEqual(['d', 'd', 'd']);
  });

  it('throws on out-of-range months', () => {
    expect(() => monthToQuarterLetter(0)).toThrow();
    expect(() => monthToQuarterLetter(13)).toThrow();
  });
});

describe('eurQuarterUrl', () => {
  it('builds the quarterly file name from year + quarter', () => {
    expect(eurQuarterUrl(2026, 'b')).toContain('2_1_2b26_otrasmonedas.xls');
    expect(eurQuarterUrl(2020, 'a')).toContain('2_1_2a20_otrasmonedas.xls');
  });

  it('rejects implausible years', () => {
    expect(() => eurQuarterUrl(1999, 'a')).toThrow();
    expect(() => eurQuarterUrl(2101, 'a')).toThrow();
  });
});

describe('eurUrlForDate', () => {
  it('derives the quarter file from an ISO date', () => {
    expect(eurUrlForDate('2026-05-14')).toContain('2_1_2b26_otrasmonedas.xls');
    expect(eurUrlForDate('2020-01-15')).toContain('2_1_2a20_otrasmonedas.xls');
    expect(eurUrlForDate('2021-12-31')).toContain('2_1_2d21_otrasmonedas.xls');
    expect(eurUrlForDate('2024-07-01')).toContain('2_1_2c24_otrasmonedas.xls');
  });
});

describe('enumerateEurQuarters', () => {
  it('yields 4 quarters per year, in order, inclusive of both bounds', () => {
    const items = [...enumerateEurQuarters(2020, 2021)];
    expect(items).toHaveLength(8);
    expect(items[0]).toMatchObject({ year: 2020, quarter: 'a' });
    expect(items[3]).toMatchObject({ year: 2020, quarter: 'd' });
    expect(items[4]).toMatchObject({ year: 2021, quarter: 'a' });
    expect(items[7]).toMatchObject({ year: 2021, quarter: 'd' });
  });
});
