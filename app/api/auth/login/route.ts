import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminSessionCookieName, signAdminSession } from '@/lib/auth';
import { findAdminAccountByUsername, saveAdminOtp, verifyAdminPassword } from '@/lib/admin-store';
import { sendTwoFactorCode } from '@/lib/mailer';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const username = String(data.username || '').trim();
    const password = String(data.password || '');

    if (!username || !password) {
      return NextResponse.json({ ok: false, error: 'Username and password are required' }, { status: 400 });
    }

    const account = await findAdminAccountByUsername(username);

    if (!account || account.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Admin account not found' }, { status: 401 });
    }

    const valid = await verifyAdminPassword(account, password);
    if (!valid) {
      return NextResponse.json({ ok: false, error: 'Invalid password' }, { status: 401 });
    }

    if (!account.twoFactorEnabled) {
      const token = signAdminSession({
        sub: account.id,
        username: account.username,
        role: account.role,
        name: account.name,
      });
      const response = NextResponse.json({ ok: true, requiresTwoFactor: false });
      response.cookies.set(adminSessionCookieName, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      });
      return response;
    }

    if (!account.email) {
      return NextResponse.json({ ok: false, error: 'Admin email is missing for two-factor authentication' }, { status: 400 });
    }

    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await saveAdminOtp(account.id, codeHash, expiresAt);

    try {
      await sendTwoFactorCode(account.email, code);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send OTP email';
      const isDev = process.env.NODE_ENV !== 'production';

      if (isDev) {
        console.warn('admin login OTP email fallback', {
          accountId: account.id,
          email: account.email,
          code,
          reason: message,
        });

        return NextResponse.json({
          ok: true,
          requiresTwoFactor: true,
          accountId: account.id,
          email: account.email,
          devOtp: code,
          deliveryWarning: message.includes('App Password')
            ? '2FA dang bat nhung Gmail SMTP chua duoc cau hinh App Password that. Dang dung OTP local de test.'
            : `Khong gui duoc email OTP. Dang dung OTP local de test. Ly do: ${message}`,
        });
      }

      return NextResponse.json(
        {
          ok: false,
          error: message.includes('App Password')
            ? '2FA đang bật nhưng Gmail SMTP chưa được cấu hình App Password thật.'
            : message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      requiresTwoFactor: true,
      accountId: account.id,
      email: account.email,
    });
  } catch (error) {
    console.error('admin login error', error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown login error' },
      { status: 500 }
    );
  }
}
