require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
console.log('Environment Check:');
console.log('DB_HOST: ' + process.env.DB_HOST);
console.log('DB_PORT: ' + process.env.DB_PORT);
console.log('DB_NAME: ' + process.env.DB_NAME);
console.log('');
const isCloud = process.env.DB_HOST && process.env.DB_HOST.includes('cockroachlabs.cloud');
if (!isCloud) {
  console.error('ERROR: Not configured for cloud database');
  console.error('DB_HOST should contain cockroachlabs.cloud');
  console.error('Current DB_HOST: ' + process.env.DB_HOST);
  process.exit(1);
}
const sslCertPath = process.env.DB_SSL_CERT || 
  path.join(process.env.APPDATA || '', 'postgresql', 'root.crt');
console.log('Certificate path: ' + sslCertPath);
console.log('Certificate exists: ' + (fs.existsSync(sslCertPath) ? 'Yes' : 'No'));
console.log('');
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(sslCertPath).toString()
  },
  max: 20,
  connectionTimeoutMillis: 10000,
});
function calculateStats(times) {
  if (times.length === 0) return null;
  times.sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const p99 = times[Math.floor(times.length * 0.99)];
  const min = times[0];
  const max = times[times.length - 1];
  return { avg, p50, p95, p99, min, max };
}
async function test1_QueryLatency() {
  console.log('TEST 1: Cloud Query Latency Analysis');
  console.log('');
  const queries = [
    { name: 'Simple SELECT', sql: 'SELECT * FROM products LIMIT 10' },
    { name: 'Regional Filter', sql: 'SELECT * FROM products WHERE region = $1 LIMIT 10', params: ['North'] },
    { name: 'Warehouse Filter', sql: 'SELECT * FROM products WHERE warehouse = $1 LIMIT 10', params: ['WH-1'] },
    { name: 'Aggregation', sql: 'SELECT region, COUNT(*) FROM products GROUP BY region' }
  ];
  for (const query of queries) {
    console.log('Testing: ' + query.name);
    const times = [];
    const iterations = 20;
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      try {
        await pool.query(query.sql, query.params || []);
        const duration = Date.now() - start;
        times.push(duration);
        if (i === 0) {
          console.log('  First query: ' + duration + 'ms');
        }
      } catch (error) {
        console.log('  Query ' + (i+1) + ' failed: ' + error.message);
        break;
      }
    }

    if (times.length > 0) {
      const stats = calculateStats(times);
      console.log('  Completed ' + times.length + ' queries');
      console.log('  Average: ' + stats.avg.toFixed(2) + 'ms');
      console.log('  P50: ' + stats.p50 + 'ms | P95: ' + stats.p95 + 'ms | P99: ' + stats.p99 + 'ms');
      console.log('  Min: ' + stats.min + 'ms | Max: ' + stats.max + 'ms');
      console.log('');
    } else {
      console.log('  All queries failed');
      console.log('');
    }
  }
  console.log('TEST 1 COMPLETE');
  console.log('');
}
async function test2_Throughput() {
  console.log('TEST 2: Cloud Throughput Test (30 seconds)');
  console.log('');
  console.log('Running sustained load test...');
  console.log('');
  const start_time = Date.now();
  const end_time = start_time + 30000;
  let success = 0;
  let errors = 0;
  const latencies = [];
  while (Date.now() < end_time) {
    const query_start = Date.now();
    try {
      await pool.query('SELECT COUNT(*) FROM products');
      latencies.push(Date.now() - query_start);
      success++;
      if (success % 10 === 0) process.stdout.write('.');
    } catch (error) {
      errors++;
    }
  }
  const total = (Date.now() - start_time) / 1000;
  const qps = (success / total).toFixed(2);
  const stats = calculateStats(latencies);
  console.log('');
  console.log('');
  console.log('  Duration: ' + total.toFixed(1) + 's');
  console.log('  Successful queries: ' + success);
  console.log('  Failed queries: ' + errors);
  console.log('  Throughput: ' + qps + ' QPS');
  if (stats) {
    console.log('  Average latency: ' + stats.avg.toFixed(2) + 'ms');
    console.log('  P95 latency: ' + stats.p95 + 'ms');
  }
  console.log('');
  console.log('TEST 2 COMPLETE');
  console.log('');
}

async function test3_ConcurrentQueries() {
  console.log('TEST 3: Concurrent Query Performance');
  console.log(''); 
  const levels = [5, 10, 20];
  for (const concurrency of levels) {
    console.log('Testing ' + concurrency + ' concurrent queries...');
    const queries = Array(concurrency).fill(null).map(() =>
      pool.query('SELECT * FROM products WHERE region = $1 LIMIT 10', ['North'])
    );
    const start = Date.now();
    const results = await Promise.allSettled(queries);
    const duration = Date.now() - start;
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log('  Total time: ' + duration + 'ms');
    console.log('  Avg per query: ' + (duration / concurrency).toFixed(2) + 'ms');
    console.log('  Success: ' + successful + ' | Failed: ' + failed);
    console.log('  Success rate: ' + ((successful / concurrency) * 100).toFixed(1) + '%');
    console.log('');
  }
  console.log('TEST 3 COMPLETE');
  console.log('');
}
async function runTests() {
  console.log('');
  console.log('CLOUD PERFORMANCE TEST - Multi-Region Database');
  console.log('');
  console.log('Testing: ' + process.env.DB_HOST);
  console.log('Database: ' + process.env.DB_NAME);
  console.log(''); 
  try {
    console.log('Testing connection...');
    const result = await pool.query('SELECT version()');
    console.log('Connected to: ' + result.rows[0].version.substring(0, 50) + '...');
    console.log('');
    await test1_QueryLatency();
    await test2_Throughput();
    await test3_ConcurrentQueries();  
    console.log('ALL PERFORMANCE TESTS COMPLETED');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('Fatal Error: ' + error.message);
    console.error('Stack: ' + error.stack);
  } finally {
    await pool.end();
    process.exit(0);
  }
}
runTests();