import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEurWorkbook } from './parser.eur.js';

const fixture = readFileSync(resolve('fixtures/2_1_2b26_otrasmonedas.xls'));

describe('parseEurWorkbook', () => {
  const records = parseEurWorkbook(fixture, '2_1_2b26_otrasmonedas.xls');

  it('matches the known reference value (Fecha Valor 14 May 2026)', () => {
    // The "Fecha Valor 14/05/2026" sits in the sheet whose operation date is 13/05/2026.
    const target = records.find((r) => r.date === '2026-05-14');
    expect(target).toBeDefined();
    expect(target?.currency).toBe('EUR');
    expect(target?.rate).toBe('598.12171255');
    expect(target?.sourceFile).toBe('2_1_2b26_otrasmonedas.xls#13052026');
    expect(target?.publishedAt).toBe('2026-05-13');
  });

  it('returns one record per business-day sheet (≈ 30 for Q2 2026 to date)', () => {
    expect(records.length).toBeGreaterThan(20);
    expect(records.length).toBeLessThan(70);
  });

  it('all records have valid shape', () => {
    for (const r of records) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.currency).toBe('EUR');
      expect(Number(r.rate)).toBeGreaterThan(0);
      expect(r.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('publishedAt is always strictly before the application date', () => {
    for (const r of records) {
      expect(r.publishedAt).toBeDefined();
      // ISO strings sort lexicographically same as chronologically.
      expect(r.publishedAt! < r.date).toBe(true);
    }
  });

  it('records are unique per application date', () => {
    const seen = new Set<string>();
    for (const r of records) {
      expect(seen.has(r.date)).toBe(false);
      seen.add(r.date);
    }
  });
});
