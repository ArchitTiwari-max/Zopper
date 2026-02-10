import nodemailer from "nodemailer";
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

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
  visitData: Array<{ executiveName: string; storeName: string; visitCount: number }>
) {
  const adminEmails = [
    'vishal.shukla@zopper.com',
     'bharat.kumar@zopper.com',
   'vikash.dubey@zopper.com',
   'amit.srivastava@zopper.com',
   'archit.tiwari@zopper.com',
   'harshdep.singh@zopper.com'
  ];
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create HTML table for all visits
  let tableRows = '';
  visitData.forEach((visit, index) => {
    tableRows += `
      <tr style="background-color: ${index % 2 === 0 ? '#f9f9f9' : '#ffffff'};">
        <td style="padding: 12px; border: 1px solid #ddd;">${visit.executiveName}</td>
        <td style="padding: 12px; border: 1px solid #ddd;">${visit.storeName}</td>
        <td style="padding: 12px; border: 1px solid #ddd; text-align: center; font-weight: bold; color: #667eea;">${visit.visitCount}</td>
      </tr>
    `;
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @media only screen and (max-width: 600px) {
          body { padding: 10px !important; }
          .container { padding: 15px !important; }
          h1 { font-size: 20px !important; }
          h2 { font-size: 16px !important; }
          table { font-size: 12px !important; }
          th, td { padding: 8px !important; }
          .header { padding: 20px !important; }
        }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 900px; margin: 0 auto; padding: 20px;">
      <div class="header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">📊 Daily Visit Summary</h1>
        <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">${today}</p>
      </div>
      
      <div class="container" style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #667eea; margin-top: 0;">All Executive Visits Today</h2>
        
        <div style="margin-bottom: 20px; padding: 15px; background-color: #f0f4ff; border-left: 4px solid #667eea; border-radius: 4px;">
          <p style="margin: 0; font-size: 14px; color: #555;">
            <strong>Total Visits Across All Executives:</strong> ${visitData.reduce((sum, v) => sum + v.visitCount, 0)}
          </p>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; overflow-x: auto; display: block;">
          <thead>
            <tr style="background-color: #667eea; color: white;">
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left; width: 20%;">Executive Name</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: left; width: 60%;">Stores Visited</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: center; width: 20%;">Total Visits</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
        <p>This is an automated email from SalesDost. Please do not reply.</p>
      </div>
    </body>
    </html>
  `;

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

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        @media only screen and (max-width: 600px) {
          body { padding: 10px !important; }
          .container { padding: 15px !important; }
          h1 { font-size: 20px !important; }
          h2 { font-size: 16px !important; }
          .box { padding: 15px !important; margin: 15px 0 !important; }
          p { font-size: 14px !important; }
        }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="header" style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 28px;">✅ Visit Recorded</h1>
        <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">${today}</p>
      </div>
      
      <div class="container" style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
        <h2 style="color: #11998e; margin-top: 0;">Hello ${executiveName}! 👋</h2>
        
        <p style="font-size: 16px; color: #555;">Your visit has been successfully recorded.</p>
        
        <div class="box" style="background-color: #f0fff4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #38ef7d;">
          <h3 style="margin: 0 0 15px 0; color: #11998e;">Visit Details</h3>
          <p style="margin: 8px 0; font-size: 15px;">
            <strong>🏪 Store Name:</strong> ${storeName}
          </p>
          <p style="margin: 8px 0; font-size: 15px;">
            <strong>📅 Date:</strong> ${today}
          </p>
        </div>
        
        <div class="box" style="background-color: #fff9e6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <h3 style="margin: 0 0 10px 0; color: #f57c00;">📊 Your Today's Summary</h3>
          <p style="margin: 0; font-size: 18px; font-weight: bold; color: #f57c00;">
            Total Visits Today: ${todayVisitCount}
          </p>
        </div>
        
        <div style="margin-top: 25px; padding: 15px; background-color: #e3f2fd; border-radius: 4px; text-align: center;">
          <p style="margin: 0; font-size: 14px; color: #1976d2;">
            Keep up the great work! 💪
          </p>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
        <p>This is an automated email from SalesDost. Please do not reply.</p>
      </div>
    </body>
    </html>
  `;

  const subject = `✅ Visit Recorded - ${storeName}`;

  await sendMail(executiveEmail, subject, html);
  console.log(`✅ Visit notification sent to ${executiveName} (${executiveEmail})`);
}
