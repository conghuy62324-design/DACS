import { NextResponse } from 'next/server';
import { initializeDatabase } from '@/lib/mysql';
import { Server } from 'socket.io';

type OrderItem = {
  id: string;
  qty: number;
};

function emitOrders(orders: unknown[]) {
  try {
    const io = (global as { io?: Server }).io;
    if (io) io.emit('orders-updated', orders);
  } catch {}
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await initializeDatabase();

    const [orderRows] = await db.query(
      `SELECT id, table_name as tableName, floor, customer, COALESCE(phone, '') as phone,
              total, status, handler, created_at as createdAt
       FROM orders WHERE id = ?`,
      [id]
    ) as [any[], unknown];

    if (!orderRows || orderRows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderRows[0];

    const [itemRows] = await db.query(
      `SELECT item_id as itemId, qty FROM order_items WHERE order_id = ?`,
      [id]
    ) as [any[], unknown];

    return NextResponse.json({
      id: order.id,
      table: order.tableName,
      floor: order.floor,
      customer: order.customer,
      phone: order.phone || '',
      items: (itemRows as Array<{ itemId: string; qty: number }>).map(i => ({
        id: i.itemId,
        qty: Number(i.qty || 0),
      })),
      total: Number(order.total || 0),
      status: order.status,
      handler: order.handler,
      createdAt: order.createdAt,
    });
  } catch (error) {
    console.error('get order error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to fetch order' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await request.json();
    const db = await initializeDatabase();

    const fields: string[] = [];
    const values: Array<string | number> = [];

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(String(data.status));
    }
    if (data.handler !== undefined) {
      fields.push('handler = ?');
      values.push(String(data.handler));
    }
    if (data.total !== undefined) {
      fields.push('total = ?');
      values.push(Number(data.total || 0));
    }

    if (fields.length) {
      values.push(id);
      await db.execute(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (data.items !== undefined) {
      await db.execute('DELETE FROM order_items WHERE order_id = ?', [id]);
      const items: Array<{ id: string; qty: number }> = data.items;
      for (const item of items) {
        if (item.id && item.qty > 0) {
          await db.execute('INSERT INTO order_items (order_id, item_id, qty) VALUES (?, ?, ?)', [id, String(item.id), Number(item.qty || 0)]);
        }
      }
    }

    // Fetch updated order
    const [orderRows] = await db.query(
      `SELECT id, table_name as tableName, floor, customer, COALESCE(phone, '') as phone,
              total, status, handler, created_at as createdAt FROM orders WHERE id = ?`,
      [id]
    ) as [any[], unknown];

    if (!orderRows || (orderRows as any[]).length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = (orderRows as any[])[0];
    const [itemRows] = await db.query(
      `SELECT item_id as itemId, qty FROM order_items WHERE order_id = ?`,
      [id]
    ) as [any[], unknown];

    const updated = {
      id: order.id,
      table: order.tableName,
      floor: order.floor,
      customer: order.customer,
      phone: order.phone || '',
      items: (itemRows as Array<{ itemId: string; qty: number }>).map(i => ({ id: i.itemId, qty: Number(i.qty || 0) })),
      total: Number(order.total || 0),
      status: order.status,
      handler: order.handler,
      createdAt: order.createdAt,
    };

    emitOrders([updated]);
    return NextResponse.json({ ok: true, order: updated });
  } catch (error) {
    console.error('patch order error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update order' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await initializeDatabase();

    // Get table info before delete
    const [orderRows] = await db.query(
      `SELECT table_name as tableName, floor FROM orders WHERE id = ?`,
      [id]
    ) as [any[], unknown];

    const orderInfo = (orderRows as any[])[0] || null;

    await db.execute('DELETE FROM order_items WHERE order_id = ?', [id]);
    await db.execute('DELETE FROM orders WHERE id = ?', [id]);

    emitOrders([]);
    return NextResponse.json({
      ok: true,
      deletedId: id,
      table: orderInfo?.tableName || null,
      floor: orderInfo?.floor || null,
    });
  } catch (error) {
    console.error('delete order error', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to delete order' }, { status: 500 });
  }
}
