const XLSX = require("xlsx");
const path = require("path");

// Output path
const outputPath = path.join(
  __dirname,
  "../public/templates/godrej-sfdc-template.xlsx"
);

// Create a new workbook
const wb = XLSX.utils.book_new();

// Header row 1 (main headers) - row 1 is the "complex" header that gets ignored by the importer
// Header row 2 (actual headers used by the importer) - this is what the parser reads as column names
const headerRow1 = ["Plan Id", "Phone", "ContractBookingID", "Customer Name"];
const headerRow2 = ["", "", "", ""];

// Sample data rows to show expected format
const sampleRows = [
  ["PLN-001", "9876543210", "CTR-20240001", "Ramesh Kumar"],
  ["PLN-002", "9123456789", "CTR-20240002", "Sunita Sharma"],
  ["PLN-003", "8800112233", "CTR-20240003", ""],
];

// Build sheet data: row1 = headers, row2 = sub-headers (empty), then sample rows
const sheetData = [headerRow1, headerRow2, ...sampleRows];

const ws = XLSX.utils.aoa_to_sheet(sheetData);

// Set column widths for readability
ws["!cols"] = [
  { wch: 18 }, // Plan Id
  { wch: 16 }, // Phone
  { wch: 22 }, // ContractBookingID
  { wch: 24 }, // Customer Name
];

// Style the header row (row index 0) — xlsx-style is not available by default,
// so we add a comment to each header cell to explain the field
const headerComments = {
  A1: "Required. The Plan ID for the Godrej SFDC record.",
  B1: "Required. Customer mobile phone number.",
  C1: "Required. The Contract Booking ID.",
  D1: "Optional. Customer full name.",
};

for (const [cell, comment] of Object.entries(headerComments)) {
  if (ws[cell]) {
    ws[cell].c = [{ a: "SalesDost", t: comment }];
  }
}

// Append the worksheet to the workbook
XLSX.utils.book_append_sheet(wb, ws, "Godrej SFDC Data");

// Write the file
XLSX.writeFile(wb, outputPath);

console.log("✅ Template updated successfully at:", outputPath);
console.log(
  "   Columns: Plan Id | Phone | ContractBookingID | Customer Name"
);
