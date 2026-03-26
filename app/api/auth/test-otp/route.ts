import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';
import { findAdminAccountById } from '@/lib/admin-store';
import { sendTwoFactorCode } from '@/lib/mailer';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST() {
  try {
    const session = await readSessionFromCookies();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const account = await findAdminAccountById(session.sub);
    if (!account?.email) {
      return NextResponse.json({ ok: false, error: 'Admin email is not configured' }, { status: 400 });
    }

    const code = generateOtp();
    await sendTwoFactorCode(account.email, code);

    return NextResponse.json({
      ok: true,
      email: account.email,
      message: 'OTP test email sent successfully',
    });
  } catch (error) {
    console.error('test otp error', error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error && error.message.includes('App Password')
            ? 'SMTP Gmail chưa có App Password thật nên chưa thể gửi OTP.'
            : error instanceof Error
              ? error.message
              : 'Unable to send OTP test email'
      },
      { status: 500 }
    );
  }
}
