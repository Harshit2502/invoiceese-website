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
    const migrations = ['000_create_users_table.sql', '001_create_conversations_table.sql', '002_add_missing_fields.sql', '003_add_client_fields.sql', '004_add_gst_invoice_fields.sql', '005_add_inventory_and_purchases.sql'];
    
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
  const { id, email, whatsapp, passwordHash, businessName, gstNumber, panNumber, address, city, pincode, state, stateCode, bankName, accountNumber, ifscCode, upiId, logoUrl, templateStyle, showWatermark } = userData;
  
  const result = await pool.query(
    `INSERT INTO users (id, email, whatsapp, password_hash, business_name, gst_number, pan_number, address, city, pincode, state, state_code, bank_name, account_number, ifsc_code, upi_id, logo_url, template_style, show_watermark, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW())
     RETURNING id, email, whatsapp, business_name, gst_number, pan_number, address, city, pincode, state, state_code as "stateCode", bank_name, account_number, ifsc_code, upi_id, plan, invoices_this_month, logo_url as "logoUrl", template_style as "templateStyle", show_watermark as "showWatermark", telegram_chat_id, created_at`,
    [id, email, whatsapp, passwordHash, businessName, gstNumber, panNumber, address, city, pincode, state || '', stateCode || '', bankName, accountNumber, ifscCode, upiId, logoUrl || '', templateStyle || 'modern', showWatermark === undefined ? true : showWatermark]
  );
  return result.rows[0];
};

const getUserByEmail = async (email) => {
  return dbQuerySingle(
    `SELECT id, email, whatsapp, password_hash as "passwordHash", business_name as "businessName", gst_number as "gstNumber", pan_number as "panNumber", address, city, pincode, state, state_code as "stateCode", bank_name as "bankName", account_number as "accountNumber", ifsc_code as "ifscCode", upi_id as "upiId", plan, invoices_this_month as "invoicesThisMonth", logo_url as "logoUrl", template_style as "templateStyle", show_watermark as "showWatermark", telegram_chat_id, created_at as "createdAt" FROM users WHERE email = $1`,
    [email]
  );
};

const getUserById = async (id) => {
  return dbQuerySingle(
    `SELECT id, email, whatsapp, password_hash as "passwordHash", business_name as "businessName", gst_number as "gstNumber", pan_number as "panNumber", address, city, pincode, state, state_code as "stateCode", bank_name as "bankName", account_number as "accountNumber", ifsc_code as "ifscCode", upi_id as "upiId", plan, invoices_this_month as "invoicesThisMonth", logo_url as "logoUrl", template_style as "templateStyle", show_watermark as "showWatermark", telegram_chat_id, created_at as "createdAt" FROM users WHERE id = $1`,
    [id]
  );
};

const getUserByWhatsApp = async (whatsapp) => {
  return dbQuerySingle(
    `SELECT id, email, whatsapp, password_hash as "passwordHash", business_name as "businessName", gst_number as "gstNumber", pan_number as "panNumber", address, city, pincode, state, state_code as "stateCode", bank_name as "bankName", account_number as "accountNumber", ifsc_code as "ifscCode", upi_id as "upiId", plan, invoices_this_month as "invoicesThisMonth", logo_url as "logoUrl", template_style as "templateStyle", show_watermark as "showWatermark", telegram_chat_id, created_at as "createdAt" FROM users WHERE whatsapp = $1`,
    [whatsapp]
  );
};

const updateUser = async (userId, updates) => {
const allowedFields = ['business_name', 'gst_number', 'pan_number', 'address', 'city', 'pincode', 'state', 'state_code', 'bank_name', 'account_number', 'ifsc_code', 'upi_id', 'plan', 'invoices_this_month', 'logo_url', 'template_style', 'show_watermark', 'telegram_chat_id', 'whatsapp'];
  
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
  const { id, userId, invoiceNumber, clientName, clientGst, clientAddress, clientMobile, clientState, clientStateCode, reverseCharge, transportMode, vehicleNumber, dateOfSupply, placeOfSupply, service, items, amount, gstRate, gstAmount, cgst, sgst, igst, gstType, totalAmount, notes, dueDate, pdfUrl, status, date } = invoiceData;
  
  const itemsJson = items ? JSON.stringify(items) : '[]';
  
  const result = await pool.query(
    `INSERT INTO invoices (id, user_id, invoice_number, client_name, client_gst, client_address, client_mobile, client_state, client_state_code, reverse_charge, transport_mode, vehicle_number, date_of_supply, place_of_supply, service_description, items, subtotal, gst_rate, gst_amount, cgst, sgst, igst, total, gst_type, notes, due_date, pdf_url, status, invoice_date, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, NOW(), NOW())
     RETURNING *`,
    [id, userId, invoiceNumber, clientName, clientGst, clientAddress || null, clientMobile || null, clientState || null, clientStateCode || null, reverseCharge || false, transportMode || null, vehicleNumber || null, dateOfSupply || null, placeOfSupply || null, service, itemsJson, amount, gstRate, gstAmount, cgst !== undefined ? cgst : gstAmount/2, sgst !== undefined ? sgst : gstAmount/2, igst || 0, totalAmount, gstType || 'intrastate', notes || '', dueDate || null, pdfUrl || null, status, date]
  );
  return result.rows[0];
};

