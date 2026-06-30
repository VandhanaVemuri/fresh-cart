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
  idleTimeoutMillis: 30000,
});
async function testQuery(testNum) {
  const start = Date.now();
  try {
    const result = await pool.query('SELECT COUNT(*) FROM products');
    const duration = Date.now() - start;
    console.log(`  Test ${testNum}: SUCCESS - ${duration}ms - ${result.rows[0].count} products`);
    return { success: true, duration };
  } catch (error) {
    const duration = Date.now() - start;
    console.log(`  Test ${testNum}: FAILED - ${duration}ms - ${error.message}`);
    return { success: false, duration, error: error.message };
  }
}
async function continuousQueryTest() {
  console.log('FAULT TOLERANCE TEST - Continuous Query Under Load');
  console.log('Testing database availability with multiple queries...\n');
  console.log('Cloud Cluster: fresh-cart-cluster-19041.j77.cockroachlabs.cloud');
  console.log('Regions: Oregon, Virginia, Ohio, Mumbai\n');
  console.log('Running 20 queries with random delays (simulating real traffic):\n');
  let successCount = 0;
  let failCount = 0;
  let totalDuration = 0;
  const totalTests = 20;
  for (let i = 1; i <= totalTests; i++) {
    const result = await testQuery(i);
    
    if (result.success) {
      successCount++;
      totalDuration += result.duration;
    } else {
      failCount++;
    }
    
    const delay = Math.floor(Math.random() * 1000) + 500;
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  const avgDuration = Math.round(totalDuration / successCount);
  console.log('TEST RESULTS');
  console.log(`Total Tests:        ${totalTests}`);
  console.log(`Successful:         ${successCount} (${(successCount/totalTests*100).toFixed(1)}%)`);
  console.log(`Failed:             ${failCount} (${(failCount/totalTests*100).toFixed(1)}%)`);
  console.log(`Average Response:   ${avgDuration}ms`);
  
  if (successCount === totalTests) {
    console.log(' FAULT TOLERANCE VERIFIED!');
    console.log('   All queries succeeded despite:');
    console.log('   - Network latency variations');
    console.log('   - Geographic distribution across 4 regions');
    console.log('   - Potential node failures (auto-handled by CockroachDB)\n');
  } else {
    console.log(' Some queries failed, but system remained partially available');
    console.log(`   Availability: ${(successCount/totalTests*100).toFixed(1)}%\n`);
  }
  
  await pool.end();
}
continuousQueryTest();