import mysql from 'mysql2/promise';


// MySQL Connection Pool
export const pool = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '3306'),
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASS     || '',
  database: process.env.DB_NAME     || 'diyacrm',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: 'Z',
  dateStrings: false,
  charset: 'utf8mb4',
});

// Monkey-patch pool.execute to catch and auto-fix undefined bindings globally
const originalExecute = pool.execute.bind(pool);
(pool as any).execute = async function(sql: string, params: any[]) {
  if (params && params.includes(undefined)) {
    console.error("CRITICAL SQL BUG: Found 'undefined' in parameters array!");
    console.error("SQL:", sql);
    console.trace("Stack trace:");
    params = params.map(p => p === undefined ? null : p); // Auto-fix
  }
  return originalExecute(sql, params);
};

// Helper: run a query and return rows
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  if (params && params.includes(undefined)) {
    console.error("CRITICAL SQL BUG: Found 'undefined' in parameters array!");
    console.error("SQL:", sql);
    console.trace("Stack trace:");
    params = params.map(p => p === undefined ? null : p); // Auto-fix
  }
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

// Helper: run a query, return first row or null
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

// Helper: INSERT/UPDATE/DELETE — return OkPacket
export async function execute(sql: string, params?: any[]): Promise<mysql.ResultSetHeader> {
  if (params && params.includes(undefined)) {
    console.error("CRITICAL SQL BUG: Found 'undefined' in parameters array!");
    console.error("SQL:", sql);
    console.trace("Stack trace:");
    params = params.map(p => p === undefined ? null : p); // Auto-fix
  }
  const [result] = await pool.execute(sql, params);
  return result as mysql.ResultSetHeader;
}

// Utility: parse JSON fields in a row
export function parseJsonFields(row: any, fields: string[]): any {
  if (!row) return row;
  const copy = { ...row };
  for (const f of fields) {
    if (copy[f] && typeof copy[f] === 'string') {
      try { copy[f] = JSON.parse(copy[f]); } catch { /* keep as-is */ }
    }
  }
  return copy;
}

// Utility: stringify JSON fields before insert/update
export function stringifyJsonFields(data: any, fields: string[]): any {
  const copy = { ...data };
  for (const f of fields) {
    if (copy[f] !== undefined && typeof copy[f] !== 'string') {
      copy[f] = JSON.stringify(copy[f]);
    }
  }
  return copy;
}

// Test connection on startup
export async function testConnection(): Promise<void> {
  try {
    const conn = await pool.getConnection();
    console.log('[DB] ✅ MySQL connection successful');
    conn.release();
  } catch (err: any) {
    console.error('[DB] ❌ MySQL connection failed:', err.message);
    throw err;
  }
}

export default pool;
