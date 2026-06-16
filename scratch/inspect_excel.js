const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'SalesDost Working Store.xlsx');
const workbook = XLSX.readFile(filePath);

// Get the first sheet name
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get data as JSON
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Sheet Name:', sheetName);
console.log('Total Rows:', data.length);
if (data.length > 0) {
  console.log('Columns:', Object.keys(data[0]));
  console.log('First 3 rows:');
  console.log(JSON.stringify(data.slice(0, 3), null, 2));
} else {
  console.log('No data found in sheet.');
}
