import { NextResponse } from 'next/server';
import { Server } from 'socket.io';
import { syncCategoriesFromMenu } from '@/lib/catalog';
import { initializeDatabase } from '@/lib/mysql';

function emitMenu(menuItems: unknown[]) {
  try {
    const io = (global as { io?: Server }).io;
    if (io) io.emit('menu-updated', menuItems);
  } catch (err) {
    console.error('socket emit error', err);
  }
}

async function getMenuItems() {
  const db = await initializeDatabase();
  await syncCategoriesFromMenu(db);
  const [rows] = await db.query(
    `SELECT
      id,
      name_vi as nameVi,
      name_en as nameEn,
      description_vi as descriptionVi,
      description_en as descriptionEn,
      category_id as categoryId,
      category_name as categoryName,
      price,
      image,
      rating
     FROM menu_items
     ORDER BY name_vi ASC`
  );

  return rows;
}

export async function GET() {
  return NextResponse.json(await getMenuItems());
}

export async function POST(request: Request) {
  const data = await request.json();
  const db = await initializeDatabase();
  await syncCategoriesFromMenu(db);
  const id = `m${Date.now()}`;

  await db.execute(
    `INSERT INTO menu_items
     (id, name_vi, name_en, description_vi, description_en, category_id, category_name, price, image, rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.nameVi,
      data.nameEn || data.nameVi,
      data.descriptionVi || '',
      data.descriptionEn || '',
      data.categoryId || '',
      data.categoryName || '',
      Number(data.price || 0),
      data.image || '',
      Number(data.rating || 0),
    ]
  );

  const menuItems = await getMenuItems();
  emitMenu(menuItems as unknown[]);
  const item = (menuItems as Array<Record<string, unknown>>).find(menuItem => menuItem.id === id);
  return NextResponse.json({ ok: true, item });
}

export async function PUT(request: Request) {
  const data = await request.json();
  const db = await initializeDatabase();
  await syncCategoriesFromMenu(db);
  const id = String(data.id || '').trim();

  if (!id) {
    return NextResponse.json({ ok: false, error: 'Item id is required' }, { status: 400 });
  }

  const fields: string[] = [];
  const values: Array<string | number> = [];
  const mapping: Record<string, string> = {
    nameVi: 'name_vi',
    nameEn: 'name_en',
    descriptionVi: 'description_vi',
    descriptionEn: 'description_en',
    categoryId: 'category_id',
    categoryName: 'category_name',
    price: 'price',
    image: 'image',
    rating: 'rating',
  };

  Object.entries(mapping).forEach(([key, column]) => {
    if (data[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(data[key]);
    }
  });

  if (!fields.length) {
    return NextResponse.json({ ok: false, error: 'Nothing to update' }, { status: 400 });
  }

  values.push(id);
  await db.execute(`UPDATE menu_items SET ${fields.join(', ')} WHERE id = ?`, values);

  const menuItems = await getMenuItems();
  emitMenu(menuItems as unknown[]);
  const item = (menuItems as Array<Record<string, unknown>>).find(menuItem => menuItem.id === id);
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(request: Request) {
  const data = await request.json();
  const id = String(data.id || '').trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: 'Item id is required' }, { status: 400 });
  }

  const db = await initializeDatabase();
  await db.execute('DELETE FROM menu_items WHERE id = ?', [id]);
  const menuItems = await getMenuItems();
  emitMenu(menuItems as unknown[]);
  return NextResponse.json({ ok: true });
}
