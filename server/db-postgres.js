const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// PostgreSQL connection pool
// Prefer DATABASE_URL for hosted providers like Supabase.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'invoiceease',
      password: process.env.DB_PASSWORD || 'postgres',
      port: process.env.DB_PORT || 5432,
    });

// Initialize database schema on startup
const initializeDatabase = async () => {
  try {
    // Run migrations in order
    const migrations = ['000_create_users_table.sql', '001_create_conversations_table.sql', '002_add_missing_fields.sql', '003_add_client_fields.sql'];
    
    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, 'migrations', migration);
      if (fs.existsSync(migrationPath)) {
        const schema = fs.readFileSync(migrationPath, 'utf8');
        await pool.query(schema);
        console.log(`✅ Migration ${migration} executed`);
      }
    }
    
    console.log('✅ Database schema initialized');
  } catch (err) {
    console.error('❌ Failed to initialize database:', err.message);
    throw err;
  }
};

// Query helpers
const dbQuery = async (text, params) => {
  const result = await pool.query(text, params);
  return result.rows;
};

const dbQuerySingle = async (text, params) => {
  const result = await pool.query(text, params);
  return result.rows[0] || null;
};

const dbExecute = async (text, params) => {
  const result = await pool.query(text, params);
  return result.rowCount;
};

// USER FUNCTIONS
const createUser = async (userData) => {
  const { id, email, whatsapp, passwordHash, businessName, gstNumber, panNumber, address, city, pincode, bankName, accountNumber, ifscCode, upiId, logoUrl, templateStyle, showWatermark } = userData;
  
  const result = await pool.query(
    `INSERT INTO users (id, email, whatsapp, password_hash, business_name, gst_number, pan_number, address, city, pincode, bank_name, account_number, ifsc_code, upi_id, logo_url, template_style, show_watermark, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW())
     RETURNING id, email, whatsapp, business_name, gst_number, pan_number, address, city, pincode, bank_name, account_number, ifsc_code, upi_id, plan, invoices_this_month, logo_url as "logoUrl", template_style as "templateStyle", show_watermark as "showWatermark", telegram_chat_id, created_at`,
    [id, email, whatsapp, passwordHash, businessName, gstNumber, panNumber, address, city, pincode, bankName, accountNumber, ifscCode, upiId, logoUrl || '', templateStyle || 'modern', showWatermark === undefined ? true : showWatermark]
  );
  return result.rows[0];
};

const getUserByEmail = async (email) => {
  return dbQuerySingle(
    `SELECT id, email, whatsapp, password_hash as "passwordHash", business_name as "businessName", gst_number as "gstNumber", pan_number as "panNumber", address, city, pincode, bank_name as "bankName", account_number as "accountNumber", ifsc_code as "ifscCode", upi_id as "upiId", plan, invoices_this_month as "invoicesThisMonth", logo_url as "logoUrl", template_style as "templateStyle", show_watermark as "showWatermark", telegram_chat_id, created_at as "createdAt" FROM users WHERE email = $1`,
    [email]
  );
};

const getUserById = async (id) => {
  return dbQuerySingle(
    `SELECT id, email, whatsapp, password_hash as "passwordHash", business_name as "businessName", gst_number as "gstNumber", pan_number as "panNumber", address, city, pincode, bank_name as "bankName", account_number as "accountNumber", ifsc_code as "ifscCode", upi_id as "upiId", plan, invoices_this_month as "invoicesThisMonth", logo_url as "logoUrl", template_style as "templateStyle", show_watermark as "showWatermark", telegram_chat_id, created_at as "createdAt" FROM users WHERE id = $1`,
    [id]
  );
};

const getUserByWhatsApp = async (whatsapp) => {
  return dbQuerySingle(
    `SELECT id, email, whatsapp, password_hash as "passwordHash", business_name as "businessName", gst_number as "gstNumber", pan_number as "panNumber", address, city, pincode, bank_name as "bankName", account_number as "accountNumber", ifsc_code as "ifscCode", upi_id as "upiId", plan, invoices_this_month as "invoicesThisMonth", logo_url as "logoUrl", template_style as "templateStyle", show_watermark as "showWatermark", telegram_chat_id, created_at as "createdAt" FROM users WHERE whatsapp = $1`,
    [whatsapp]
  );
};

const updateUser = async (userId, updates) => {
  const allowedFields = ['business_name', 'gst_number', 'pan_number', 'address', 'city', 'pincode', 'bank_name', 'account_number', 'ifsc_code', 'upi_id', 'plan', 'invoices_this_month', 'logo_url', 'template_style', 'show_watermark', 'telegram_chat_id', 'whatsapp'];
  
  // Convert camelCase to snake_case for DB fields if needed
  const mappedUpdates = {};
  for (const [key, value] of Object.entries(updates)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    if (allowedFields.includes(snakeKey)) {
      mappedUpdates[snakeKey] = value;
    }
  }

  const fields = Object.keys(mappedUpdates);
  if (fields.length === 0) return null;
  
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
  const values = fields.map(f => mappedUpdates[f]);
  
  const result = await pool.query(
    `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${fields.length + 1} RETURNING *`,
    [...values, userId]
  );
  return result.rows[0];
};

