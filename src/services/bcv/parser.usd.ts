import * as XLSX from 'xlsx';
import { parseBCVDate } from '../../lib/dates.js';
import { UpstreamFormatError } from '../../lib/errors.js';
import type { RateRecord } from './types.js';

const SHEET_NAME_IS_YEAR = /^\d{4}$/;

/**
 * Parses the BCV USD history workbook (`2_1_1_tdc.xlsx`).
 *
 * Structure:
 * - One sheet per year (2016, 2017, ..., 2026) plus a `Module1` VBA sheet to ignore.
 * - Each sheet has a 3-column data block with header [FECHA, COMPRA, VENTA].
 * - FECHA is a real Excel date; VENTA is the official rate (Bs per 1 USD).
 *
 * The function is tolerant of trailing blank rows, missing data within a sheet,
 * and small layout drift (it locates the header row by content, not by index).
 */
export function parseUsdWorkbook(
  buffer: Buffer,
  sourceFile: string,
): RateRecord[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const records: RateRecord[] = [];

  for (const sheetName of wb.SheetNames) {
    if (!SHEET_NAME_IS_YEAR.test(sheetName)) continue;
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
    });

    const { fechaCol, ventaCol, dataStart } = locateColumns(rows, sheetName);

    for (let i = dataStart; i < rows.length; i++) {
      const row = rows[i]!;
      const fechaCell = row[fechaCol];
      const ventaCell = row[ventaCol];
      const iso = cellToIso(fechaCell);
      if (!iso) continue;
      if (
        typeof ventaCell !== 'number' ||
        !Number.isFinite(ventaCell) ||
        ventaCell <= 0
      ) {
        continue;
      }
      records.push({
        date: iso,
        currency: 'USD',
        rate: ventaCell.toFixed(8),
        sourceFile: `${sourceFile}#${sheetName}`,
      });
    }
  }

  return records;
}

function locateColumns(
  rows: unknown[][],
  sheetName: string,
): { fechaCol: number; ventaCol: number; dataStart: number } {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const fechaCol = row.findIndex(
      (c) => typeof c === 'string' && /^\s*fecha\s*$/i.test(c),
    );
    const ventaCol = row.findIndex(
      (c) => typeof c === 'string' && /^\s*venta\s*$/i.test(c),
    );
    if (fechaCol >= 0 && ventaCol >= 0) {
      return { fechaCol, ventaCol, dataStart: i + 1 };
    }
  }
  throw new UpstreamFormatError(
    `USD parser: header row not found in sheet "${sheetName}"`,
    { sheet: sheetName },
  );
}

/**
 * Normalize a cell value to an ISO date string, or return `null` to skip it.
 *
 * The newer sheets store dates as real Excel datetimes (SheetJS hands them to
 * us as `Date` at Caracas midnight, expressed in UTC); the 2016 sheet stores
 * them as `"DD/MM/YYYY"` strings instead. Both shapes are accepted.
 */
function cellToIso(cell: unknown): string | null {
  if (cell instanceof Date) {
    const year = cell.getUTCFullYear();
    const month = String(cell.getUTCMonth() + 1).padStart(2, '0');
    const day = String(cell.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof cell === 'string' && cell.trim() !== '') {
    try {
      return parseBCVDate(cell);
    } catch {
      return null;
    }
  }
  return null;
}
