const XLSX = require("xlsx");
const path = require("path");

function inspect() {
  const filePath = path.join(process.cwd(), "testing", "Final Sheet-Sales Store Existing_And_New.xlsx");
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

      // Let's filter some rows where Store ID is new
      const newStores = data.filter(row => String(row['Store ID'] || '').toLowerCase().includes('new'));
      console.log("Number of stores with 'new' in Store ID:", newStores.length);
      if (newStores.length > 0) {
        console.log("Sample new stores:", JSON.stringify(newStores.slice(0, 2), null, 2));
      }

      // Check some stores that have numeric/existing Store ID
      const existingStores = data.filter(row => {
        const id = String(row['Store ID'] || '').trim();
        return id !== '' && !id.toLowerCase().includes('new');
      });
      console.log("Number of existing stores:", existingStores.length);
      if (existingStores.length > 0) {
        console.log("Sample existing stores:", JSON.stringify(existingStores.slice(0, 2), null, 2));
      }
    } else {
      console.log("Sheet is empty");
    }
  }
}

inspect();
