import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

function splitExcel() {
  const inputPath = path.join(process.cwd(), "testing", "List of Stores-Salesdost (1).xlsx");
  console.log("Reading file:", inputPath);
  
  if (!fs.existsSync(inputPath)) {
    console.error("Input file does not exist at:", inputPath);
    return;
  }
  
  const workbook = XLSX.readFile(inputPath);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  
  // Use header: 1 to get array of arrays (rows)
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  
  if (rows.length === 0) {
    console.error("No data found in the Excel sheet.");
    return;
  }
  
  const headers = rows[0];
  console.log("Headers:", headers);
  
  const storeIdIndex = headers.indexOf("Store ID");
  if (storeIdIndex === -1) {
    console.error("Could not find 'Store ID' column in headers.");
    return;
  }
  
  console.log(`'Store ID' column found at index: ${storeIdIndex}`);
  
  const withStoreId: any[][] = [headers];
  const withoutStoreId: any[][] = [headers];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const val = row[storeIdIndex];
    const hasStoreId = val !== undefined && val !== null && String(val).trim() !== "";
    
    if (hasStoreId) {
      withStoreId.push(row);
    } else {
      withoutStoreId.push(row);
    }
  }
  
  console.log(`Total rows (excluding headers): ${rows.length - 1}`);
  console.log(`Rows with Store ID: ${withStoreId.length - 1}`);
  console.log(`Rows without Store ID: ${withoutStoreId.length - 1}`);
  
  // Write to separate files
  const outputDir = path.join(process.cwd(), "testing");
  
  const withPath = path.join(outputDir, "List of Stores-With-StoreID.xlsx");
  const withoutPath = path.join(outputDir, "List of Stores-Without-StoreID.xlsx");
  const splitPath = path.join(outputDir, "List of Stores-Split-Sheets.xlsx");
  
  // 1. Write file with Store ID
  const wbWith = XLSX.utils.book_new();
  const wsWith = XLSX.utils.aoa_to_sheet(withStoreId);
  XLSX.utils.book_append_sheet(wbWith, wsWith, "With Store ID");
  XLSX.writeFile(wbWith, withPath);
  console.log("Saved file with Store IDs to:", withPath);
  
  // 2. Write file without Store ID
  const wbWithout = XLSX.utils.book_new();
  const wsWithout = XLSX.utils.aoa_to_sheet(withoutStoreId);
  XLSX.utils.book_append_sheet(wbWithout, wsWithout, "Without Store ID");
  XLSX.writeFile(wbWithout, withoutPath);
  console.log("Saved file without Store IDs to:", withoutPath);
  
  // 3. Write file with both sheets
  const wbSplit = XLSX.utils.book_new();
  const wsWithCopy = XLSX.utils.aoa_to_sheet(withStoreId);
  const wsWithoutCopy = XLSX.utils.aoa_to_sheet(withoutStoreId);
  XLSX.utils.book_append_sheet(wbSplit, wsWithCopy, "With Store ID");
  XLSX.utils.book_append_sheet(wbSplit, wsWithoutCopy, "Without Store ID");
  XLSX.writeFile(wbSplit, splitPath);
  console.log("Saved combined split-sheets file to:", splitPath);
  
  console.log("All tasks completed successfully!");
}

splitExcel();
