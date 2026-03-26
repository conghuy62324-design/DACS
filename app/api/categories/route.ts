import { NextResponse } from 'next/server';
import { getCatalogDb, syncCategoriesFromMenu } from '@/lib/catalog';

const normalizeName = (value: string) => value.trim().toLocaleLowerCase('vi-VN');

async function ensureTables() {
  const db = await getCatalogDb();

  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(150) NOT NULL UNIQUE,
      icon TEXT NOT NULL
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id VARCHAR(64) PRIMARY KEY,
      name_vi VARCHAR(255) NOT NULL,
      name_en VARCHAR(255) NOT NULL,
      description_vi TEXT NOT NULL,
      description_en TEXT NOT NULL,
      category_id VARCHAR(64) NOT NULL DEFAULT '',
      category_name VARCHAR(150) NOT NULL DEFAULT '',
      price DECIMAL(12,2) NOT NULL DEFAULT 0,
      image LONGTEXT NOT NULL,
      rating DECIMAL(4,1) NOT NULL DEFAULT 0
    )
  `);

  return db;
}

async function getCategories() {
  const db = await ensureTables();
  return syncCategoriesFromMenu(db);
}

export async function GET() {
  try {
    return NextResponse.json(await getCategories());
  } catch (error) {
    console.error('get categories error', error);
    return NextResponse.json({ ok: false, error: 'Không thể tải danh mục.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const db = await ensureTables();

    const category = {
      id: data.id || `cat-${Date.now()}`,
      name: String(data.name || '').trim(),
      icon: String(data.icon || '📁').trim() || '📁',
    };

    if (!category.name) {
      return NextResponse.json({ ok: false, error: 'Category name is required' }, { status: 400 });
    }

    const categories = await getCategories();
    if (categories.some(item => normalizeName(item.name) === normalizeName(category.name))) {
      return NextResponse.json({ ok: false, error: 'Category already exists' }, { status: 409 });
    }

    await db.execute('INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)', [category.id, category.name, category.icon]);
    return NextResponse.json({ ok: true, category });
  } catch (error) {
    console.error('create category error', error);
    return NextResponse.json({ ok: false, error: 'Không thể lưu danh mục.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const db = await ensureTables();
    const id = String(data.id || '').trim();
    const nextName = String(data.name || '').trim();
    const nextIcon = String(data.icon || '📁').trim() || '📁';

    if (!id || !nextName) {
      return NextResponse.json({ ok: false, error: 'Category id and name are required' }, { status: 400 });
    }

    const categories = await getCategories();
    const current = categories.find(category => category.id === id);
    if (!current) {
      return NextResponse.json({ ok: false, error: 'Category not found' }, { status: 404 });
    }

    if (categories.some(category => category.id !== id && normalizeName(category.name) === normalizeName(nextName))) {
      return NextResponse.json({ ok: false, error: 'Category already exists' }, { status: 409 });
    }

    await db.execute('UPDATE categories SET name = ?, icon = ? WHERE id = ?', [nextName, nextIcon, id]);
    await db.execute(
      `UPDATE menu_items
       SET category_id = ?, category_name = ?
       WHERE category_id = ? OR category_name = ?`,
      [id, nextName, id, current.name]
    );

    return NextResponse.json({ ok: true, category: { id, name: nextName, icon: nextIcon } });
  } catch (error) {
    console.error('update category error', error);
    return NextResponse.json({ ok: false, error: 'Không thể cập nhật danh mục.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const queryId = url.searchParams.get('id');
    const data = await request.json().catch(() => ({}));
    const id = String(queryId || data.id || '').trim();

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Category id is required' }, { status: 400 });
    }

    const db = await ensureTables();
    const categories = await getCategories();
    const current = categories.find(category => category.id === id);
    if (!current) {
      return NextResponse.json({ ok: false, error: 'Category not found' }, { status: 404 });
    }

    await db.execute('DELETE FROM categories WHERE id = ?', [id]);
    await db.execute(
      `UPDATE menu_items
       SET category_id = '', category_name = ''
       WHERE category_id = ? OR category_name = ?`,
      [id, current.name]
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('delete category error', error);
    return NextResponse.json({ ok: false, error: 'Không thể xóa danh mục.' }, { status: 500 });
  }
}
