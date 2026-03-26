import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  let fallbackText = '';
  try {
    const { text, from = 'vi', to = 'en' } = (await request.json()) as {
      text: string;
      from?: string;
      to?: string;
    };
    fallbackText = text;

    // Try Google Translate public endpoint (no key required)
    const encoded = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encoded}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`translate failed (${res.status})`);
    }

    const body = await res.json();
    const translated = Array.isArray(body?.[0])
      ? (body[0] as Array<[string, ...unknown[]]>).map(p => String(p[0])).join('')
      : '';
    return NextResponse.json({ translatedText: translated || text });
  } catch (err) {
    console.error('translate error', err);
    return NextResponse.json({ translatedText: fallbackText });
  }
}
