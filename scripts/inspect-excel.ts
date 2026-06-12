import * as XLSX from 'xlsx';
import * as path from 'path';

async function main() {
  const inputPath = path.resolve(__dirname, '../testing/Final Sheet-Sales Store.xlsx');
  console.log(`Reading Excel file from: ${inputPath}`);
  const workbook = XLSX.readFile(inputPath);
  console.log('All Sheet Names:', workbook.SheetNames);

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data: any[] = XLSX.utils.sheet_to_json(worksheet);
  console.log(`Total rows in ${sheetName}: ${data.length}`);

  const allKeys = new Set<string>();
  for (const row of data) {
    for (const key of Object.keys(row)) {
      allKeys.add(key);
    }
  }
  console.log('All keys across all rows:', Array.from(allKeys));

  // Let's search for "Store ID" or "ID" or "NA" in the columns
  const idLikeColumns = Array.from(allKeys).filter(k => k.toLowerCase().includes('id') || k.toLowerCase().includes('store'));
  console.log('Columns containing "ID" or "Store":', idLikeColumns);

  // Let's print the first 20 rows that have "NA" in any of these columns, or count the values
  for (const col of idLikeColumns) {
    let naCount = 0;
    let emptyCount = 0;
    let valuesSample = new Set<string>();
    for (const row of data) {
      const val = row[col];
      if (val === undefined || val === null || String(val).trim() === '') {
        emptyCount++;
      } else if (String(val).trim().toUpperCase() === 'NA' || String(val).trim().toUpperCase() === 'N/A') {
        naCount++;
      } else {
        if (valuesSample.size < 5) {
          valuesSample.add(String(val));
        }
      }
    }
    console.log(`Column "${col}": Empty count = ${emptyCount}, NA/N/A count = ${naCount}, Sample non-NA values:`, Array.from(valuesSample));
  }
}

main().catch(console.error);
