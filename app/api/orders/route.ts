import { NextResponse } from 'next/server';
import { Server } from 'socket.io';
import { initializeDatabase } from '@/lib/mysql';

type OrderItem = {
  id: string;
  qty: number;
};

type OrderSchema = {
  hasModernId: boolean;
  hasLegacyOrderId: boolean;
  hasTableName: boolean;
  hasFloor: boolean;
  hasCustomer: boolean;
  hasLegacyCustomerName: boolean;
  hasTotal: boolean;
  hasLegacyTotalAmount: boolean;
  hasStatus: boolean;
  hasHandler: boolean;
  hasCreatedAt: boolean;
  hasLegacyOrderDate: boolean;
};

async function ensureOrdersSchema() {
  const db = await initializeDatabase();
  const [rows] = await db.query('SHOW COLUMNS FROM orders');
  const columns = new Set((rows as Array<{ Field: string }>).map(row => row.Field));
  const hasLegacyOrderId = columns.has('OrderID');

  if (!columns.has('id')) {
    await db.query('ALTER TABLE orders ADD COLUMN id VARCHAR(64) NULL');
  }
  if (!columns.has('table_name')) {
    await db.query("ALTER TABLE orders ADD COLUMN table_name VARCHAR(50) NOT NULL DEFAULT ''");
  }
  if (!columns.has('floor')) {
    await db.query("ALTER TABLE orders ADD COLUMN floor VARCHAR(50) NOT NULL DEFAULT ''");
  }
  if (!columns.has('customer')) {
    await db.query("ALTER TABLE orders ADD COLUMN customer VARCHAR(255) NOT NULL DEFAULT ''");
  }
  if (!columns.has('total')) {
    await db.query('ALTER TABLE orders ADD COLUMN total DECIMAL(12,2) NOT NULL DEFAULT 0');
  }
  if (!columns.has('status')) {
    await db.query("ALTER TABLE orders ADD COLUMN status VARCHAR(100) NOT NULL DEFAULT 'Cho xu ly'");
  }
  if (!columns.has('handler')) {
    await db.query("ALTER TABLE orders ADD COLUMN handler VARCHAR(150) NOT NULL DEFAULT ''");
  }
  if (!columns.has('created_at')) {
    await db.query('ALTER TABLE orders ADD COLUMN created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP');
  }

  if (hasLegacyOrderId) {
    await db.query(
      `UPDATE orders
       SET id = COALESCE(NULLIF(id, ''), CONCAT('o-legacy-', OrderID)),
           customer = COALESCE(NULLIF(customer, ''), CustomerName),
           total = CASE
             WHEN total IS NULL OR total = 0 THEN COALESCE(TotalAmount, 0)
             ELSE total
           END,
           created_at = COALESCE(created_at, OrderDate, CURRENT_TIMESTAMP),
           status = COALESCE(NULLIF(status, ''), 'Paid')
       WHERE id IS NULL OR id = '' OR customer = '' OR total = 0 OR created_at IS NULL OR status = ''`
    );
  }

  const [updatedRows] = await db.query('SHOW COLUMNS FROM orders');
  const updatedColumns = new Set((updatedRows as Array<{ Field: string }>).map(row => row.Field));

  return {
    db,
    schema: {
      hasModernId: updatedColumns.has('id'),
      hasLegacyOrderId,
      hasTableName: updatedColumns.has('table_name'),
      hasFloor: updatedColumns.has('floor'),
      hasCustomer: updatedColumns.has('customer'),
      hasLegacyCustomerName: updatedColumns.has('CustomerName'),
      hasTotal: updatedColumns.has('total'),
      hasLegacyTotalAmount: updatedColumns.has('TotalAmount'),
      hasStatus: updatedColumns.has('status'),
      hasHandler: updatedColumns.has('handler'),
      hasCreatedAt: updatedColumns.has('created_at'),
      hasLegacyOrderDate: updatedColumns.has('OrderDate'),
    } satisfies OrderSchema,
  };
}

