import * as XLSX from "xlsx";
import * as path from "path";

function inspect() {
  const filePath = path.join(process.cwd(), "testing", "List of Stores-Salesdost (1).xlsx");
  console.log("Reading file:", filePath);
  const workbook = XLSX.readFile(filePath);
  const sheetNames = workbook.SheetNames;
  console.log("Sheet names in workbook:", sheetNames);
  
  if (sheetNames.length > 0) {
    const sheet = workbook.Sheets[sheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    console.log("Total rows found:", data.length);
    if (data.length > 0) {
      console.log("Keys (Headers) of first row:");
      console.log(Object.keys(data[0]));
      console.log("First 3 rows of data:");
      console.log(JSON.stringify(data.slice(0, 3), null, 2));
    } else {
      console.log("Sheet is empty");
    }
  }
}

inspect();
