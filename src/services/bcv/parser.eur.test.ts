import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { parseEurWorkbook, parseEurWorkbookSafe } from './parser.eur.js';

const fixture = readFileSync(resolve('fixtures/2_1_2b26_otrasmonedas.xls'));
const fixture2021 = readFileSync(resolve('fixtures/2_1_2d21_otrasmonedas.xls'));
const fixture2020 = readFileSync(resolve('fixtures/2_1_2d20_otrasmonedas.xls'));
const fixture2020Q1 = readFileSync(resolve('fixtures/2_1_2a20_otrasmonedas.xls'));

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

describe('parseEurWorkbook (early 2020 layout: "Bs.S/M.E" — bolívar soberano)', () => {
  it('parses Q1 2020 where the anchor uses the legacy "Bs.S" prefix', () => {
    // Pre-redenomination naming: the bolívar was "Bs.S" (Soberano) and the
    // Bs./M.E. header included an extra "S": "Bs.S/M.E". Today it would be
    // "Bs./M.E.". The anchor regex must accept both.
    const records = parseEurWorkbook(fixture2020Q1, '2_1_2a20_otrasmonedas.xls');
    expect(records.length).toBeGreaterThan(40);

    // Spot-check 26/03/2020 → Fecha Valor 27/03/2020 → EUR Venta 81349.02768139.
    const target = records.find((r) => r.date === '2020-03-27');
    expect(target).toBeDefined();
    expect(target?.currency).toBe('EUR');
    expect(target?.rate).toBe('81349.02768139');
    expect(target?.publishedAt).toBe('2020-03-26');
  });
});

describe('parseEurWorkbookSafe', () => {
  it('returns parsed records plus a list of skipped sheets without throwing', () => {
    const { records, skipped } = parseEurWorkbookSafe(fixture, '2_1_2b26_otrasmonedas.xls');
    expect(records.length).toBeGreaterThan(20);
    expect(Array.isArray(skipped)).toBe(true);
    // Our healthy Q2 2026 fixture should not skip anything.
    expect(skipped).toEqual([]);
  });

  it('skips a date-named sheet missing "Fecha Valor" instead of throwing', () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['sin fecha valor'], ['EUR', 'x', 1, 1, 1, 1]]);
    XLSX.utils.book_append_sheet(wb, ws, '01012026');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xls' }) as Buffer;

    const { records, skipped } = parseEurWorkbookSafe(buf, 'bad.xls');
    expect(records).toEqual([]);
    expect(skipped).toHaveLength(1);
    expect(skipped[0]?.sheet).toBe('01012026');
    expect(skipped[0]?.reason).toMatch(/Fecha Valor/i);
  });
});
