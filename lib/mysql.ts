import mysql, { Pool } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { readData } from '@/app/api/storage';

type GlobalWithMysql = typeof globalThis & {
  __mysqlPool?: Pool;
  __mysqlInit?: Promise<void>;
};

const globalWithMysql = globalThis as GlobalWithMysql;

function getConfig() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hch_restaurant',
  };
}

export function getPool() {
  if (!globalWithMysql.__mysqlPool) {
    globalWithMysql.__mysqlPool = mysql.createPool({
      ...getConfig(),
      waitForConnections: true,
      connectionLimit: 10,
      namedPlaceholders: true,
      charset: 'utf8mb4',
    });
  }

  return globalWithMysql.__mysqlPool;
}

async function seedAccounts(pool: Pool) {
  const jsonAccounts = readData<Array<{ id: string; username: string; password: string; name: string; role: string; email?: string; phone?: string }>>('accounts.json', [
    { id: 'a1', username: 'admin', password: 'Huy04052004@', name: 'Administrator', role: 'admin', email: 'conghuy62324@gmail.com', phone: '' },
  ]);

  for (const account of jsonAccounts) {
    const [existingRows] = await pool.execute('SELECT id FROM accounts WHERE username = ? LIMIT 1', [account.username]);
    if ((existingRows as Array<{ id: string }>).length > 0) {
      continue;
    }

    const passwordHash = await bcrypt.hash(account.password || 'Huy04052004@', 10);
    await pool.execute(
      `INSERT INTO accounts (id, username, password_hash, name, role, email, phone, two_factor_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [account.id, account.username, passwordHash, account.name, account.role === 'admin' ? 'admin' : 'staff', account.email || 'conghuy62324@gmail.com', account.phone || '', 1]
    );
  }
}

async function seedCategories(pool: Pool) {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM categories');
  const count = Number((rows as Array<{ count: number }>)[0]?.count || 0);
  if (count > 0) return;

  const categories = readData<Array<{ id: string; name: string; icon: string }>>('categories.json', []);
  for (const category of categories) {
    await pool.execute(
      'INSERT INTO categories (id, name, icon) VALUES (?, ?, ?)',
      [category.id, category.name, category.icon || '📁']
    );
  }
}

async function seedMenu(pool: Pool) {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM menu_items');
  const count = Number((rows as Array<{ count: number }>)[0]?.count || 0);
  if (count > 0) return;

  const items = readData<Array<{
    id: string;
    nameVi: string;
    nameEn: string;
    descriptionVi?: string;
    descriptionEn?: string;
    categoryId?: string;
    categoryName?: string;
    price: number;
    image: string;
    rating: number;
  }>>('menu.json', []);

  for (const item of items) {
    await pool.execute(
      `INSERT INTO menu_items
       (id, name_vi, name_en, description_vi, description_en, category_id, category_name, price, image, rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.id,
        item.nameVi,
        item.nameEn || item.nameVi,
        item.descriptionVi || '',
        item.descriptionEn || '',
        item.categoryId || '',
        item.categoryName || '',
        Number(item.price || 0),
        item.image || '',
        Number(item.rating || 0),
      ]
    );
  }
}

async function seedOrders(pool: Pool) {
  const [rows] = await pool.query('SELECT COUNT(*) as count FROM orders');
  const count = Number((rows as Array<{ count: number }>)[0]?.count || 0);
  if (count > 0) return;

  const orders = readData<Array<{
    id: string;
    table: string;
    floor: string;
    customer: string;
    items: Array<{ id: string; qty: number }>;
    total: number;
    status: string;
    handler: string;
    createdAt: string;
  }>>('orders.json', []);

  for (const order of orders) {
    await pool.execute(
      `INSERT INTO orders (id, table_name, floor, customer, total, status, handler, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id,
        order.table || '',
        order.floor || '',
        order.customer || '',
        Number(order.total || 0),
        order.status || 'Chờ xử lý',
        order.handler || '',
        new Date(order.createdAt || Date.now()),
      ]
    );

    for (const item of order.items || []) {
      await pool.execute(
        'INSERT INTO order_items (order_id, item_id, qty) VALUES (?, ?, ?)',
        [order.id, item.id, Number(item.qty || 0)]
      );
    }
  }
}

export async function initializeDatabase() {
  if (!globalWithMysql.__mysqlInit) {
    globalWithMysql.__mysqlInit = (async () => {
      try {
        const serverPool = mysql.createPool({
          host: process.env.DB_HOST || '127.0.0.1',
          port: Number(process.env.DB_PORT || 3306),
          user: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          waitForConnections: true,
          connectionLimit: 2,
        });

        const databaseName = process.env.DB_NAME || 'hch_restaurant';
        await serverPool.query(`CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await serverPool.end();

        const pool = getPool();

        await pool.query(`
          CREATE TABLE IF NOT EXISTS accounts (
            id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(100) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(150) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'staff',
            email VARCHAR(255) NOT NULL DEFAULT '',
            phone VARCHAR(30) NOT NULL DEFAULT '',
            two_factor_enabled TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);

        const [accountColumns] = await pool.query('SHOW COLUMNS FROM accounts');
        const accountColumnSet = new Set((accountColumns as Array<{ Field: string }>).map(column => column.Field));
        if (!accountColumnSet.has('phone')) {
          await pool.query(`
            ALTER TABLE accounts
            ADD COLUMN phone VARCHAR(30) NOT NULL DEFAULT ''
          `);
        }

        await pool.query(`
          CREATE TABLE IF NOT EXISTS auth_otps (
            account_id VARCHAR(64) PRIMARY KEY,
            code_hash VARCHAR(255) NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await pool.query(`
          CREATE TABLE IF NOT EXISTS categories (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(150) NOT NULL UNIQUE,
            icon TEXT NOT NULL
          )
        `);

        await pool.query(`
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

        await pool.query(`
          CREATE TABLE IF NOT EXISTS orders (
            id VARCHAR(64) PRIMARY KEY,
            table_name VARCHAR(50) NOT NULL DEFAULT '',
            floor VARCHAR(50) NOT NULL DEFAULT '',
            customer VARCHAR(255) NOT NULL DEFAULT '',
            total DECIMAL(12,2) NOT NULL DEFAULT 0,
            status VARCHAR(100) NOT NULL DEFAULT 'Chờ xử lý',
            handler VARCHAR(150) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `);

        await pool.query(`
          CREATE TABLE IF NOT EXISTS order_items (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(64) NOT NULL,
            item_id VARCHAR(64) NOT NULL,
            qty INT NOT NULL DEFAULT 0
          )
        `);

        await seedAccounts(pool);
        await seedCategories(pool);
        await seedMenu(pool);
        await seedOrders(pool);
      } catch (error) {
        globalWithMysql.__mysqlInit = undefined;
        throw error;
      }
    })();
  }

  await globalWithMysql.__mysqlInit;
  return getPool();
}
