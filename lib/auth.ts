import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'admin_session';

type SessionPayload = {
  sub: string;
  username: string;
  role: string;
  name: string;
};

function getSecret() {
  return process.env.JWT_SECRET || 'change-this-secret';
}

export function signAdminSession(payload: SessionPayload) {
  return jwt.sign(payload, getSecret(), { expiresIn: '7d' });
}

export function verifyAdminSession(token?: string) {
  if (!token) return null;

  try {
    return jwt.verify(token, getSecret()) as SessionPayload;
  } catch {
    return null;
  }
}

export async function readSessionFromCookies() {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return verifyAdminSession(token);
}

export const adminSessionCookieName = COOKIE_NAME;