async function getOrders() {
  const { db, schema } = await ensureOrdersSchema();
  const idColumn = schema.hasModernId ? 'id' : "CONCAT('o-', OrderID)";
  const tableNameColumn = schema.hasTableName ? 'table_name' : "''";
  const floorColumn = schema.hasFloor ? 'floor' : "''";
  const customerColumn = schema.hasCustomer ? 'customer' : schema.hasLegacyCustomerName ? 'CustomerName' : "''";
  const totalColumn = schema.hasTotal ? 'total' : schema.hasLegacyTotalAmount ? 'TotalAmount' : '0';
  const statusColumn = schema.hasStatus ? 'status' : "'Paid'";
  const handlerColumn = schema.hasHandler ? 'handler' : "''";
  const createdAtColumn = schema.hasCreatedAt ? 'created_at' : schema.hasLegacyOrderDate ? 'OrderDate' : 'CURRENT_TIMESTAMP';

  const [orderRows] = await db.query(
    `SELECT
      ${idColumn} as id,
      ${tableNameColumn} as tableName,
      ${floorColumn} as floor,
      ${customerColumn} as customer,
      ${totalColumn} as total,
      ${statusColumn} as status,
      ${handlerColumn} as handler,
      ${createdAtColumn} as createdAt
     FROM orders
     ORDER BY ${createdAtColumn} DESC`
  );

  const [itemRows] = await db.query(
    `SELECT order_id as orderId, item_id as itemId, qty FROM order_items`
  );

  const itemsByOrder = new Map<string, OrderItem[]>();
  (itemRows as Array<{ orderId: string; itemId: string; qty: number }>).forEach(item => {
    const list = itemsByOrder.get(item.orderId) || [];
    list.push({ id: item.itemId, qty: Number(item.qty || 0) });
    itemsByOrder.set(item.orderId, list);
  });

  return (orderRows as Array<{
    id: string;
    tableName: string;
    floor: string;
    customer: string;
    total: number;
    status: string;
    handler: string;
    createdAt: string;
  }>).map(order => ({
    id: order.id,
    table: order.tableName,
    floor: order.floor,
    customer: order.customer,
    items: itemsByOrder.get(order.id) || [],
    total: Number(order.total || 0),
    status: order.status,
    handler: order.handler,
    createdAt: order.createdAt,
  }));
}

function emitOrders(orders: unknown[], order?: unknown) {
  try {
    const io = (global as { io?: Server }).io;
    if (io) {
      io.emit('orders-updated', orders);
      if (order) io.emit('new-order', order);
    }
  } catch (err) {
    console.error('socket emit error', err);
  }
}

export async function GET() {
  try {
    return NextResponse.json(await getOrders());
  } catch (error) {
    console.error('get orders error', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to load orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { db, schema } = await ensureOrdersSchema();
    const id = `o${Date.now()}`;
    const items: OrderItem[] = Object.entries(data.cart || {}).map(([itemId, qty]) => ({ id: itemId, qty: Number(qty) || 0 }));
    const customerValue = String(data.customer || data.customerName || '').trim();
    const totalValue = Number(data.total ?? data.totalPrice) || 0;
    const createdAtValue = new Date();
    const orderColumns = ['id', 'table_name', 'floor', 'customer', 'total', 'status', 'handler', 'created_at'];
    const orderValues: Array<string | number | Date> = [
      id,
      String(data.table || ''),
      String(data.floor || ''),
      customerValue,
      totalValue,
      'Cho xu ly',
      String(data.handler || ''),
      createdAtValue,
    ];

    if (schema.hasLegacyCustomerName) {
      orderColumns.push('CustomerName');
      orderValues.push(customerValue);
    }
    if (schema.hasLegacyOrderDate) {
      orderColumns.push('OrderDate');
      orderValues.push(createdAtValue);
    }
    if (schema.hasLegacyTotalAmount) {
      orderColumns.push('TotalAmount');
      orderValues.push(totalValue);
    }

    await db.execute(
      `INSERT INTO orders (${orderColumns.join(', ')})
       VALUES (${orderColumns.map(() => '?').join(', ')})`,
      orderValues
    );

    for (const item of items) {
      await db.execute('INSERT INTO order_items (order_id, item_id, qty) VALUES (?, ?, ?)', [id, item.id, item.qty]);
    }

    const orders = await getOrders();
    const order = orders.find(current => current.id === id);
    emitOrders(orders, order);

    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error('create order error', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to create order' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const data = await request.json();
    const { db, schema } = await ensureOrdersSchema();
    const id = String(data.id || '').trim();

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Order id is required' }, { status: 400 });
    }

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
      if (schema.hasLegacyTotalAmount) {
        fields.push('TotalAmount = ?');
        values.push(Number(data.total || 0));
      }
    }

    if (fields.length) {
      values.push(id);
      await db.execute(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (data.items) {
      await db.execute('DELETE FROM order_items WHERE order_id = ?', [id]);
      for (const item of data.items as Array<{ id: string; qty: number }>) {
        await db.execute('INSERT INTO order_items (order_id, item_id, qty) VALUES (?, ?, ?)', [id, item.id, Number(item.qty || 0)]);
      }
    }

    const orders = await getOrders();
    const order = orders.find(current => current.id === id);
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    }

    emitOrders(orders);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    console.error('update order error', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Unable to update order' }, { status: 500 });
  }
}
