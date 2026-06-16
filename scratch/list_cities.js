const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'SalesDost Working Store.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

const cities = new Set();
data.forEach(row => {
  if (row.City) {
    cities.add(row.City.trim());
  }
});

console.log('Total unique cities:', cities.size);
console.log('Cities list:', Array.from(cities).sort());
