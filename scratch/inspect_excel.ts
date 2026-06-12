import * as XLSX from 'xlsx';
import * as path from 'path';

const filePath = path.join(process.cwd(), 'newdelete.xlsx');
console.log('Loading workbook from:', filePath);
const workbook = XLSX.readFile(filePath);
const sheetNames = workbook.SheetNames;
console.log('Sheet Names:', sheetNames);

if (sheetNames.length > 0) {
  const firstSheetName = sheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('Total rows:', jsonData.length);
  console.log('Headers (first row):', jsonData[0]);
  console.log('Sample rows (1 to 5):', jsonData.slice(1, 6));
}
