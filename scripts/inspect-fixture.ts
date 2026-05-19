/** One-off inspector. Run with: pnpm tsx scripts/inspect-fixture.ts <path> */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';

const file = process.argv[2];
if (!file) {
  // eslint-disable-next-line no-console
  console.error('Usage: tsx scripts/inspect-fixture.ts <path>');
  process.exit(1);
}

const buf = readFileSync(resolve(file));
const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });

// eslint-disable-next-line no-console
console.log(`File: ${file}`);
// eslint-disable-next-line no-console
console.log(`Sheets (${wb.SheetNames.length}): ${wb.SheetNames.join(', ')}`);

for (const sheetName of wb.SheetNames) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) continue;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  // eslint-disable-next-line no-console
  console.log(`\n--- Sheet: ${sheetName} (${rows.length} rows) ---`);
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    // eslint-disable-next-line no-console
    console.log(`Row ${i}:`, rows[i]);
  }
  if (rows.length > 8) {
    // eslint-disable-next-line no-console
    console.log('...');
    // eslint-disable-next-line no-console
    console.log(`Row ${rows.length - 2}:`, rows[rows.length - 2]);
    // eslint-disable-next-line no-console
    console.log(`Row ${rows.length - 1}:`, rows[rows.length - 1]);
  }
}
