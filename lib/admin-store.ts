import bcrypt from 'bcryptjs';
import type { Pool } from 'mysql2/promise';
import { readData, writeData } from '@/app/api/storage';
import { initializeDatabase } from '@/lib/mysql';

export type AdminAccountRecord = {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'staff';
  email: string;
  twoFactorEnabled: boolean;
  createdAt: string;
  passwordHash?: string;
  password?: string;
};

type OtpRecord = {
  accountId: string;
  codeHash: string;
  expiresAt: string;
  createdAt: string;
};

type JsonAccountRecord = {
  id: string;
  username: string;
  name?: string;
  role?: string;
  email?: string;
  twoFactorEnabled?: boolean | number;
  createdAt?: string;
  passwordHash?: string;
  password?: string;
};

const DEFAULT_ADMIN_ACCOUNT: JsonAccountRecord = {
  id: 'a1',
  username: 'admin',
  password: 'admin',
  name: 'Administrator',
  role: 'admin',
  email: '',
  twoFactorEnabled: false,
  createdAt: new Date().toISOString(),
};

async function getAdminDb(): Promise<Pool | null> {
  try {
    return await initializeDatabase();
  } catch (error) {
    console.warn('admin store fallback to JSON storage', error);
    return null;
  }
}

function normalizeJsonAccount(record: JsonAccountRecord): AdminAccountRecord {
  return {
    id: String(record.id || ''),
    username: String(record.username || '').trim(),
    name: String(record.name || 'Administrator').trim() || 'Administrator',
    role: record.role === 'admin' ? 'admin' : 'staff',
    email: String(record.email || '').trim(),
    twoFactorEnabled: Boolean(record.twoFactorEnabled),
    createdAt: record.createdAt || new Date().toISOString(),
    passwordHash: record.passwordHash,
    password: record.password,
  };
}

function readJsonAccounts() {
  return readData<JsonAccountRecord[]>('accounts.json', [DEFAULT_ADMIN_ACCOUNT]).map(normalizeJsonAccount);
}

function writeJsonAccounts(accounts: AdminAccountRecord[]) {
  writeData(
    'accounts.json',
    accounts.map(account => ({
      id: account.id,
      username: account.username,
      name: account.name,
      role: account.role,
      email: account.email,
      twoFactorEnabled: account.twoFactorEnabled,
      createdAt: account.createdAt,
      passwordHash: account.passwordHash,
    }))
  );
}

function readJsonOtps() {
  return readData<OtpRecord[]>('auth-otps.json', []);
}

function writeJsonOtps(records: OtpRecord[]) {
  writeData('auth-otps.json', records);
}

function stripSensitiveFields(account: AdminAccountRecord) {
  return {
    id: account.id,
    username: account.username,
    name: account.name,
    role: account.role,
    email: account.email,
    twoFactorEnabled: account.twoFactorEnabled,
    createdAt: account.createdAt,
  };
}

export async function listAdminAccounts() {
  const db = await getAdminDb();
  if (db) {
    const [rows] = await db.query(
      `SELECT id, username, name, role, email, two_factor_enabled as twoFactorEnabled, created_at as createdAt
       FROM accounts ORDER BY created_at ASC`
    );
    return rows as Array<Omit<AdminAccountRecord, 'passwordHash' | 'password'>>;
  }

  return readJsonAccounts().map(stripSensitiveFields);
}

export async function findAdminAccountByUsername(username: string) {
  const normalizedUsername = username.trim();
  const db = await getAdminDb();

  if (db) {
    const [rows] = await db.execute(
      `SELECT id, username, password_hash as passwordHash, name, role, email,
              two_factor_enabled as twoFactorEnabled, created_at as createdAt
       FROM accounts WHERE username = ? LIMIT 1`,
      [normalizedUsername]
    );

    const account = (rows as AdminAccountRecord[])[0];
    return account
      ? {
          ...account,
          twoFactorEnabled: Boolean(account.twoFactorEnabled),
          createdAt: String(account.createdAt),
        }
      : null;
  }

  return readJsonAccounts().find(account => account.username === normalizedUsername) || null;
}

export async function findAdminAccountById(id: string) {
  const normalizedId = id.trim();
  const db = await getAdminDb();

  if (db) {
    const [rows] = await db.execute(
      `SELECT id, username, password_hash as passwordHash, name, role, email,
              two_factor_enabled as twoFactorEnabled, created_at as createdAt
       FROM accounts WHERE id = ? LIMIT 1`,
      [normalizedId]
    );

    const account = (rows as AdminAccountRecord[])[0];
    return account
      ? {
          ...account,
          twoFactorEnabled: Boolean(account.twoFactorEnabled),
          createdAt: String(account.createdAt),
        }
      : null;
  }

  return readJsonAccounts().find(account => account.id === normalizedId) || null;
}

