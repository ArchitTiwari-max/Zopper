const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'SalesDost Working Store with Tiers.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Total Rows in Output:', data.length);
if (data.length > 0) {
  console.log('Columns in Output:', Object.keys(data[0]));
  console.log('First 5 rows:');
  console.log(JSON.stringify(data.slice(0, 5), null, 2));
}
