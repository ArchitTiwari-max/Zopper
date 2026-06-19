import * as XLSX from 'xlsx';

function main() {
  const workbook = XLSX.readFile("store_export_2026-06-08.xlsx");
  console.log("Sheet names:", workbook.SheetNames);
  for (const s of workbook.SheetNames) {
    const sheet = workbook.Sheets[s];
    const data = XLSX.utils.sheet_to_json(sheet);
    console.log(`Sheet "${s}" has ${data.length} rows`);
    if (data.length > 0) {
      console.log("First row keys:", Object.keys(data[0] as object));
    }
  }
}

main();
