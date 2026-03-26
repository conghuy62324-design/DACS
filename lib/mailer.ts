import nodemailer from 'nodemailer';

function getTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return null;
  }

  const smtpPass = process.env.SMTP_PASS || '';
  if (!smtpPass || smtpPass === 'your-16-char-gmail-app-password') {
    throw new Error('SMTP Gmail chưa được cấu hình App Password thật.');
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: smtpPass,
    },
  });
}

export async function sendTwoFactorCode(email: string, code: string) {
  const transport = getTransport();
  if (!transport) {
    throw new Error('SMTP is not configured');
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@localhost';

  await transport.sendMail({
    from,
    to: email,
    subject: 'Ma xac thuc dang nhap admin',
    text: `Ma xac thuc admin cua ban la: ${code}. Ma co hieu luc trong 10 phut.`,
    html: `<div style="font-family:Arial,sans-serif;font-size:16px">
      <p>Ma xac thuc admin cua ban la:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p>
      <p>Ma co hieu luc trong 10 phut.</p>
    </div>`,
  });
}
