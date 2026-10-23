const nodemailer = require('nodemailer');
const logger = require('./logger');

const createTransporter = () => {
  if (process.env.EMAIL_HOST) {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  // Fallback: Ethereal test account (auto-created on first use in dev)
  return null;
};

let transporter = null;

const getTransporter = async () => {
  if (transporter) return transporter;
  if (process.env.EMAIL_HOST) {
    transporter = createTransporter();
    return transporter;
  }
  // Dev: create Ethereal account
  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  logger.info(`[Email] Dev mode — Ethereal account: ${testAccount.user}`);
  return transporter;
};

const FROM = process.env.EMAIL_FROM || '"Enterprise NeXus" <noreply@enterprise-nexus.io>';
const APP_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const sendPasswordReset = async ({ to, name, resetToken }) => {
  const t = await getTransporter();
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  const info = await t.sendMail({
    from: FROM,
    to,
    subject: 'Reset your Enterprise NeXus password',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <h2 style="color:#00c2a8">Password Reset Request</h2>
        <p>Hi ${name || 'there'},</p>
        <p>We received a request to reset your password. Click the button below to set a new one. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}"
           style="display:inline-block;margin:20px 0;padding:12px 28px;background:#00c2a8;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
          Reset Password
        </a>
        <p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
        <p style="color:#aaa;font-size:12px">Link: ${resetUrl}</p>
      </div>`,
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });

  if (nodemailer.getTestMessageUrl(info)) {
    logger.info(`[Email] Password reset preview: ${nodemailer.getTestMessageUrl(info)}`);
  }
  return info;
};

const sendEscalationEmail = async ({ to, ticketId, subject, priority, description, assigneeName }) => {
  const t = await getTransporter();
  const ticketUrl = `${APP_URL}/support`;

  const info = await t.sendMail({
    from: FROM,
    to,
    subject: `[ESCALATED] Ticket #${ticketId} — ${subject}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
        <div style="background:#fee2e2;border-left:4px solid #ef4444;padding:12px 16px;border-radius:4px;margin-bottom:20px">
          <strong style="color:#dc2626">Support Ticket Escalated</strong>
        </div>
        <h3 style="margin:0 0 8px">${subject}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
          <tr><td style="padding:6px 0;color:#666">Ticket ID</td><td>#${ticketId}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Priority</td><td style="text-transform:uppercase;font-weight:bold;color:#dc2626">${priority}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Assigned To</td><td>${assigneeName || 'Unassigned'}</td></tr>
        </table>
        <p style="background:#f5f5f5;padding:12px;border-radius:6px;font-size:14px">${description}</p>
        <a href="${ticketUrl}"
           style="display:inline-block;margin-top:16px;padding:10px 24px;background:#00c2a8;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold">
          View Ticket
        </a>
      </div>`,
    text: `Ticket #${ticketId} escalated.\nSubject: ${subject}\nPriority: ${priority}\n${description}\n\nView: ${ticketUrl}`,
  });

  if (nodemailer.getTestMessageUrl(info)) {
    logger.info(`[Email] Escalation preview: ${nodemailer.getTestMessageUrl(info)}`);
  }
  return info;
};

module.exports = { sendPasswordReset, sendEscalationEmail };