const getInvoiceById = async (invoiceId) => {
  return dbQuerySingle(
    `SELECT id, user_id as "userId", invoice_number as "invoiceNumber", client_name as "clientName", client_gst as "clientGst", client_address as "clientAddress", client_mobile as "clientMobile", client_state as "clientState", client_state_code as "clientStateCode", reverse_charge as "reverseCharge", transport_mode as "transportMode", vehicle_number as "vehicleNumber", date_of_supply as "dateOfSupply", place_of_supply as "placeOfSupply", service_description as "service", items, subtotal as "amount", gst_rate as "gstRate", gst_amount as "gstAmount", cgst, sgst, igst, total as "totalAmount", gst_type as "gstType", pdf_url as "pdfUrl", notes, due_date as "dueDate", payment_details as "payment", status, invoice_date as "date", created_at as "createdAt" FROM invoices WHERE id = $1`,
    [invoiceId]
  );
};

const getUserInvoices = async (userId) => {
  return dbQuery(
    `SELECT id, user_id as "userId", invoice_number as "invoiceNumber", client_name as "clientName", client_gst as "clientGst", client_address as "clientAddress", client_mobile as "clientMobile", client_state as "clientState", client_state_code as "clientStateCode", reverse_charge as "reverseCharge", transport_mode as "transportMode", vehicle_number as "vehicleNumber", date_of_supply as "dateOfSupply", place_of_supply as "placeOfSupply", service_description as "service", items, subtotal as "amount", gst_rate as "gstRate", gst_amount as "gstAmount", cgst, sgst, igst, total as "totalAmount", gst_type as "gstType", pdf_url as "pdfUrl", notes, due_date as "dueDate", payment_details as "payment", status, invoice_date as "date", created_at as "createdAt" FROM invoices WHERE user_id = $1 ORDER BY created_at DESC`,
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

// PRODUCT FUNCTIONS
const getProducts = async (userId) => {
  return dbQuery(
    `SELECT id, user_id as "userId", name, sku, stock_qty as "stockQty", avg_cost as "avgCost", selling_price as "sellingPrice", created_at as "createdAt", updated_at as "updatedAt" FROM products WHERE user_id = $1 ORDER BY name ASC`,
    [userId]
  );
};

const getProductById = async (productId) => {
  return dbQuerySingle(
    `SELECT id, user_id as "userId", name, sku, stock_qty as "stockQty", avg_cost as "avgCost", selling_price as "sellingPrice", created_at as "createdAt", updated_at as "updatedAt" FROM products WHERE id = $1`,
    [productId]
  );
};

const getProductByName = async (userId, name) => {
  return dbQuerySingle(
    `SELECT id, user_id as "userId", name, sku, stock_qty as "stockQty", avg_cost as "avgCost", selling_price as "sellingPrice" FROM products WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
    [userId, name]
  );
};

const createProduct = async (productData) => {
  const { id, userId, name, sku, stockQty = 0, avgCost = 0, sellingPrice = 0 } = productData;
  const result = await pool.query(
    `INSERT INTO products (id, user_id, name, sku, stock_qty, avg_cost, selling_price, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
     RETURNING id, user_id as "userId", name, sku, stock_qty as "stockQty", avg_cost as "avgCost", selling_price as "sellingPrice"`,
    [id, userId, name, sku || null, stockQty, avgCost, sellingPrice]
  );
  return result.rows[0];
};

const updateProductStock = async (productId, qtyChange, newAvgCost = null) => {
  if (newAvgCost !== null) {
    await dbExecute(
      `UPDATE products SET stock_qty = stock_qty + $1, avg_cost = $2, updated_at = NOW() WHERE id = $3`,
      [qtyChange, newAvgCost, productId]
    );
  } else {
    await dbExecute(
      `UPDATE products SET stock_qty = stock_qty + $1, updated_at = NOW() WHERE id = $2`,
      [qtyChange, productId]
    );
  }
};

// PURCHASE FUNCTIONS
const createPurchaseInvoice = async (purchaseData) => {
  const { id, userId, supplierName, supplierGst, invoiceNumber, invoiceDate, total, subtotal, gstAmount, status, items, pdfUrl } = purchaseData;
  const result = await pool.query(
    `INSERT INTO purchase_invoices (id, user_id, supplier_name, supplier_gst, invoice_number, invoice_date, total, subtotal, gst_amount, status, items, pdf_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, NOW(), NOW())
     RETURNING id, user_id as "userId", supplier_name as "supplierName", supplier_gst as "supplierGst", invoice_number as "invoiceNumber", invoice_date as "invoiceDate", total, subtotal, gst_amount as "gstAmount", status, items, pdf_url as "pdfUrl", created_at as "createdAt"`,
    [id, userId, supplierName, supplierGst || null, invoiceNumber, invoiceDate || null, total, subtotal, gstAmount, status || 'Verified', JSON.stringify(items || []), pdfUrl || null]
  );
  return result.rows[0];
};

const getPurchases = async (userId) => {
  return dbQuery(
    `SELECT id, user_id as "userId", supplier_name as "supplierName", supplier_gst as "supplierGst", invoice_number as "invoiceNumber", invoice_date as "invoiceDate", total, subtotal, gst_amount as "gstAmount", status, items, pdf_url as "pdfUrl", created_at as "createdAt" FROM purchase_invoices WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
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
  getProducts,
  getProductById,
  getProductByName,
  createProduct,
  updateProductStock,
  createPurchaseInvoice,
  getPurchases,
};
