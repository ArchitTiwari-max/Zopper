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
      from: `"Support Team" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`📧 Mail sent to ${to}, ID: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send mail to ${to}:`, error);
  }
}
