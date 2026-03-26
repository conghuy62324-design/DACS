import { NextResponse } from 'next/server';
import { readSessionFromCookies } from '@/lib/auth';

export async function GET() {
  const session = await readSessionFromCookies();
  if (!session) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ ok: true, authenticated: true, session });
}
