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

const dailyPJPSummaryTemplate = fs.readFileSync(
  path.join(process.cwd(), 'public/email-templates/dailyPJPSummary.html'),
  'utf-8'
);

const pjpNotificationTemplate = fs.readFileSync(
  path.join(process.cwd(), 'public/email-templates/pjpNotification.html'),
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
 * This function sends all executives' visit data
 * Each executive gets ONE row with all stores comma-separated and total visit count
 * @param visitData Array of visit data with executive name, stores (comma-separated), and total visit count
 */
export async function sendDailyVisitSummaryToAdmins(
  visitData: Array<{ 
    executiveId: string; 
    executiveName: string; 
    visitCount: number; 
    visitsHtml: string; 
    pjpStoresHtml: string; 
    pjpReason?: string; 
    hasDeviation?: boolean 
  }>
) {
  const adminEmails = [
    'vishal.shukla@zopper.com',
     'bharat.kumar@zopper.com',
   'vikash.dubey@zopper.com',
   'amit.srivastava@zopper.com',
   'archit.tiwari@zopper.com',
   'harshdeep.singh@zopper.com',
   'assurance.tech@zopper.com'
  ];
  // const adminEmails=[
  //   'harshdeep.singh@zopper.com',
  // ]
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create HTML table for all visits
  let tableRows = '';
  visitData.forEach((visit, index) => {
    let storesList = visit.visitsHtml || '<li style="margin: 4px 0; color: #999;">No visits recorded</li>';
    let pjpStoresList = visit.pjpStoresHtml || '<li style="margin: 4px 0; color: #999;">No PJP submitted</li>';

    tableRows += `
      <tr style="background-color: ${index % 2 === 0 ? '#f9f9f9' : '#ffffff'}; vertical-align: top;">
        <td style="padding: 12px; border: 1px solid #ddd;">${visit.executiveName}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">
          <ul style="margin: 0; padding-left: 20px;">
            ${storesList}
          </ul>
        </td>
        <td style="padding: 12px; border: 1px solid #ddd;">
          <ul style="margin: 0; padding-left: 20px;">
            ${pjpStoresList}
          </ul>
        </td>
        <td style="padding: 12px; border: 1px solid #ddd; font-style: italic; color: #555;">
          ${
            visit.hasDeviation === false
              ? '<span style="color: #10b981; font-weight: bold; font-style: normal;">✅ PJP matches with visits</span>'
              : visit.hasDeviation === true
                ? (visit.pjpReason === 'Reason not provided' 
                   ? '<span style="color: #ef4444; font-weight: bold; font-style: normal;">⚠️ Reason not provided</span>' 
                   : visit.pjpReason)
                : '<span style="color: #ccc;">-</span>'
          }
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
 * Send daily PJP summary (Planned visits only) to admins
 * @param pjpData Array of PJP data with executive name and planned stores
 */
export async function sendDailyPJPSummaryToAdmins(
  pjpData: Array<{ executiveName: string; pjpStoreNames: string }>
) {
  const adminEmails = [
    'vishal.shukla@zopper.com',
    'bharat.kumar@zopper.com',
    'vikash.dubey@zopper.com',
    'amit.srivastava@zopper.com',
    'archit.tiwari@zopper.com',
    'harshdeep.singh@zopper.com',
    'assurance.tech@zopper.com'
  ];

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create HTML table for all PJPs
  let tableRows = '';
  if (pjpData.length === 0) {
    tableRows = `
      <tr>
        <td colspan="2" style="padding: 20px; border: 1px solid #ddd; text-align: center; color: #666; font-style: italic;">
          No PJP created by any executive.
        </td>
      </tr>
    `;
  } else {
    pjpData.forEach((pjp, index) => {
      let pjpStoresList = '';
      
      if (pjp.pjpStoreNames && pjp.pjpStoreNames.trim()) {
        const pjpStores = pjp.pjpStoreNames.split('|||').map(s => s.trim());
        pjpStoresList = pjpStores
          .map(store => `<li style="margin: 4px 0;">${store}</li>`)
          .join('');
      } else {
        pjpStoresList = '<li style="margin: 4px 0; color: #999;">No PJP submitted</li>';
      }

      tableRows += `
        <tr style="background-color: ${index % 2 === 0 ? '#f9f9f9' : '#ffffff'}; vertical-align: top;">
          <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">${pjp.executiveName}</td>
          <td style="padding: 12px; border: 1px solid #ddd;">
            <ul style="margin: 0; padding-left: 20px;">
              ${pjpStoresList}
            </ul>
          </td>
        </tr>
      `;
    });
  }

  const html = dailyPJPSummaryTemplate
    .replace('{{DATE}}', today)
    .replace('{{TABLE_ROWS}}', tableRows);

  const subject = `🗓️ Daily PJP Summary (Planned) - ${today}`;

  for (const adminEmail of adminEmails) {
    await sendMail(adminEmail, subject, html);
  }

  console.log(`✅ Daily PJP summary sent to ${adminEmails.length} admins`);
}

/**
 * Send visit notification to individual executive
 * This function sends the executive their own visit details
 * @param executiveEmail Executive's email address
 * @param executiveName Executive's name
 * @param storeName Store name visited
 * @param todayVisitCount Total visits by this executive
 */
export async function sendVisitNotificationToExecutive(
  executiveEmail: string,
  executiveName: string,
  visitsHtml: string,
  todayVisitCount: number,
  pjpStoresHtml: string = ''
) {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const storesListHtml = visitsHtml || '<ul style="margin: 0; padding-left: 20px;"><li style="margin: 6px 0; line-height: 1.5; color: #999;">No visits recorded</li></ul>';
  const pjpStoresListHtml = pjpStoresHtml || '<ul style="margin: 0; padding-left: 20px;"><li style="margin: 6px 0; line-height: 1.5; color: #999;">No PJP submitted</li></ul>';

  let html = '';
  
  if (todayVisitCount === 0) {
    // No visits - show a different message
    html = visitNotificationTemplate
      .replace('{{HEADER_TITLE}}', 'No Visits Recorded')
      .replace('{{STATUS_MESSAGE}}', 'No visits have been recorded by you.')
      .replace('{{EXECUTIVE_NAME}}', executiveName)
      .replace(/{{STORE_NAME}}/g, storesListHtml)
      .replace(/{{PJP_STORES}}/g, pjpStoresListHtml)
      .replace(/{{DATE}}/g, today)
      .replace('{{TOTAL_VISITS}}', '0')
      .replace('{{FOOTER_MESSAGE}}', 'Keep pushing towards your goals and targets.');
  } else {
    // Has visits - show normal message with formatted store list
    html = visitNotificationTemplate
      .replace('{{HEADER_TITLE}}', 'Visit Recorded')
      .replace('{{STATUS_MESSAGE}}', 'Your visits have been successfully recorded in the system.')
      .replace('{{EXECUTIVE_NAME}}', executiveName)
      .replace(/{{STORE_NAME}}/g, storesListHtml)
      .replace(/{{PJP_STORES}}/g, pjpStoresListHtml)
      .replace(/{{DATE}}/g, today)
      .replace('{{TOTAL_VISITS}}', todayVisitCount.toString())
      .replace('{{FOOTER_MESSAGE}}', 'Thank you for your consistent performance.');
  }

  const subject = todayVisitCount === 0 
    ? `📋 No visits recorded` 
    : `🎯 Visit Recorded - ${todayVisitCount} store${todayVisitCount > 1 ? 's' : ''}`;

   await sendMail(executiveEmail, subject, html);
  console.log(`✅ Email sent to ${executiveName} (${executiveEmail}) - Visits: ${todayVisitCount}`);
}

/**
 * Send daily PJP notification (morning) to individual executive
 * @param executiveEmail Executive's email address
 * @param executiveName Executive's name
 * @param pjpStoreName Delimiter separated store names from PJP
 */
export async function sendPJPNotificationToExecutive(
  executiveEmail: string,
  executiveName: string,
  pjpStoreName: string = ''
) {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const formatPJPList = (stores: string): string => {
    if (!stores || !stores.trim()) {
      return '<p style="color: #999; font-style: italic;">No PJP submitted.</p>';
    }
    const storeArray = stores.split('|||').map(s => s.trim()).filter(s => s);
    if (storeArray.length === 0) {
      return '<p style="color: #999; font-style: italic;">No PJP submitted.</p>';
    }
    return `<ul style="margin: 0; padding-left: 20px;">` + storeArray
      .map(store => `<li style="margin: 6px 0; line-height: 1.5;">${store}</li>`)
      .join('') + `</ul>`;
  };

  const pjpListHtml = formatPJPList(pjpStoreName);
  
  const hasPJP = pjpStoreName && pjpStoreName.trim().length > 0;
  
  const html = pjpNotificationTemplate
    .replace('{{EXECUTIVE_NAME}}', executiveName)
    .replace('{{DATE}}', today)
    .replace('{{STATUS_MESSAGE}}', hasPJP 
      ? 'Here is your planned visit list. Good luck with your visits!' 
      : 'You haven\'t submitted a visit plan (PJP).')
    .replace('{{PJP_STORES}}', pjpListHtml)
    .replace('{{FOOTER_MESSAGE}}', hasPJP 
      ? 'Have a productive day ahead!' 
      : 'Planning is the first step to success. Have a great day!');

  const subject = hasPJP 
    ? `🎯Visit Plan (PJP) - ${today}`
    : `⚠️ PJP Reminder - ${today}`;

  await sendMail(executiveEmail, subject, html);
  console.log(`✅ Executive PJP notification sent to ${executiveName}`);
}

