require('dotenv').config();
const { testConnection, pool } = require('./db');
async function test() {
  console.log('\nTesting CockroachDB Connection...\n');
  const success = await testConnection();
  if (success) {
    console.log('\nAll systems operational!\n');
  } else {
    console.log('\nConnection failed - check if containers are running\n');
  }
  await pool.end();
  process.exit(0);
}
test();