const updateUserPassword = async (userId, newPasswordHash) => {
  const result = await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id`,
    [newPasswordHash, userId]
  );
  return result.rows[0];
};

// INVOICE FUNCTIONS
const createInvoice = async (invoiceData) => {
  const { id, userId, invoiceNumber, clientName, clientGst, clientAddress, clientMobile, service, items, amount, gstRate, gstAmount, totalAmount, notes, dueDate, pdfUrl, status, date } = invoiceData;
  
  const itemsJson = items ? JSON.stringify(items) : '[]';
  
  const result = await pool.query(
    `INSERT INTO invoices (id, user_id, invoice_number, client_name, client_gst, client_address, client_mobile, service_description, items, subtotal, gst_rate, gst_amount, cgst, sgst, igst, total, gst_type, notes, due_date, pdf_url, status, invoice_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, 'intrastate', $17, $18, $19, $20, $21, NOW(), NOW())
     RETURNING *`,
    [id, userId, invoiceNumber, clientName, clientGst, clientAddress || null, clientMobile || null, service, itemsJson, amount, gstRate, gstAmount, gstAmount/2, gstAmount/2, 0, totalAmount, notes || '', dueDate || null, pdfUrl || null, status, date]
  );
  return result.rows[0];
};

const getInvoiceById = async (invoiceId) => {
  return dbQuerySingle(
    `SELECT id, user_id as "userId", invoice_number as "invoiceNumber", client_name as "clientName", client_gst as "clientGst", client_address as "clientAddress", client_mobile as "clientMobile", service_description as "service", items, subtotal as "amount", gst_rate as "gstRate", gst_amount as "gstAmount", cgst, sgst, igst, total as "totalAmount", gst_type as "gstType", pdf_url as "pdfUrl", notes, due_date as "dueDate", payment_details as "payment", status, invoice_date as "date", created_at as "createdAt" FROM invoices WHERE id = $1`,
    [invoiceId]
  );
};

const getUserInvoices = async (userId) => {
  return dbQuery(
    `SELECT id, user_id as "userId", invoice_number as "invoiceNumber", client_name as "clientName", client_gst as "clientGst", client_address as "clientAddress", client_mobile as "clientMobile", service_description as "service", items, subtotal as "amount", gst_rate as "gstRate", gst_amount as "gstAmount", cgst, sgst, igst, total as "totalAmount", gst_type as "gstType", pdf_url as "pdfUrl", notes, due_date as "dueDate", payment_details as "payment", status, invoice_date as "date", created_at as "createdAt" FROM invoices WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
};

const updateInvoiceStatus = async (invoiceId, status, paymentDetails = null) => {
  if (paymentDetails) {
    const result = await pool.query(
      `UPDATE invoices SET status = $1, payment_details = $2::jsonb, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [status, JSON.stringify(paymentDetails), invoiceId]
    );
    return result.rows[0];
  } else {
    const result = await pool.query(
      `UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, invoiceId]
    );
    return result.rows[0];
  }
};

const updateInvoicePdfUrl = async (invoiceId, pdfUrl) => {
  const result = await pool.query(
    `UPDATE invoices SET pdf_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [pdfUrl, invoiceId]
  );
  return result.rows[0];
};

const deleteInvoice = async (invoiceId) => {
  return dbExecute(`DELETE FROM invoices WHERE id = $1`, [invoiceId]);
};

const getNextInvoiceNumber = async (userId) => {
  const result = await dbQuerySingle(
    `SELECT COUNT(*) as count FROM invoices WHERE user_id = $1`,
    [userId]
  );
  const count = result ? parseInt(result.count) + 1 : 1;
  return `INV-${String(count).padStart(3, '0')}`;
};

// CONVERSATION FUNCTIONS
const getConversation = async (whatsappNumber) => {
  return dbQuerySingle(
    'SELECT * FROM conversations WHERE whatsapp_number = $1',
    [whatsappNumber]
  );
};

const createConversation = async (userId, whatsappNumber) => {
  const result = await pool.query(
    `INSERT INTO conversations (user_id, whatsapp_number, state, data, started_at, updated_at)
     VALUES ($1, $2, 'idle', '{}', NOW(), NOW())
     RETURNING *`,
    [userId, whatsappNumber]
  );
  return result.rows[0];
};

const updateConversationState = async (whatsappNumber, state) => {
  await dbExecute(
    'UPDATE conversations SET state = $1, updated_at = NOW() WHERE whatsapp_number = $2',
    [state, whatsappNumber]
  );
};

const updateConversationData = async (whatsappNumber, data) => {
  await dbExecute(
    `UPDATE conversations SET data = $1::jsonb, updated_at = NOW() WHERE whatsapp_number = $2`,
    [JSON.stringify(data), whatsappNumber]
  );
};

const resetConversation = async (whatsappNumber) => {
  await dbExecute(
    `UPDATE conversations SET state = 'idle', data = '{}', updated_at = NOW() WHERE whatsapp_number = $1`,
    [whatsappNumber]
  );
};

module.exports = {
  pool,
  initializeDatabase,
  dbQuery,
  dbQuerySingle,
  dbExecute,
  createUser,
  getUserByEmail,
  getUserById,
  getUserByWhatsApp,
  updateUser,
  updateUserPassword,
  createInvoice,
  getInvoiceById,
  getUserInvoices,
  updateInvoiceStatus,
  updateInvoicePdfUrl,
  deleteInvoice,
  getNextInvoiceNumber,
  getConversation,
  createConversation,
  updateConversationState,
  updateConversationData,
  resetConversation,
};
