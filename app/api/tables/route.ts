import { NextResponse } from 'next/server';
import { readData, writeData } from '../storage';

export async function GET() {
  try {
    const data = readData('tables.json', []);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json([], { status: 200 }); // Return empty array if error
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    writeData('tables.json', data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Tables API Error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
