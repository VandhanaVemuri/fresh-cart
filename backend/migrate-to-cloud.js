require('dotenv').config();
const { Pool } = require('pg');
const localPool = new Pool({
  host: 'localhost',
  port: 26257,
  user: 'root',
  password: '',
  database: 'freshcart',
  ssl: false
});
const cloudPool = new Pool({
  host: 'fresh-cart-cluster-19041.j77.cockroachlabs.cloud',
  port: 26257,
  user: 'rishitha',
  password: 'BNC2GF6d5jh6x7Cqo-rduw',
  database: 'defaultdb',
  ssl: {
    rejectUnauthorized: true,
    ca: require('fs').readFileSync('C:\\Users\\rishi\\AppData\\Roaming\\postgresql\\root.crt').toString()
  }
});

async function migrateProducts() {
  console.log('Starting migration...\n');

  try {
    console.log('Fetching products from local database...');
    const result = await localPool.query('SELECT * FROM products');
    const products = result.rows;
    console.log(`Found ${products.length} products\n`);
    console.log('Inserting products into cloud database...');
    
    let successCount = 0;
    let errorCount = 0;
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      try {
        await cloudPool.query(
          `INSERT INTO products (product_id, name, category, warehouse, region, stock, reserved, price, description, image_url)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [p.product_id, p.name, p.category, p.warehouse, p.region, p.stock, p.reserved, p.price, p.description, p.image_url]
        );
        successCount++;
        if ((i + 1) % 100 === 0) {
          console.log(` Progress: ${i + 1}/${products.length} products...`);
        }
      } catch (err) {
        errorCount++;
        console.error(` Error inserting product ${p.product_id}:`, err.message);
      }
    }

    console.log('\nMigration complete!');
    console.log(`   Successful: ${successCount}`);
    console.log(`   Failed: ${errorCount}`);
    const cloudCount = await cloudPool.query('SELECT COUNT(*) FROM products');
    console.log(`\nCloud database now has ${cloudCount.rows[0].count} products`);

  } catch (error) {
    console.error('Migration failed:', error.message);
  } finally {
    await localPool.end();
    await cloudPool.end();
    console.log('\nDone!');
  }
}
migrateProducts();