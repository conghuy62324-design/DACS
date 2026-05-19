import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/mysql';

export async function GET() {
  try {
    const pool = await initializeDatabase();
    const [rows] = await pool.query('SELECT item_id, initial_stock, sold_qty, incoming_qty FROM inventory');
    const inventory = (rows as Array<{ item_id: string; initial_stock: number; sold_qty: number; incoming_qty: number }>);

    // Convert to the format the frontend expects: { [itemId]: { initial, sold, incoming } }
    const result: Record<string, { initial: number; sold: number; incoming: number }> = {};
    for (const row of inventory) {
      result[row.item_id] = {
        initial: Number(row.initial_stock),
        sold: Number(row.sold_qty),
        incoming: Number(row.incoming_qty),
      };
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('Inventory GET Error:', err);
    return NextResponse.json({}, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const pool = await initializeDatabase();

    // data is: { [itemId]: { initial: number, sold: number, incoming: number } }
    for (const [itemId, entry] of Object.entries(data)) {
      const { initial, sold, incoming } = entry as { initial: number; sold: number; incoming: number };
      await pool.query(
        `INSERT INTO inventory (item_id, initial_stock, sold_qty, incoming_qty)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           initial_stock = VALUES(initial_stock),
           sold_qty = VALUES(sold_qty),
           incoming_qty = VALUES(incoming_qty)`,
        [itemId, Number(initial ?? 0), Number(sold ?? 0), Number(incoming ?? 0)]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Inventory POST Error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
