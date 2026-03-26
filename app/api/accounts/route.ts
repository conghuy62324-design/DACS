import { NextResponse } from 'next/server';
import { createAdminAccount, deleteAdminAccount, listAdminAccounts, updateAdminAccount } from '@/lib/admin-store';

type Role = 'admin' | 'staff';

export async function GET() {
  const rows = await listAdminAccounts();
  return NextResponse.json(rows.map(account => ({ ...account, password: '' })));
}

export async function POST(request: Request) {
  const data = await request.json();

  const id = `a${Date.now()}`;
  const username = String(data.username || '').trim();
  const password = String(data.password || '').trim();
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim();
  const role: Role = data.role === 'admin' ? 'admin' : 'staff';
  const twoFactorEnabled = Boolean(data.twoFactorEnabled && email);

  if (!username || !password || !name) {
    return NextResponse.json({ ok: false, error: 'Missing required account fields' }, { status: 400 });
  }

  try {
    const account = await createAdminAccount({
      id,
      username,
      password,
      name,
      email,
      role,
      twoFactorEnabled,
    });

    return NextResponse.json({
      ok: true,
      account: {
        ...account,
        password: '',
      },
    });
  } catch (error) {
    console.error('create account error', error);
    return NextResponse.json({ ok: false, error: 'Username already exists or account cannot be created' }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const data = await request.json();

  const id = String(data.id || '').trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Account id is required' }, { status: 400 });
  }

  const fields: string[] = [];
  const updates: {
    username?: string;
    name?: string;
    email?: string;
    role?: Role;
    twoFactorEnabled?: boolean;
    password?: string;
  } = {};

  if (data.username !== undefined) {
    fields.push('username');
    updates.username = String(data.username || '').trim();
  }
  if (data.name !== undefined) {
    fields.push('name');
    updates.name = String(data.name || '').trim();
  }
  if (data.email !== undefined) {
    fields.push('email');
    updates.email = String(data.email || '').trim();
  }
  if (data.role !== undefined) {
    fields.push('role');
    updates.role = data.role === 'admin' ? 'admin' : 'staff';
  }
  if (data.twoFactorEnabled !== undefined) {
    fields.push('twoFactorEnabled');
    const emailValue = data.email !== undefined ? String(data.email || '').trim() : undefined;
    updates.twoFactorEnabled = Boolean(data.twoFactorEnabled && (emailValue !== undefined ? emailValue !== '' : true));
  }
  if (data.password) {
    fields.push('password');
    updates.password = String(data.password);
  }

  if (!fields.length) {
    return NextResponse.json({ ok: false, error: 'Nothing to update' }, { status: 400 });
  }

  const account = await updateAdminAccount(id, updates);
  if (!account) {
    return NextResponse.json({ ok: false, error: 'Account not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, account: { ...account, password: '' } });
}

export async function DELETE(request: Request) {
  const data = await request.json();
  const id = String(data.id || '').trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Account id is required' }, { status: 400 });
  }

  await deleteAdminAccount(id);
  return NextResponse.json({ ok: true });
}
