import * as XLSX from 'xlsx';

function inspectUsersXlsx() {
  const workbook = XLSX.readFile("src/querryRunner/user/users.xlsx");
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log("Total rows:", data.length);
  if (data.length > 0) {
    console.log("Keys:", Object.keys(data[0] as object));
    console.log("Unique roles in excel:", [...new Set(data.map((r: any) => r.role))]);
    // Let's print rows where manager is mentioned, if any
    for (const r of data as any[]) {
      const keys = Object.keys(r);
      const managerKey = keys.find(k => k.toLowerCase().includes('manager'));
      const subKey = keys.find(k => k.toLowerCase().includes('subordinate'));
      if (managerKey || subKey) {
        console.log(`Row has manager/subordinate key:`, managerKey, subKey);
        break;
      }
    }
    // Let's inspect first 10 rows
    console.log("First 10 rows:");
    console.log(JSON.stringify(data.slice(0, 10), null, 2));
  }
}

inspectUsersXlsx();
