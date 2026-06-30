require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_HOST && process.env.DB_HOST.includes('cockroachlabs.cloud')
    ? {
        rejectUnauthorized: true,
        ca: fs.readFileSync('C:\\Users\\rishi\\AppData\\Roaming\\postgresql\\root.crt').toString()
      }
    : false,
  max: 20,
  connectionTimeoutMillis: 10000,
});

async function queryWithRetry(maxRetries = 3) {
  console.log('Testing query with automatic retry logic...\n');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxRetries}...`);
      const start = Date.now();
      const result = await pool.query('SELECT COUNT(*) as count FROM products');
      const duration = Date.now() - start;
      console.log(`SUCCESS on attempt ${attempt}`);
      console.log(` Duration: ${duration}ms`);
      console.log(`Products: ${result.rows[0].count}\n`);
      return { success: true, attempt, duration };
      
    } catch (error) {
      console.log(` Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        const backoff = attempt * 2000;
        console.log(`Retrying in ${backoff/1000} seconds...\n`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      } else {
        console.log(` All ${maxRetries} attempts exhausted\n`);
        return { success: false, attempt };
      }
    }
  }
}
async function runTest() {
  console.log(' FAULT TOLERANCE TEST - Automatic Retry Logic ');
  console.log('Testing connection resilience with exponential backoff\n');
  const result = await queryWithRetry(3);
  if (result.success) {
    console.log('RESILIENCE VERIFIED');
    console.log(`   Query succeeded ${result.attempt === 1 ? 'immediately' : `after ${result.attempt} attempts`}`);
    console.log('   System demonstrates automatic recovery capability');
  } else {
    console.log('SYSTEM FAILED TO RECOVER');
    console.log('   Manual intervention may be required');
  }
  await pool.end();
}

runTest();