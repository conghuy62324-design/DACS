const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'conghuy62324@gmail.com',
    pass: 'rmxniwvgrsggfjdb',
  },
});

async function main() {
  console.log('Dang gui email test...');
  const info = await transport.sendMail({
    from: 'conghuy62324@gmail.com',
    to: 'conghuy62324@gmail.com',
    subject: '[HCH RESTO] Test Email - Kiem tra SMTP',
    text: 'Day la email test tu he thong HCH Resto Admin. SMTP da duoc cau hinh thanh cong!',
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#18181b;border-radius:24px;color:#fff">
      <div style="text-align:center;margin-bottom:24px">
        <span style="display:inline-block;padding:8px 16px;border-radius:999px;border:1px solid rgba(249,115,22,0.35);color:#fdba74;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;font-weight:700">HCH RESTO ADMIN</span>
      </div>
      <h1 style="text-align:center;font-size:24px;font-weight:800;margin:0 0 16px">Test Email Thanh Cong!</h1>
      <p style="text-align:center;color:#a1a1aa;font-size:14px;line-height:1.6">
        Day la email test tu he thong HCH Resto Admin.<br/>
        SMTP Gmail da duoc cau hinh thanh cong!
      </p>
      <div style="margin-top:24px;padding:16px;background:#27272a;border-radius:16px;text-align:center">
        <p style="color:#4ade80;font-size:16px;font-weight:700;margin:0">✅ SMTP OK</p>
        <p style="color:#71717a;font-size:12px;margin:8px 0 0">smtp.gmail.com:587</p>
      </div>
    </div>`,
  });
  console.log('Email da gui thanh cong! Message ID:', info.messageId);
}

main().catch(err => {
  console.error('Loi gui email:', err.message);
  process.exit(1);
});
