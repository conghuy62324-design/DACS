import { NextResponse } from 'next/server';
import { readData, writeData } from '@/app/api/storage';
import { readSessionFromCookies } from '@/lib/auth';

const FILE_NAME = 'payment-methods.json';

export async function GET() {
  const methods = readData(FILE_NAME, []);
  return NextResponse.json(methods);
}

export async function POST(req: Request) {
  try {
    const session = await readSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await req.json();
    if (!Array.isArray(data)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    writeData(FILE_NAME, data);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API Payment Methods Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
