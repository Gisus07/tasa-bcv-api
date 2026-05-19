import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEurWorkbook } from './parser.eur.js';

const fixture = readFileSync(resolve('fixtures/2_1_2b26_otrasmonedas.xls'));
const fixture2021 = readFileSync(resolve('fixtures/2_1_2d21_otrasmonedas.xls'));
const fixture2020 = readFileSync(resolve('fixtures/2_1_2d20_otrasmonedas.xls'));

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

describe('parseEurWorkbook (legacy 2021 layout with leading blank column)', () => {
  it('locates the Venta Bs./M.E. column dynamically and parses every sheet', () => {
    // The 2_1_2d21 file has a blank leading column, so EUR is in col 1 and
    // Venta Bs in col 6 instead of 0 and 5. The parser must handle both.
    const records = parseEurWorkbook(fixture2021, '2_1_2d21_otrasmonedas.xls');
    expect(records.length).toBeGreaterThan(40);

    // Spot-check the last business day of 2021: sheet 30122021 has
    // Fecha Valor 03/01/2022 and EUR Venta = 5.2115698.
    const target = records.find((r) => r.date === '2022-01-03');
    expect(target).toBeDefined();
    expect(target?.currency).toBe('EUR');
    expect(target?.rate).toBe('5.21156980');
    expect(target?.sourceFile).toBe('2_1_2d21_otrasmonedas.xls#30122021');
    expect(target?.publishedAt).toBe('2021-12-30');
  });
});

describe('parseEurWorkbook (2020 layout: "Bs./M.E" without trailing period)', () => {
  it('parses Q4 2020 despite the anchor missing its trailing period', () => {
    // R 7 in these sheets is "Bs./M.E" (no period). Older 2021+ files spell it
    // "Bs./M.E." with a period. The anchor regex must accept either spelling.
    const records = parseEurWorkbook(fixture2020, '2_1_2d20_otrasmonedas.xls');
    expect(records.length).toBeGreaterThan(40);

    // Spot-check 23/10/2020 → Fecha Valor 26/10/2020 → EUR Venta 547555.99981734.
    const target = records.find((r) => r.date === '2020-10-26');
    expect(target).toBeDefined();
    expect(target?.currency).toBe('EUR');
    expect(target?.rate).toBe('547555.99981734');
    expect(target?.publishedAt).toBe('2020-10-23');
  });
});
