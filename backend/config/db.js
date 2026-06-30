const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const sslCertPath = process.env.DB_SSL_CERT || 
  path.join(process.env.APPDATA || '', 'postgresql', 'root.crt');
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 26257,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'freshcart',
  ssl: process.env.DB_HOST && process.env.DB_HOST.includes('cockroachlabs.cloud')
    ? {
        rejectUnauthorized: false,
        ca: fs.existsSync(sslCertPath) ? fs.readFileSync(sslCertPath).toString() : undefined
      }
    : false,
  max: 20,                        
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,       
  allowExitOnIdle: false,         
});

pool.on('connect', (client) => {
  console.log('New database connection established');
});

pool.on('error', (err, client) => {
  console.error('Database connection error:', err.message);
  console.log('Connection pool will automatically retry...');
});

pool.on('remove', () => {
  console.log('Connection removed from pool (will be replaced automatically)');
});

const testConnection = async () => {
  try {
    const result = await pool.query('SELECT version()');
    const version = result.rows[0].version.substring(0, 50);
    console.log(`Database version: ${version}...`);

    try {
      const nodes = await pool.query('SELECT node_id, address FROM crdb_internal.gossip_nodes ORDER BY node_id');
      console.log(`Cluster nodes: ${nodes.rows.length}`);
      nodes.rows.forEach(node => {
        console.log(`  - Node ${node.node_id}: ${node.address}`);
      });
    } catch (err) {
      console.log('Running on CockroachDB Serverless (node info not available)');
    }

    const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    const table_list = tables.rows.map(t => t.table_name).join(', ') || 'none';
    console.log(`Tables: ${table_list}`);
    
    return true;
  } catch (error) {
    console.error('Connection failed:', error.message);
    console.error('Full error:', error);
    return false;
  }
};

module.exports = { pool, testConnection };