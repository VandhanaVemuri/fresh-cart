require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
});
async function setup() {
  try {
    console.log('Creating products table...');
    await pool.query(`CREATE TABLE IF NOT EXISTS products (
      product_id VARCHAR(255) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      category VARCHAR(100),
      warehouse VARCHAR(50),
      region VARCHAR(50),
      stock INTEGER DEFAULT 0,
      reserved INTEGER DEFAULT 0,
      price DECIMAL(10,2),
      description TEXT,
      image_url TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`);
    console.log('Creating indexes...');
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_region_stock ON products (region, stock)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_warehouse_category ON products (warehouse, category)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_category ON products (category)`);
    console.log('');
    console.log('SUCCESS! Table and indexes created.');
    console.log('Now run: node scripts/import-products.js');
    await pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    await pool.end();
  }
}
setup();
