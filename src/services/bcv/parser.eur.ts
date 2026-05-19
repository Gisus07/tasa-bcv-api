import * as XLSX from 'xlsx';
import { parseBCVDate } from '../../lib/dates.js';
import { UpstreamFormatError } from '../../lib/errors.js';
import type { RateRecord } from './types.js';

const SHEET_NAME_IS_DATE = /^\d{8}$/; // DDMMYYYY (e.g. 14052026)

const FECHA_VALOR_RE = /Fecha\s+Valor:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i;
const FECHA_OPERACION_RE = /Fecha\s+Operacion:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i;

/**
 * Parses the BCV "Otras Monedas" quarterly workbook (e.g. `2_1_2b26_otrasmonedas.xls`).
 *
 * Structure:
 * - One sheet per business day, sheet name = `DDMMYYYY` (Fecha Operación).
 * - Each sheet declares "Fecha Operacion" and "Fecha Valor" near the top.
 * - Currencies are listed as rows; the EUR row sits at a stable position.
 *   Column layout:
 *     [0] ISO code (e.g. "EUR")
 *     [1] Country
 *     [2] Compra BID (M.E./US$)
 *     [3] Venta ASK (M.E./US$)
 *     [4] Compra BID (Bs./M.E.)
 *     [5] Venta ASK (Bs./M.E.)  ← canonical published rate
 *
 * The function derives the application date from `Fecha Valor` (not the sheet
 * name), since the sheet name is the operation date and the BCV rule maps
 * each operation to the next applicable business day.
 */
export function parseEurWorkbook(buffer: Buffer, sourceFile: string): RateRecord[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const records: RateRecord[] = [];

  for (const sheetName of wb.SheetNames) {
    if (!SHEET_NAME_IS_DATE.test(sheetName)) continue;
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
    });

    const { applicationDate, publishedAt } = extractDates(rows, sheetName);
    const eurRate = extractEurVentaBs(rows, sheetName);

    records.push({
      date: applicationDate,
      currency: 'EUR',
      rate: eurRate.toFixed(8),
      sourceFile: `${sourceFile}#${sheetName}`,
      publishedAt,
    });
  }

  return records;
}

function extractDates(
  rows: unknown[][],
  sheetName: string,
): { applicationDate: string; publishedAt: string } {
  let fechaValor: string | undefined;
  let fechaOperacion: string | undefined;

  for (const row of rows) {
    for (const cell of row) {
      if (typeof cell !== 'string') continue;
      if (!fechaValor) {
        const m = cell.match(FECHA_VALOR_RE);
        if (m) fechaValor = parseBCVDate(m[1]!);
      }
      if (!fechaOperacion) {
        const m = cell.match(FECHA_OPERACION_RE);
        if (m) fechaOperacion = parseBCVDate(m[1]!);
      }
      if (fechaValor && fechaOperacion) break;
    }
    if (fechaValor && fechaOperacion) break;
  }

  if (!fechaValor) {
    throw new UpstreamFormatError(
      `EUR parser: "Fecha Valor" missing in sheet "${sheetName}"`,
      { sheet: sheetName },
    );
  }
  if (!fechaOperacion) {
    // Fall back to the sheet name (DDMMYYYY) if "Fecha Operacion" was
    // unparseable; we keep going since `applicationDate` is what matters.
    fechaOperacion = sheetNameToIso(sheetName);
  }

  return { applicationDate: fechaValor, publishedAt: fechaOperacion };
}

function extractEurVentaBs(rows: unknown[][], sheetName: string): number {
  for (const row of rows) {
    if (typeof row[0] !== 'string') continue;
    if (row[0].trim().toUpperCase() !== 'EUR') continue;

    const venta = row[5];
    if (typeof venta !== 'number' || !Number.isFinite(venta) || venta <= 0) {
      throw new UpstreamFormatError(
        `EUR parser: EUR row found but Venta (Bs./M.E.) is invalid in sheet "${sheetName}"`,
        { sheet: sheetName, value: venta },
      );
    }
    return venta;
  }
  throw new UpstreamFormatError(
    `EUR parser: EUR row not found in sheet "${sheetName}"`,
    { sheet: sheetName },
  );
}

function sheetNameToIso(name: string): string {
  const dd = name.slice(0, 2);
  const mm = name.slice(2, 4);
  const yyyy = name.slice(4);
  return `${yyyy}-${mm}-${dd}`;
}
