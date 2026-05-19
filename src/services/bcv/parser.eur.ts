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
  // Column layout drifts across BCV file versions: older files (2020-2021)
  // have a blank leading column, so "EUR" is at index 1 and Venta Bs at
  // index 6, while newer files (2024+) put them at 0 and 5. Locate both
  // dynamically using the "Bs./M.E." header as an anchor.
  const ventaCol = findVentaBsColumn(rows);
  if (ventaCol === -1) {
    throw new UpstreamFormatError(
      `EUR parser: "Venta (ASK)" column for Bs./M.E. not found in sheet "${sheetName}"`,
      { sheet: sheetName },
    );
  }

  for (const row of rows) {
    const codeCell = row.find(
      (c) => typeof c === 'string' && c.trim().toUpperCase() === 'EUR',
    );
    if (codeCell === undefined) continue;

    const venta = row[ventaCol];
    if (typeof venta !== 'number' || !Number.isFinite(venta) || venta <= 0) {
      throw new UpstreamFormatError(
        `EUR parser: EUR row found but Venta (Bs./M.E.) is invalid in sheet "${sheetName}"`,
        { sheet: sheetName, value: venta, ventaCol },
      );
    }
    return venta;
  }
  throw new UpstreamFormatError(
    `EUR parser: EUR row not found in sheet "${sheetName}"`,
    { sheet: sheetName },
  );
}

/**
 * Locates the "Venta (ASK)" column that belongs to the "Bs./M.E." group.
 *
 * The BCV layout uses two anchors:
 *   - A higher row contains the group label "Bs./M.E." in some column.
 *   - The next non-empty row contains the per-group "Compra (BID)" /
 *     "Venta (ASK)" sub-headers.
 *
 * The Venta we want is the *second* occurrence of "Venta (ASK)" — the one
 * at or to the right of the Bs./M.E. anchor column. The first occurrence
 * is the M.E./US$ group, which we don't store.
 */
function findVentaBsColumn(rows: unknown[][]): number {
  let bsAnchorCol = -1;
  let bsAnchorRow = -1;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      // The trailing period after "M.E" is present from 2021 onward but
      // omitted in 2020 files. Match both spellings.
      if (typeof cell === 'string' && /^\s*Bs\.\s*\/\s*M\.E\.?\s*$/i.test(cell)) {
        bsAnchorCol = c;
        bsAnchorRow = r;
        break;
      }
    }
    if (bsAnchorRow !== -1) break;
  }
  if (bsAnchorRow === -1) return -1;

  for (let r = bsAnchorRow + 1; r < rows.length; r++) {
    const row = rows[r]!;
    for (let c = bsAnchorCol; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell === 'string' && /Venta\s*\(ASK\)/i.test(cell)) {
        return c;
      }
    }
  }
  return -1;
}

function sheetNameToIso(name: string): string {
  const dd = name.slice(0, 2);
  const mm = name.slice(2, 4);
  const yyyy = name.slice(4);
  return `${yyyy}-${mm}-${dd}`;
}
