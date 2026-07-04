const XLSX = require('xlsx');
const wb = XLSX.readFile('Xiaomi_Jul-26.xlsx');
const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
const blank = data.filter(r => !r.RetailerName || r.RetailerName.toString().trim().toLowerCase() === 'blank' || r.RetailerName.toString().trim() === '');
console.log('Blank/empty rows:', JSON.stringify(blank, null, 2));
console.log('Total blank rows:', blank.length);
