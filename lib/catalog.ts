import type { Pool } from 'mysql2/promise';
import { initializeDatabase } from '@/lib/mysql';

export type CategoryRecord = {
  id: string;
  name: string;
  icon: string;
};

const DEFAULT_CATEGORY_ICON =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="24" fill="#18181b"/>
      <path d="M18 30a8 8 0 0 1 8-8h14l6 7h24a8 8 0 0 1 8 8v23a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8V30z" fill="#f59e0b"/>
      <path d="M18 38h60v22a8 8 0 0 1-8 8H26a8 8 0 0 1-8-8V38z" fill="#fbbf24"/>
    </svg>`
  );

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase('vi-VN');
}

export async function getCatalogDb() {
  return initializeDatabase();
}

export async function syncCategoriesFromMenu(pool?: Pool) {
  const db = pool || (await getCatalogDb());

  const [categoryRows] = await db.query('SELECT id, name, icon FROM categories');
  const categories = categoryRows as CategoryRecord[];

  const [menuCategoryRows] = await db.query(
    `SELECT DISTINCT category_id as categoryId, category_name as categoryName
     FROM menu_items
     WHERE TRIM(category_id) <> '' OR TRIM(category_name) <> ''`
  );

  for (const row of menuCategoryRows as Array<{ categoryId: string; categoryName: string }>) {
    const categoryId = String(row.categoryId || '').trim();
    const categoryName = String(row.categoryName || '').trim();

    if (!categoryId && !categoryName) {
      continue;
    }

    const existing = categories.find(
      category =>
        category.id === categoryId ||
        (categoryName && normalizeName(category.name) === normalizeName(categoryName))
    );

    if (existing) {
      if (categoryId && existing.id !== categoryId) {
        await db.execute('UPDATE menu_items SET category_id = ? WHERE category_name = ?', [existing.id, categoryName]);
      }
      continue;
    }

    const nextCategory: CategoryRecord = {
      id: categoryId || `cat-${Date.now()}-${categories.length + 1}`,
      name: categoryName || categoryId,
      icon: DEFAULT_CATEGORY_ICON,
    };

    await db.execute('INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)', [
      nextCategory.id,
      nextCategory.name,
      nextCategory.icon,
    ]);
    categories.push(nextCategory);
  }

  const [freshRows] = await db.query('SELECT id, name, icon FROM categories ORDER BY name ASC');
  return freshRows as CategoryRecord[];
}
