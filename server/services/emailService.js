import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Ensure .env is resolved correctly regardless of cwd
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

/**
 * Standard RFC 5322 compliant email regex
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Sanitize header strings against CRLF injection attacks
 */
export const sanitizeHeader = (input) => {
  if (typeof input !== 'string') return '';
  return input.replace(/[\r\n]/g, '').trim();
};

/**
 * Validate email address format
 */
export const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const sanitized = sanitizeHeader(email);
  return EMAIL_REGEX.test(sanitized);
};

let transporterInstance = null;

/**
 * Get or create the reusable Nodemailer transporter instance
 */
export const getTransporter = () => {
  if (transporterInstance) return transporterInstance;

  const emailPort = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const emailSecure = process.env.EMAIL_SECURE === 'true';
  // Strip whitespace from Gmail app passwords if user pasted with spaces
  const emailPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '';

  transporterInstance = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: emailPort,
    secure: emailSecure,
    family: 4, // Explicitly force IPv4 to prevent cloud IPv6 timeouts on Render
    auth: {
      user: process.env.EMAIL_USER,
      pass: emailPass,
    },
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
    connectionTimeout: 20000, // 20s connection timeout for cloud networks
    greetingTimeout: 20000,   // 20s greeting timeout
    socketTimeout: 30000,     // 30s socket inactivity timeout
  });

  return transporterInstance;
};

/**
 * Verify transporter on startup to catch auth/connection failures immediately
 */
export const verifyTransporter = async () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, '') : '';

  if (!emailUser || !emailPass) {
    console.warn('[SMTP] EMAIL_USER or EMAIL_PASS not set in environment. Real emails will fail until credentials are supplied.');
    return false;
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log(`[SMTP] Transporter verified successfully (${emailUser}). Ready to send emails.`);
    return true;
  } catch (error) {
    console.error(`[SMTP] Transporter verification failed on startup: ${error.message} (${error.code || 'NO_CODE'})`);
    return false;
  }
};

/**
 * Send an email with full validation, sanitization, and structured error handling
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plaintext body
 * @param {string} [options.html] - HTML formatted body
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string, code?: string }>}
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  // 1. Input Validation
  if (!to || typeof to !== 'string') {
    return { success: false, error: 'Recipient email address is required.' };
  }

  const sanitizedTo = sanitizeHeader(to).toLowerCase();
  if (!isValidEmail(sanitizedTo)) {
    return { success: false, error: 'Invalid recipient email address format.' };
  }

  if (!subject || typeof subject !== 'string') {
    return { success: false, error: 'Email subject is required.' };
  }

  const sanitizedSubject = sanitizeHeader(subject);
  if (!sanitizedSubject) {
    return { success: false, error: 'Email subject cannot be blank.' };
  }

  if (!text && !html) {
    return { success: false, error: 'Email must contain either text or html content.' };
  }

  // 2. Prepare mail options with sanitized headers
  const fromAddress = sanitizeHeader(process.env.EMAIL_FROM) || `"SleekChat" <${process.env.EMAIL_USER}>`;

  const mailOptions = {
    from: fromAddress,
    to: sanitizedTo,
    subject: sanitizedSubject,
    ...(text && { text }),
    ...(html && { html }),
  };

  // 3. Dispatch email with error classification
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP] Email sent to ${sanitizedTo}. MessageId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    let errorMsg = 'Failed to send email. Please try again later.';
    const errorCode = err.code || 'UNKNOWN';

    if (err.code === 'EAUTH') {
      console.error('[SMTP Error - EAUTH]: Invalid credentials or application-specific password needed.');
      errorMsg = 'Email service authentication failed. Please check your email credentials.';
    } else if (err.code === 'ETIMEDOUT' || err.code === 'ESOCKET' || err.code === 'ECONNREFUSED') {
      console.error(`[SMTP Error - ${err.code}]: Mail server connection timed out or refused.`);
      errorMsg = 'Email service is currently unreachable. Please try again later.';
    } else {
      console.error(`[SMTP Error - ${errorCode}]:`, err.message);
    }

    return {
      success: false,
      error: errorMsg,
      code: errorCode,
    };
  }
};

/**
 * Helper to dispatch OTP verification template
 */
export const sendOTPEmail = async (to, otp) => {
  console.log(`[SMTP System] Verification Code generated: ${otp} for ${to}`);

  // In local development, if SMTP credentials are not configured yet, allow testing via console log
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('[SMTP System] EMAIL_USER / EMAIL_PASS not configured in .env. Use the 6-digit code logged above to test verification.');
    return {
      success: true,
      messageId: 'dev-console-mock-id',
    };
  }

  const subject = 'SleekChat Email Verification OTP';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #4f46e5; text-align: center; margin-bottom: 16px;">SleekChat Verification Code</h2>
      <p style="color: #374151; font-size: 15px; line-height: 1.5;">Thank you for signing up for SleekChat! Use the following 6-digit verification code to complete your registration:</p>
      <div style="background-color: #f3f4f6; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 6px; padding: 18px; margin: 24px 0; border-radius: 8px; color: #111827;">
        ${otp}
      </div>
      <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">This code is valid for 5 minutes. If you did not request this code, please ignore this email.</p>
    </div>
  `;
  const text = `Your SleekChat verification code is: ${otp}. It will expire in 5 minutes.`;

  return await sendEmail({ to, subject, text, html });
};

export default {
  getTransporter,
  verifyTransporter,
  sendEmail,
  sendOTPEmail,
  sanitizeHeader,
  isValidEmail,
};
