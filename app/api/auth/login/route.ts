import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminSessionCookieName, signAdminSession } from '@/lib/auth';
import {
  findAdminAccountByEmail,
  findAdminAccountByPhone,
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

    const loginPassword = String(data.password || '');
    const expectedRole = data.role === 'staff' ? 'staff' : 'admin';

    // ── Staff login: số điện thoại + mật khẩu → đăng nhập trực tiếp (không OTP) ──
    if (expectedRole === 'staff') {
      const loginPhone = String(data.phone || '').trim();
      if (!loginPhone || !loginPassword) {
        return NextResponse.json(
          { ok: false, error: 'Vui lòng nhập số điện thoại và mật khẩu' },
          { status: 400 }
        );
      }

      const account = await findAdminAccountByPhone(loginPhone);
      if (!account || account.role !== 'staff') {
        return NextResponse.json(
          { ok: false, error: 'Không tìm thấy tài khoản nhân viên với số điện thoại này' },
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

    // ── Admin login: email + mật khẩu → gửi OTP về email admin ──
    const loginEmail = String(data.email || '').trim().toLowerCase();
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

    // Gửi OTP về email của admin trong database
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
