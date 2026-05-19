import { NextResponse } from 'next/server';
import { createAdminAccount, deleteAdminAccount, listAdminAccounts, updateAdminAccount } from '@/lib/admin-store';

type Role = 'admin' | 'staff';

export async function GET() {
  const rows = await listAdminAccounts();
  return NextResponse.json(rows.map(account => ({ ...account, password: '' })));
}

export async function POST(request: Request) {
  const data = await request.json();
  const role: Role = data.role === 'admin' ? 'admin' : 'staff';

  // ── Tạo tài khoản ADMIN: email + mật khẩu ──
  if (role === 'admin') {
    const email = String(data.email || '').trim().toLowerCase();
    const password = String(data.password || '').trim();

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: 'Vui lòng nhập đầy đủ email và mật khẩu cho tài khoản admin' },
        { status: 400 }
      );
    }

    if (!email.includes('@')) {
      return NextResponse.json(
        { ok: false, error: 'Email không hợp lệ' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' },
        { status: 400 }
      );
    }

    try {
      const id = `a${Date.now()}`;
      const account = await createAdminAccount({
        id,
        username: email,           // username = email
        password,
        name: 'Admin',
        email,
        phone: '',
        role: 'admin',
        twoFactorEnabled: true,    // Luôn bật 2FA cho admin
      });

      return NextResponse.json({
        ok: true,
        account: { ...account, password: '' },
      });
    } catch (error) {
      console.error('create admin account error', error);
      return NextResponse.json(
        { ok: false, error: 'Email đã được sử dụng hoặc không thể tạo tài khoản' },
        { status: 409 }
      );
    }
  }

  // ── Tạo tài khoản NHÂN VIÊN: sđt + tên + mật khẩu ──
  const phone = String(data.phone || '').trim();
  const staffName = String(data.name || '').trim();
  const staffPassword = String(data.password || '').trim();

  if (!phone || !staffName || !staffPassword) {
    return NextResponse.json(
      { ok: false, error: 'Vui lòng nhập đầy đủ số điện thoại, tên và mật khẩu' },
      { status: 400 }
    );
  }

  if (!/^\d{9,12}$/.test(phone)) {
    return NextResponse.json(
      { ok: false, error: 'Số điện thoại phải là số, từ 9-12 chữ số' },
      { status: 400 }
    );
  }

  if (staffPassword.length < 6) {
    return NextResponse.json(
      { ok: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' },
      { status: 400 }
    );
  }

  try {
    const id = `s${Date.now()}`;
    const account = await createAdminAccount({
      id,
      username: phone,           // username = sđt (dùng để đăng nhập)
      password: staffPassword,
      name: staffName,            // tên hiển thị
      email: '',
      phone,
      role: 'staff',
      twoFactorEnabled: false,
    });

    return NextResponse.json({
      ok: true,
      account: { ...account, password: '' },
    });
  } catch (error) {
    console.error('create staff account error', error);
    return NextResponse.json(
      { ok: false, error: 'Số điện thoại đã được sử dụng hoặc không thể tạo tài khoản' },
      { status: 409 }
    );
  }
}

export async function PATCH(request: Request) {
  const data = await request.json();

  const id = String(data.id || '').trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Account id is required' }, { status: 400 });
  }

  // Build the updates object for updateAdminAccount
  const updates: Record<string, unknown> = {};

  if (data.username !== undefined) updates.username = String(data.username || '').trim();
  if (data.name !== undefined) updates.name = String(data.name || '').trim();
  if (data.email !== undefined) updates.email = String(data.email || '').trim().toLowerCase();
  if (data.phone !== undefined) updates.phone = String(data.phone || '').trim();
  if (data.role !== undefined) updates.role = data.role === 'admin' ? 'admin' : 'staff';
  if (data.twoFactorEnabled !== undefined) updates.twoFactorEnabled = data.twoFactorEnabled;
  if (data.password) updates.password = String(data.password);

  if (!Object.keys(updates).length) {
    return NextResponse.json({ ok: false, error: 'Nothing to update' }, { status: 400 });
  }

  try {
    const account = await updateAdminAccount(id, updates as {
      username?: string;
      name?: string;
      email?: string;
      phone?: string;
      role?: 'admin' | 'staff';
      twoFactorEnabled?: boolean;
      password?: string;
    });
    if (!account) {
      return NextResponse.json({ ok: false, error: 'Account not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, account: { ...account, password: '' } });
  } catch (error) {
    console.error('update account error', error);
    return NextResponse.json({ ok: false, error: 'Không thể cập nhật tài khoản' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const data = await request.json();
  const id = String(data.id || '').trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Account id is required' }, { status: 400 });
  }

  // Không cho xóa tài khoản admin
  const rows = await listAdminAccounts();
  const target = rows.find(a => a.id === id);
  if (target?.role === 'admin') {
    return NextResponse.json(
      { ok: false, error: 'Không thể xóa tài khoản admin' },
      { status: 403 }
    );
  }

  await deleteAdminAccount(id);
  return NextResponse.json({ ok: true });
}
