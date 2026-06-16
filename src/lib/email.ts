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

export async function sendDailyReportEmail(to: string, pdfBuffer: Buffer, dateString: string): Promise<boolean> {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to,
      subject: `Daily Visit Report - ${dateString}`,
      text: `Please find attached the daily visit report for ${dateString}.`,
      attachments: [
        {
          filename: `visit-reports-${dateString}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf'
        }
      ]
    };
    
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending daily report email:', error);
    return false;
  }
}

export async function sendCredentialsEmail(
  email: string,
  username: string,
  role: string,
  name: string,
  passwordText: string
): Promise<boolean> {
  try {
    const currentYear = new Date().getFullYear();
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: 'Welcome to SalesDost - Your Account Credentials',
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f4f7f6; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          <!-- Header Banner -->
          <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 35px 20px; text-align: center; color: white;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Welcome to SalesDost</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">Your account has been created successfully</p>
          </div>
          
          <!-- Content Body -->
          <div style="background-color: white; padding: 40px 30px; border-radius: 0 0 12px 12px;">
            <p style="font-size: 16px; color: #333333; line-height: 1.6; margin-top: 0;">
              Hello <strong>${name}</strong>,
            </p>
            <p style="font-size: 15px; color: #555555; line-height: 1.6; margin-bottom: 25px;">
              An administrator has set up a new account for you on the SalesDost platform with the role of <strong>${role}</strong>. Below are your official sign-in credentials:
            </p>
            
            <!-- Credentials Card -->
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #718096; width: 35%; font-weight: 600;">Sign-In URL:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #2d3748; font-weight: bold;">
                    <a href="https://salesdost.zopper.com" style="color: #4f46e5; text-decoration: none;">salesdost.zopper.com</a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #718096; width: 35%; font-weight: 600;">Username:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #2d3748; font-weight: bold; font-family: monospace;">${username}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #718096; width: 35%; font-weight: 600;">Email:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #2d3748; font-family: monospace;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 14px; color: #718096; width: 35%; font-weight: 600;">Password:</td>
                  <td style="padding: 6px 0; font-size: 14px; color: #2d3748; font-weight: bold; font-family: monospace;">${passwordText}</td>
                </tr>
              </table>
            </div>

            <!-- Call to Action -->
            <div style="text-align: center; margin: 35px 0;">
              <a href="https://salesdost.zopper.com" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; text-decoration: none; padding: 14px 30px; font-weight: bold; border-radius: 6px; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(79, 70, 229, 0.25);">
                Log In to Your Account
              </a>
            </div>
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
            
            <p style="font-size: 12px; color: #e53e3e; line-height: 1.5; margin-bottom: 0;">
              <strong>Security Warning:</strong> For your security, please log in immediately and change your password to something only you know. Never share your credentials with anyone.
            </p>
          </div>
          
          <!-- Footer -->
          <div style="text-align: center; color: #a0aec0; font-size: 12px; padding: 25px 20px;">
            <p style="margin: 0 0 8px 0;">If you have any questions or did not expect this account creation, please contact support.</p>
            <p style="margin: 0;">&copy; ${currentYear} SalesDost / Zopper. All rights reserved.</p>
          </div>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending credentials email:', error);
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
