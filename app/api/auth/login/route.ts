import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminSessionCookieName, signAdminSession } from '@/lib/auth';
import {
  findAdminAccountByEmail,
  findAdminAccountByUsername,
  saveAdminOtp,
  verifyAdminPassword,
} from '@/lib/admin-store';
import { sendTwoFactorCode } from '@/lib/mailer';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    const loginEmail = String(data.email || '').trim().toLowerCase();
    const loginPassword = String(data.password || '');
    const expectedRole = data.role === 'staff' ? 'staff' : 'admin';

    // Staff logic (Legacy)
    if (expectedRole === 'staff') {
      const legacyUsername = String(data.username || '').trim();
      if (!legacyUsername || !loginPassword) {
        return NextResponse.json(
          { ok: false, error: 'Username and password are required' },
          { status: 400 }
        );
      }

      const account = await findAdminAccountByUsername(legacyUsername);
      if (!account || account.role !== 'staff') {
        return NextResponse.json(
          { ok: false, error: 'Staff account not found' },
          { status: 401 }
        );
      }

      const valid = await verifyAdminPassword(account, loginPassword);
      if (!valid) {
        return NextResponse.json(
          { ok: false, error: 'Invalid password' },
          { status: 401 }
        );
      }

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

    // ── Admin login: email + password → OTP ──
    if (!loginEmail || !loginPassword) {
      return NextResponse.json(
        { ok: false, error: 'Vui lòng nhập đầy đủ email và mật khẩu' },
        { status: 400 }
      );
    }

    const account = await findAdminAccountByEmail(loginEmail);

    if (!account) {
      return NextResponse.json(
        { ok: false, error: 'Không tìm thấy tài khoản admin với email này' },
        { status: 401 }
      );
    }

    const valid = await verifyAdminPassword(account, loginPassword);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: 'Mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    // Generate OTP and send email WITHOUT awaiting so it transitions instantly
    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await saveAdminOtp(account.id, codeHash, expiresAt);

    sendTwoFactorCode(account.email, code).catch(error => {
      console.warn('Background OTP send failed:', error.message);
    });

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

