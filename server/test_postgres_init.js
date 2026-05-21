const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { initializeDatabase } = require('./db-postgres');

async function testInit() {
  console.log('Initializing database on port:', process.env.DB_PORT);
  await initializeDatabase();
  console.log('DB init test complete!');
}

testInit().catch(console.error);
