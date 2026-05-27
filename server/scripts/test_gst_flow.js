require('dotenv').config();
const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

const DB_USER = process.env.DB_USER || 'postgres';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_NAME = process.env.DB_NAME || 'invoiceease';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

const client = new Client({
  user: DB_USER,
  host: DB_HOST,
  database: DB_NAME,
  password: DB_PASSWORD,
  port: DB_PORT,
});

async function runTests() {
  try {
    await client.connect();
    console.log('🔌 Connected to local PostgreSQL for integration testing');

    // 1. Get a mock user
    const usersRes = await client.query('SELECT id, email FROM users LIMIT 1');
    let userId;
    if (usersRes.rows.length === 0) {
      userId = uuidv4();
      await client.query(
        `INSERT INTO users (id, email, password_hash, business_name, created_at, updated_at) 
         VALUES ($1, 'test@example.com', 'hash', 'Test Business', NOW(), NOW())`,
        [userId]
      );
      console.log('✅ Created mock user:', userId);
    } else {
      userId = usersRes.rows[0].id;
      console.log('✅ Using existing user:', userId);
    }

    // 2. Create a purchase invoice with ITC eligibility
    const docId = uuidv4();
    const docNo = 'PI-' + Date.now();
    await client.query(
      `INSERT INTO documents (id, user_id, doc_type, direction, doc_number, party_name, total, subtotal, gst_amount, itc_eligibility, created_at, updated_at)
       VALUES ($1, $2, 'purchase_invoice', 'inbound', $3, 'Supplier Corp', 11800, 10000, 1800, 'capital_goods', NOW(), NOW())`,
      [docId, userId, docNo]
    );
    console.log('✅ Created purchase invoice with ITC: capital_goods');

    // Verify itc_eligibility in documents table
    const checkDoc = await client.query('SELECT doc_number, itc_eligibility FROM documents WHERE id = $1', [docId]);
    console.log('🔎 Verification in DB:', checkDoc.rows[0]);
    if (checkDoc.rows[0].itc_eligibility !== 'capital_goods') {
      throw new Error('itc_eligibility value did not match!');
    }

    // 3. Test update ITC eligibility
    await client.query('UPDATE documents SET itc_eligibility = $1 WHERE id = $2', ['input_services', docId]);
    const checkUpdated = await client.query('SELECT itc_eligibility FROM documents WHERE id = $1', [docId]);
    console.log('🔎 Verification after update:', checkUpdated.rows[0]);
    if (checkUpdated.rows[0].itc_eligibility !== 'input_services') {
      throw new Error('itc_eligibility was not updated!');
    }

    // 4. Test GSTR filing status upsert
    const month = '2026-05';
    const arn = 'AA270526000123A';
    await client.query(
      `INSERT INTO gstr_filing_status (user_id, filing_month, arn, status, filed_at, updated_at)
       VALUES ($1, $2, $3, 'filed', NOW(), NOW())
       ON CONFLICT (user_id, filing_month)
       DO UPDATE SET arn = EXCLUDED.arn, status = EXCLUDED.status, updated_at = NOW()`,
      [userId, month, arn]
    );
    console.log('✅ Upserted GSTR filing status for month:', month);

    const checkFiling = await client.query('SELECT filing_month, arn, status FROM gstr_filing_status WHERE user_id = $1 AND filing_month = $2', [userId, month]);
    console.log('🔎 Verification of filing status:', checkFiling.rows[0]);
    if (checkFiling.rows[0].arn !== arn) {
      throw new Error('ARN value did not match!');
    }

    console.log('\n🌟 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🌟');
    process.exit(0);
  } catch (err) {
    console.error('❌ Integration test failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runTests();
