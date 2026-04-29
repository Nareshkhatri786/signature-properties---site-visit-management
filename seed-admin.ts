/**
 * seed-admin.ts — Run this ONCE after setting up the database
 * Creates the default admin user with a bcrypt hashed password.
 * Usage: npx tsx seed-admin.ts
 */
import bcrypt from "bcryptjs";
import { pool, testConnection } from "./db.js";
import dotenv from "dotenv";
dotenv.config();

async function seed() {
  await testConnection();
  
  const adminPass = await bcrypt.hash("admin123", 10);
  await pool.execute(
    `INSERT INTO users (id,username,password,name,role,projectId) VALUES (1,'admin',?,'Admin User','admin','p1')
     ON DUPLICATE KEY UPDATE password=VALUES(password)`,
    [adminPass]
  );
  console.log("? Admin user created: username=admin, password=admin123");
  console.log("   IMPORTANT: Change the password after first login!");

  // Seed projects if empty
  const [rows] = await pool.execute("SELECT COUNT(*) AS c FROM projects") as any[];
  if (rows[0].c === 0) {
    await pool.execute("INSERT IGNORE INTO projects (id,name) VALUES ('p1','Signature Properties'),('p2','Shreemad Family'),('p3','Devi Bungalows'),('p4','Royal Rudraksha')");
    console.log("? Default projects seeded.");
  }

  await pool.end();
}

seed().catch(e => { console.error(e); process.exit(1); });
