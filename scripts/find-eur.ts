import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const file = process.argv[2];
const sheetName = process.argv[3];
if (!file || !sheetName) {
  // eslint-disable-next-line no-console
  console.error('Usage: tsx scripts/find-eur.ts <xls-path> <sheet-name>');
  process.exit(1);
}

const wb = XLSX.read(readFileSync(file), { type: 'buffer', cellDates: true });
const sheet = wb.Sheets[sheetName];
if (!sheet) {
  // eslint-disable-next-line no-console
  console.error('Sheet not found:', sheetName);
  process.exit(1);
}

const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
  header: 1,
  raw: true,
  defval: null,
});

// eslint-disable-next-line no-console
console.log(`Total rows: ${rows.length}`);
// eslint-disable-next-line no-console
console.log('Row 7 (anchor candidate):', JSON.stringify(rows[7]));
// eslint-disable-next-line no-console
console.log('Row 8 (sub-header):', JSON.stringify(rows[8]));

for (let i = 0; i < rows.length; i++) {
  const row = rows[i]!;
  const hasEur = row.some(
    (c) => typeof c === 'string' && c.trim().toUpperCase() === 'EUR',
  );
  if (hasEur) {
    // eslint-disable-next-line no-console
    console.log(`EUR row ${i}:`, JSON.stringify(row));
  }
}
