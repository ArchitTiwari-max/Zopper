import nodemailer from "nodemailer";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Load HTML templates from public folder
const dailyVisitSummaryTemplate = fs.readFileSync(
  path.join(process.cwd(), 'public/email-templates/dailyVisitSummary.html'),
  'utf-8'
);

const visitNotificationTemplate = fs.readFileSync(
  path.join(process.cwd(), 'public/email-templates/visitNotification.html'),
  'utf-8'
);

// Create transporter once and reuse
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
console.log("Transporter created with user:", process.env.EMAIL_USER);
export async function sendMail(to: string, subject: string, html: string) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
    });

    console.log(`📧 Mail sent to ${to}, ID: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send mail to ${to}:`, error);
  }
}

/**
 * Send daily visit summary to hardcoded admin emails
 * This function sends all executives' visit data for the day
 * Each executive gets ONE row with all stores comma-separated and total visit count
 * @param visitData Array of visit data with executive name, stores (comma-separated), and total visit count
 */
export async function sendDailyVisitSummaryToAdmins(
  visitData: Array<{ executiveId: string; executiveName: string; storeName: string; visitCount: number }>
) {
  // const adminEmails = [
  //   'vishal.shukla@zopper.com',
  //    'bharat.kumar@zopper.com',
  //  'vikash.dubey@zopper.com',
  //  'amit.srivastava@zopper.com',
  //  'archit.tiwari@zopper.com',
  //  'harshdeep.singh@zopper.com',
  //  'assurance.tech@zopper.com'
  // ];
  const adminEmails=[
    'harshdeep.singh@zopper.com',
  ]
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create HTML table for all visits
  let tableRows = '';
  visitData.forEach((visit, index) => {
    let storesList = '';
    
    if (visit.storeName.trim()) {
      // Convert comma-separated stores to bullet list
      const stores = visit.storeName.split(',').map(s => s.trim());
      storesList = stores
        .map(store => `<li style="margin: 4px 0;">${store}</li>`)
        .join('');
    } else {
      // No visits today
      storesList = '<li style="margin: 4px 0; color: #999;">No visits today</li>';
    }

    tableRows += `
      <tr style="background-color: ${index % 2 === 0 ? '#f9f9f9' : '#ffffff'}; vertical-align: top;">
        <td style="padding: 12px; border: 1px solid #ddd;">${visit.executiveName}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">
          <ul style="margin: 0; padding-left: 20px;">
            ${storesList}
          </ul>
        </td>
        <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: #667eea;">
          <a href="https://salesdost.zopper.com/admin/visit-report?executiveId=${visit.executiveId}" style="color: #667eea; text-decoration: none; cursor: pointer;">
            ${visit.visitCount}
          </a>
        </td>
      </tr>
    `;
  });

  const totalVisits = visitData.reduce((sum, v) => sum + v.visitCount, 0);

  // Replace placeholders in template
  const html = dailyVisitSummaryTemplate
    .replace('{{DATE}}', today)
    .replace('{{TOTAL_VISITS}}', totalVisits.toString())
    .replace('{{TABLE_ROWS}}', tableRows);

  const subject = `📊 Daily Visit Summary - ${today}`;

  // Send to all admin emails
  for (const adminEmail of adminEmails) {
    await sendMail(adminEmail, subject, html);
  }

  console.log(`✅ Daily visit summary sent to ${adminEmails.length} admins`);
}

/**
 * Send visit notification to individual executive
 * This function sends the executive their own visit details
 * @param executiveEmail Executive's email address
 * @param executiveName Executive's name
 * @param storeName Store name visited
 * @param todayVisitCount Total visits by this executive today
 */
export async function sendVisitNotificationToExecutive(
  executiveEmail: string,
  executiveName: string,
  storeName: string,
  todayVisitCount: number
) {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let html = '';
  
  if (todayVisitCount === 0) {
    // No visits today - show a different message
    html = visitNotificationTemplate
      .replace('{{HEADER_TITLE}}', 'No Visits Today')
      .replace('{{STATUS_MESSAGE}}', 'No visits have been recorded for you today.')
      .replace('{{EXECUTIVE_NAME}}', executiveName)
      .replace(/{{STORE_NAME}}/g, 'No visits recorded')
      .replace(/{{DATE}}/g, today)
      .replace('{{TOTAL_VISITS}}', '0')
      .replace('{{FOOTER_MESSAGE}}', 'Keep pushing towards your goals and targets.');
  } else {
    // Has visits - show normal message
    html = visitNotificationTemplate
      .replace('{{HEADER_TITLE}}', 'Visit Recorded')
      .replace('{{STATUS_MESSAGE}}', 'Your visit has been successfully recorded in the system.')
      .replace('{{EXECUTIVE_NAME}}', executiveName)
      .replace(/{{STORE_NAME}}/g, storeName)
      .replace(/{{DATE}}/g, today)
      .replace('{{TOTAL_VISITS}}', todayVisitCount.toString())
      .replace('{{FOOTER_MESSAGE}}', 'Thank you for your consistent performance.');
  }

  const subject = todayVisitCount === 0 
    ? `📊 Daily Summary - No visits today` 
    : `✅ Visit Recorded - ${storeName}`;

  //await sendMail(executiveEmail, subject, html);
  console.log(`✅ Email sent to ${executiveName} (${executiveEmail}) - Visits: ${todayVisitCount}`);
}
