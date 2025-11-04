import nodemailer from 'nodemailer';

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendOTPEmail(email: string, otp: string): Promise<boolean> {
  
  try {
    // // Path to the image in public folder
    // // const imagePath = path.join(process.cwd(), 'public', 'SalesDost.png');
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'OTP for SalesDost Login',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          
          <div style="text-align: center; margin: 30px 0;">
            <h2 style="color: #333; font-weight: bold; font-size: 24px; margin: 0;">
              OTP for login to SalesDost
            </h2>
          </div>
          
          <div style="background-color: #f8f9fa; border-radius: 8px; padding: 30px; text-align: center; margin: 30px 0;">
            <p style="color: #666; font-size: 16px; margin-bottom: 20px;">
              Your One-Time Password (OTP) is:
            </p>
            <div style="background-color: #007bff; color: white; font-size: 32px; font-weight: bold; padding: 15px 30px; border-radius: 8px; letter-spacing: 5px; display: inline-block;">
              ${otp}
            </div>
            <p style="color: #666; font-size: 14px; margin-top: 20px;">
              This OTP will expire in 10 minutes.
            </p>
          </div>
          
          <div style="text-align: center; color: #999; font-size: 12px; margin-top: 40px;">
            <p>If you didn't request this OTP, please ignore this email.</p>
            <p>&copy; 2024 SalesDost. All rights reserved.</p>
          </div>
        </div>
      `    };
    
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
}

// Generate a 6-digit OTP
export function generateOTP(): string {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const timestamp = new Date().toISOString();
  
  // Enhanced logging for production visibility

  
  return otp;
}
