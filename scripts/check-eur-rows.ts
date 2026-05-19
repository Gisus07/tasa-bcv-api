import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';

const path = process.argv[2];
if (!path) {
  // eslint-disable-next-line no-console
  console.error('Usage: tsx scripts/check-eur-rows.ts <xls-path>');
  process.exit(1);
}

const wb = XLSX.read(readFileSync(path), { type: 'buffer', cellDates: true });
// eslint-disable-next-line no-console
console.log(`Total sheets: ${wb.SheetNames.length}`);

let withEur = 0;
let withoutEur = 0;
const noEurDates: string[] = [];

for (const sheetName of wb.SheetNames) {
  if (!/^\d{8}$/.test(sheetName)) continue;
  const sheet = wb.Sheets[sheetName];
  if (!sheet) continue;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  let found = false;
  for (const row of rows) {
    for (const cell of row) {
      if (typeof cell === 'string' && cell.trim().toUpperCase() === 'EUR') {
        found = true;
        break;
      }
    }
    if (found) break;
  }
  if (found) withEur++;
  else {
    withoutEur++;
    noEurDates.push(sheetName);
  }
}

// eslint-disable-next-line no-console
console.log(`With EUR: ${withEur}`);
// eslint-disable-next-line no-console
console.log(`Without EUR: ${withoutEur}`);
if (noEurDates.length > 0) {
  // eslint-disable-next-line no-console
  console.log('No EUR sheets:', noEurDates);
}
