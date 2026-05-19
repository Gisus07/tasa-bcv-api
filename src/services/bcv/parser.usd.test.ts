import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseUsdWorkbook } from './parser.usd.js';

const fixture = readFileSync(resolve('fixtures/2_1_1_tdc.xlsx'));

describe('parseUsdWorkbook', () => {
  const records = parseUsdWorkbook(fixture, '2_1_1_tdc.xlsx');

  it('matches the known reference value (14 May 2026)', () => {
    const target = records.find((r) => r.date === '2026-05-14');
    expect(target).toBeDefined();
    expect(target?.currency).toBe('USD');
    expect(target?.rate).toBe('510.78730000');
    expect(target?.sourceFile).toBe('2_1_1_tdc.xlsx#2026');
  });

  it('produces a sizable history (≥ 1000 records across years)', () => {
    expect(records.length).toBeGreaterThan(1000);
  });

  it('returns only valid records (date matches YYYY-MM-DD, rate is positive)', () => {
    for (const r of records) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.currency).toBe('USD');
      expect(Number(r.rate)).toBeGreaterThan(0);
    }
  });

  it('skips the Module1 VBA sheet', () => {
    // sourceFile is sheet-qualified, so a Module1-derived record would surface here.
    expect(records.find((r) => r.sourceFile.endsWith('#Module1'))).toBeUndefined();
  });

  it('covers every year sheet present in the workbook (2016 → 2026)', () => {
    const yearsSeen = new Set<string>();
    for (const r of records) {
      const year = r.sourceFile.split('#')[1]!;
      yearsSeen.add(year);
    }
    for (let y = 2016; y <= 2026; y++) {
      expect(yearsSeen.has(String(y))).toBe(true);
    }
  });

  it('records are unique per (date, currency)', () => {
    const seen = new Set<string>();
    for (const r of records) {
      const key = `${r.date}:${r.currency}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});
