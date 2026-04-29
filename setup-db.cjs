const mysql = require('mysql2/promise');
async function setup() {
  try {
    const conn = await mysql.createConnection({ host: 'localhost', user: 'root', password: '' });
    await conn.query('CREATE DATABASE IF NOT EXISTS diyacrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;');
    await conn.query("CREATE USER IF NOT EXISTS 'crm_user'@'localhost' IDENTIFIED BY 'password';");
    await conn.query("ALTER USER 'crm_user'@'localhost' IDENTIFIED BY 'password';");
    await conn.query("GRANT ALL PRIVILEGES ON diyacrm.* TO 'crm_user'@'localhost';");
    await conn.query("FLUSH PRIVILEGES;");
    console.log('Database and user created successfully!');
    process.exit(0);
  } catch (e) {
    console.error('Error with root (no password):', e.message);
    process.exit(1);
  }
}
setup();
