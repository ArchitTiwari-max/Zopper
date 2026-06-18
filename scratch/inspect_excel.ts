import * as XLSX from 'xlsx';

function inspectExcel(filename: string) {
  try {
    console.log(`\n--- Inspecting ${filename} ---`);
    const workbook = XLSX.readFile(filename);
    console.log("Sheet names:", workbook.SheetNames);
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet);
      console.log(`Sheet "${sheetName}" has ${data.length} rows.`);
      if (data.length > 0) {
        console.log("Keys of first row:", Object.keys(data[0] as object));
        console.log("First 3 rows of data:");
        console.log(JSON.stringify(data.slice(0, 3), null, 2));
      }
    }
  } catch (err: any) {
    console.error(`Error reading ${filename}:`, err.message);
  }
}

inspectExcel("store_export_2026-06-08.xlsx");
inspectExcel("src/querryRunner/user/users.xlsx");
inspectExcel("Final Sheet-Sales Store (1).xlsx");
inspectExcel("newdelete.xlsx");
inspectExcel("stores-export-2026-06-15 (2).xlsx");
