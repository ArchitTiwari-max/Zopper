import * as XLSX from "xlsx";
import { sendMail } from "./mailer"; // your mail utility
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface ExcelRow {
  email?: string;
  username?: string;
  name?: string;
}

async function main(): Promise<void> {
  // Read Excel file
  const workbook = XLSX.readFile("src/querryRunner/user/users.xlsx");
  const sheetName = workbook.SheetNames[0];
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json<ExcelRow>(workbook.Sheets[sheetName]);

  // ⚠️ rows[0] corresponds to Excel row 2 (since row 1 = header)
  const startRow = 25; // Excel row number where you want to start
  const endRow = 26;  // Excel row number where you want to stop

  // Convert Excel rows into array slice
  const selectedRows = rows.slice(startRow - 2, endRow - 1);

  for (const row of selectedRows) {
    if (!row.email || !row.username) continue; // skip invalid rows

    const username = row.username;
    const password = "testex@12"; // default password

    const emailBody = `
      <p>Dear ${row.name || "Executive"},</p>
      <p>Your account has been created. Please find your login credentials below:</p>
      <ul>
        <li><b>Username:</b> ${username}</li>
        <li><b>Password:</b> ${password}</li>
      </ul>
      <p>Please keep this information safe and change your password after login.</p>
      <p>Regards,<br/>Support Team</p>
    `;

    try {
      await sendMail(row.email, "SalesDost Account Credentials", emailBody);
    } catch (err) {
      console.error(`❌ Failed to send email to ${row.email}`, err);
    }
  }
}

main().catch((err) => console.error("Unexpected error:", err));
