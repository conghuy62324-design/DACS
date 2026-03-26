import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { adminSessionCookieName, signAdminSession } from '@/lib/auth';
import { deleteAdminOtp, findAdminAccountById, findAdminOtp } from '@/lib/admin-store';

export async function POST(request: Request) {
  const data = await request.json();
  const accountId = String(data.accountId || '').trim();
  const code = String(data.code || '').trim();

  if (!accountId || !code) {
    return NextResponse.json({ ok: false, error: 'Account id and OTP code are required' }, { status: 400 });
  }

  const otp = await findAdminOtp(accountId);
  if (!otp || new Date(otp.expiresAt).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: 'OTP code has expired' }, { status: 401 });
  }

  const valid = await bcrypt.compare(code, otp.codeHash);
  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Invalid OTP code' }, { status: 401 });
  }

  const account = await findAdminAccountById(accountId);
  if (!account || account.role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'Admin account not found' }, { status: 404 });
  }

  await deleteAdminOtp(accountId);

  const token = signAdminSession({
    sub: account.id,
    username: account.username,
    role: account.role,
    name: account.name,
  });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(adminSessionCookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
