import * as XLSX from 'xlsx';
import * as path from 'path';

async function main() {
  const filePath = path.resolve(__dirname, '../testing/SalesDost Working Store Matched.xlsx');
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  console.log('Total rows in matched Excel:', data.length);
  console.log('Sample matched rows:');
  console.log(JSON.stringify(data.slice(0, 5), null, 2));
}

main().catch(console.error);