export async function verifyAdminPassword(account: AdminAccountRecord, password: string) {
  if (account.passwordHash) {
    return bcrypt.compare(password, account.passwordHash);
  }

  return account.password === password;
}

export async function createAdminAccount(input: {
  id: string;
  username: string;
  password: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  twoFactorEnabled: boolean;
}) {
  const db = await getAdminDb();
  const passwordHash = await bcrypt.hash(input.password, 10);

  if (db) {
    await db.execute(
      `INSERT INTO accounts (id, username, password_hash, name, role, email, two_factor_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.id, input.username, passwordHash, input.name, input.role, input.email, input.twoFactorEnabled ? 1 : 0]
    );

    return {
      id: input.id,
      username: input.username,
      name: input.name,
      role: input.role,
      email: input.email,
      twoFactorEnabled: input.twoFactorEnabled,
      createdAt: new Date().toISOString(),
    };
  }

  const accounts = readJsonAccounts();
  if (accounts.some(account => account.username === input.username)) {
    throw new Error('DUPLICATE_USERNAME');
  }

  const created = {
    id: input.id,
    username: input.username,
    name: input.name,
    role: input.role,
    email: input.email,
    twoFactorEnabled: input.twoFactorEnabled,
    createdAt: new Date().toISOString(),
    passwordHash,
  } satisfies AdminAccountRecord;

  accounts.push(created);
  writeJsonAccounts(accounts);

    return stripSensitiveFields(created);
}

export async function updateAdminAccount(
  id: string,
  updates: {
    username?: string;
    name?: string;
    email?: string;
    role?: 'admin' | 'staff';
    twoFactorEnabled?: boolean;
    password?: string;
  }
) {
  const db = await getAdminDb();

  if (db) {
    const fields: string[] = [];
    const values: Array<string | number> = [];

    if (updates.username !== undefined) {
      fields.push('username = ?');
      values.push(updates.username);
    }
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email);
    }
    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.twoFactorEnabled !== undefined) {
      fields.push('two_factor_enabled = ?');
      values.push(updates.twoFactorEnabled ? 1 : 0);
    }
    if (updates.password) {
      fields.push('password_hash = ?');
      values.push(await bcrypt.hash(updates.password, 10));
    }

    if (!fields.length) {
      throw new Error('NOTHING_TO_UPDATE');
    }

    values.push(id);
    await db.execute(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, values);
    const account = await findAdminAccountById(id);
    if (!account) return null;
    return stripSensitiveFields(account);
  }

  const accounts = readJsonAccounts();
  const index = accounts.findIndex(account => account.id === id);
  if (index === -1) {
    return null;
  }

  const current = accounts[index];
  const next: AdminAccountRecord = {
    ...current,
    username: updates.username ?? current.username,
    name: updates.name ?? current.name,
    email: updates.email ?? current.email,
    role: updates.role ?? current.role,
    twoFactorEnabled: updates.twoFactorEnabled ?? current.twoFactorEnabled,
  };

  if (updates.password) {
    next.passwordHash = await bcrypt.hash(updates.password, 10);
    delete next.password;
  }

  accounts[index] = next;
  writeJsonAccounts(accounts);

  return stripSensitiveFields(next);
}

export async function deleteAdminAccount(id: string) {
  const db = await getAdminDb();
  if (db) {
    await db.execute('DELETE FROM accounts WHERE id = ?', [id]);
    return;
  }

  const accounts = readJsonAccounts().filter(account => account.id !== id);
  writeJsonAccounts(accounts);
}

export async function saveAdminOtp(accountId: string, codeHash: string, expiresAt: Date) {
  const db = await getAdminDb();
  if (db) {
    await db.execute(
      `INSERT INTO auth_otps (account_id, code_hash, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE code_hash = VALUES(code_hash), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP`,
      [accountId, codeHash, expiresAt]
    );
    return;
  }

  const records = readJsonOtps().filter(record => record.accountId !== accountId);
  records.push({
    accountId,
    codeHash,
    expiresAt: expiresAt.toISOString(),
    createdAt: new Date().toISOString(),
  });
  writeJsonOtps(records);
}

export async function findAdminOtp(accountId: string) {
  const db = await getAdminDb();
  if (db) {
    const [rows] = await db.execute(
      `SELECT account_id as accountId, code_hash as codeHash, expires_at as expiresAt
       FROM auth_otps WHERE account_id = ? LIMIT 1`,
      [accountId]
    );
    const record = (rows as Array<{ accountId: string; codeHash: string; expiresAt: string }>)[0];
    return record || null;
  }

  return readJsonOtps().find(record => record.accountId === accountId) || null;
}

export async function deleteAdminOtp(accountId: string) {
  const db = await getAdminDb();
  if (db) {
    await db.execute('DELETE FROM auth_otps WHERE account_id = ?', [accountId]);
    return;
  }

  const records = readJsonOtps().filter(record => record.accountId !== accountId);
  writeJsonOtps(records);
}
