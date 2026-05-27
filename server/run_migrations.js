require('dotenv').config();
const { initializeDatabase } = require('./db-postgres');

initializeDatabase().then(() => {
  console.log('✅ Migrations completed successfully');
  process.exit(0);
}).catch(err => {
  console.error('❌ Migrations failed:', err);
  process.exit(1);
});
