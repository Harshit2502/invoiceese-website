const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: '127.0.0.1',
  database: 'postgres',
  password: '',
  port: 5435,
});

async function run() {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Connection to custom local PG successful. Server time:', res.rows[0].now);
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
  } finally {
    await pool.end();
  }
}

run();
