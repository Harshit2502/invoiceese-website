require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'invoiceease',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function run() {
  try {
    console.log('--- USERS ---');
    const usersRes = await pool.query('SELECT id, email, business_name, plan FROM users');
    console.log(usersRes.rows);

    console.log('\n--- DOCUMENTS COUNT BY TYPE ---');
    const countRes = await pool.query('SELECT doc_type, COUNT(*) FROM documents GROUP BY doc_type');
    console.log(countRes.rows);

    console.log('\n--- RECENT DOCUMENTS ---');
    const docsRes = await pool.query('SELECT id, user_id, doc_type, direction, doc_number, party_name, total, created_at FROM documents ORDER BY created_at DESC LIMIT 10');
    console.log(docsRes.rows);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
