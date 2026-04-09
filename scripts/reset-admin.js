const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hch_restaurant',
  });

  try {
    const email = 'conghuy62324@gmail.com';
    const rawPass = 'Huy04052004@';
    const hash = await bcrypt.hash(rawPass, 10);
    
    // Check if table exists
    const [tables] = await pool.query("SHOW TABLES LIKE 'accounts'");
    if (tables.length === 0) {
      console.log('Chua khoi tao DB. Vui long chay app (npm run dev) de khoi tao.');
      process.exit(0);
    }

    const [rows] = await pool.execute('SELECT id FROM accounts WHERE username = "admin"');
    if (rows.length > 0) {
      await pool.execute(
        'UPDATE accounts SET email = ?, password_hash = ?, two_factor_enabled = 1 WHERE username = "admin"',
        [email, hash]
      );
      console.log('Da update Admin thanh cong.');
    } else {
      await pool.execute(
        'INSERT INTO accounts (id, username, password_hash, name, role, email, two_factor_enabled) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['a1', 'admin', hash, 'Administrator', 'admin', email, 1]
      );
      console.log('Da them tai khoan Admin moi.');
    }
  } catch(e) {
    console.error('Loi khi update admin:', e.message);
  } finally {
    await pool.end();
  }
}

resetAdmin();
