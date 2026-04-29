const fs = require('fs');
const mysql = require('mysql2/promise');
async function setup() {
  try {
    const conn = await mysql.createConnection({ host: 'localhost', user: 'crm_user', password: 'password', database: 'diyacrm', multipleStatements: true });
    const schema = fs.readFileSync('schema.sql', 'utf8');
    await conn.query(schema);
    console.log('Schema imported successfully!');
    process.exit(0);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}
setup();
