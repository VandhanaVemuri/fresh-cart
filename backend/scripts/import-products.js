require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 26257,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'freshcart',
  ssl: { rejectUnauthorized: false }
});

function parseCSV(file_path) {
  const content = fs.readFileSync(file_path, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

  const products = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = lines[i].split(',');
    if (values.length < 5) continue;

    const product = {};
    headers.forEach((header, index) => {
      product[header] = values[index] ? values[index].trim().replace(/"/g, '') : '';
    });

    products.push(product);
  }

  return products;
}
const regions = ['North', 'South', 'East', 'West'];
const warehouses = ['WH-1', 'WH-2', 'WH-3', 'WH-4', 'WH-5', 'WH-6'];

async function importProducts() {
  console.log('\nStarting Amazon Product Import...\n');

  try {
    const csv_path = path.join(__dirname, '../data/home/sdf/amazon_products.csv');
    console.log('Reading CSV file:', csv_path);

    if (!fs.existsSync(csv_path)) {
      console.error('CSV file not found!');
      return;
    }

    const products = parseCSV(csv_path);
    console.log(`Found ${products.length} products in CSV\n`);

    console.log('Clearing existing products...');
    await pool.query('TRUNCATE TABLE products CASCADE');
    console.log('Products table cleared\n');

    console.log('Importing products...');
    let imported = 0;
    let failed = 0;
    
    for (const product of products) {
      try {
        let price = 0;
        if (product['Selling Price']) {
          const match = product['Selling Price'].match(/[\d,]+\.?\d*/);
          if (match) {
            price = parseFloat(match[0].replace(/,/g, ''));
          }
        }

        if (!price || price === 0) continue;

        const stock = Math.floor(Math.random() * 500) + 50;
        const region = regions[Math.floor(Math.random() * regions.length)];
        const warehouse = warehouses[Math.floor(Math.random() * warehouses.length)];

        await pool.query(
          `INSERT INTO products (
            product_id, name, category, warehouse, region,
            stock, price, description, image_url
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            product['Uniq Id'] || `PROD-${Date.now()}-${imported}`,
            (product['Product Name'] || 'Unknown Product').substring(0, 255),
            (product['Category'] || 'General').substring(0, 100),
            warehouse,
            region,
            stock,
            price,
            (product['About Product'] || '').substring(0, 1000),
            product['Image'] || ''
          ]
        );

        imported++;

        if (imported % 100 === 0) {
          process.stdout.write(`  Imported ${imported} products...\r`);
        }

      } catch (err) {
        failed++;
      }
    }
    
    console.log(`\nImport Complete!`);
    console.log(`- Successfully imported: ${imported} products`);
    console.log(`- Failed: ${failed} products`);

    console.log('\nDistribution by Region:');
    const region_stats = await pool.query(`
      SELECT region, COUNT(*) as count, SUM(stock) as total_stock
      FROM products
      GROUP BY region
      ORDER BY region
    `);

    region_stats.rows.forEach(row => {
      console.log(`  ${row.region}: ${row.count} products, ${row.total_stock} total stock`);
    });

    console.log('\nDistribution by Warehouse:');
    const warehouse_stats = await pool.query(`
      SELECT warehouse, COUNT(*) as count
      FROM products
      GROUP BY warehouse
      ORDER BY warehouse
    `);

    warehouse_stats.rows.forEach(row => {
      console.log(`  ${row.warehouse}: ${row.count} products`);
    });

  } catch (error) {
    console.error('\nImport failed:', error.message);
  } finally {
    await pool.end();
  }
}

importProducts();