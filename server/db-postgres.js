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
    const migrations = ['000_create_users_table.sql', '001_create_conversations_table.sql', '002_add_missing_fields.sql', '003_add_client_fields.sql', '004_add_gst_invoice_fields.sql', '005_add_inventory_and_purchases.sql', '006_widen_state_code_columns.sql', '007_invoice_number_per_user.sql'];
    
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
// DOCUMENT FUNCTIONS
const createDocument = async (docData) => {
  const { id, userId, docType, direction, parentDocumentId, docNumber, partyName, partyGst, partyAddress, partyMobile, partyState, partyStateCode, reverseCharge, transportMode, vehicleNumber, dateOfSupply, placeOfSupply, items, subtotal, gstRate, gstAmount, cgst, sgst, igst, gstType, total, serviceDescription, notes, dueDate, docDate, paymentDetails, pdfUrl, status, templateStyle, showWatermark } = docData;
  const itemsJson = items ? JSON.stringify(items) : '[]';
  const paymentDetailsJson = paymentDetails ? JSON.stringify(paymentDetails) : null;
  const result = await pool.query(
    `INSERT INTO documents (id, user_id, doc_type, direction, parent_document_id, doc_number, party_name, party_gst, party_address, party_mobile, party_state, party_state_code, reverse_charge, transport_mode, vehicle_number, date_of_supply, place_of_supply, items, subtotal, gst_rate, gst_amount, cgst, sgst, igst, gst_type, total, service_description, notes, due_date, doc_date, payment_details, pdf_url, status, template_style, show_watermark, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31::jsonb, $32, $33, $34, $35, NOW(), NOW())
     RETURNING *`,
    [id, userId, docType, direction, parentDocumentId || null, docNumber, partyName, partyGst || null, partyAddress || null, partyMobile || null, partyState || null, partyStateCode || null, reverseCharge || false, transportMode || null, vehicleNumber || null, dateOfSupply || null, placeOfSupply || null, itemsJson, subtotal || 0, gstRate || 0, gstAmount || 0, cgst || 0, sgst || 0, igst || 0, gstType || 'intrastate', total, serviceDescription || null, notes || null, dueDate || null, docDate || null, paymentDetailsJson, pdfUrl || null, status || 'draft', templateStyle || 'modern', showWatermark === undefined ? true : showWatermark]
  );
  return result.rows[0];
};

const getDocumentById = async (id) => {
  return dbQuerySingle(`SELECT * FROM documents WHERE id = $1`, [id]);
};

const getUserDocuments = async (userId, docType) => {
  if (docType) {
    return dbQuery(`SELECT * FROM documents WHERE user_id = $1 AND doc_type = $2 ORDER BY created_at DESC`, [userId, docType]);
  }
  return dbQuery(`SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC`, [userId]);
};

const updateDocumentStatus = async (id, status, paymentDetails = null) => {
  if (paymentDetails) {
    const result = await pool.query(
      `UPDATE documents SET status = $1, payment_details = $2::jsonb, updated_at = NOW() WHERE id = $3 RETURNING *`,
      [status, JSON.stringify(paymentDetails), id]
    );
    return result.rows[0];
  } else {
    const result = await pool.query(
      `UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return result.rows[0];
  }
};

const updateDocumentPdfUrl = async (id, pdfUrl) => {
  const result = await pool.query(`UPDATE documents SET pdf_url = $1, updated_at = NOW() WHERE id = $2 RETURNING *`, [pdfUrl, id]);
  return result.rows[0];
};

const deleteDocument = async (id) => {
  return dbExecute(`DELETE FROM documents WHERE id = $1`, [id]);
};

const getNextDocNumber = async (userId, docType) => {
  const result = await dbQuerySingle(
    `SELECT doc_number FROM documents WHERE user_id = $1 AND doc_type = $2 ORDER BY created_at DESC LIMIT 1`,
    [userId, docType]
  );
  let nextNum = 1;
  const prefixMap = { 
    'sales_invoice': 'INV-', 
    'purchase_invoice': 'PI-', 
    'credit_note': 'CN-',
    'debit_note': 'DN-',
    'provisional_invoice': 'PROV-',
    'delivery_challan': 'DC-'
  };
  const prefix = prefixMap[docType] || 'DOC-';
  if (result && result.doc_number) {
    const match = result.doc_number.match(new RegExp(`^${prefix}(\\d+)`));
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
};

// LEGACY INVOICE WRAPPERS (To maintain API compatibility during transition)
const mapDocToInvoice = (doc) => {
  if (!doc) return null;
  return {
    id: doc.id,
    userId: doc.user_id,
    invoiceNumber: doc.doc_number,
    docType: doc.doc_type,
    clientName: doc.party_name,
    clientGst: doc.party_gst,
    clientAddress: doc.party_address,
    clientMobile: doc.party_mobile,
    clientState: doc.party_state,
    clientStateCode: doc.party_state_code,
    reverseCharge: doc.reverse_charge,
    transportMode: doc.transport_mode,
    vehicleNumber: doc.vehicle_number,
    dateOfSupply: doc.date_of_supply,
    placeOfSupply: doc.place_of_supply,
    service: doc.service_description,
    items: doc.items,
    amount: doc.subtotal,
    gstRate: doc.gst_rate,
    gstAmount: doc.gst_amount,
    cgst: doc.cgst,
    sgst: doc.sgst,
    igst: doc.igst,
    totalAmount: doc.total,
    gstType: doc.gst_type,
    notes: doc.notes,
    dueDate: doc.due_date,
    payment: doc.payment_details,
    pdfUrl: doc.pdf_url,
    status: doc.status,
    date: doc.doc_date,
    createdAt: doc.created_at
  };
};

const createInvoice = async (invoiceData) => {
  const docData = {
    id: invoiceData.id,
    userId: invoiceData.userId,
    docType: invoiceData.docType || 'sales_invoice',
    direction: 'outbound',
    docNumber: invoiceData.invoiceNumber,
    partyName: invoiceData.clientName,
    partyGst: invoiceData.clientGst,
    partyAddress: invoiceData.clientAddress,
    partyMobile: invoiceData.clientMobile,
    partyState: invoiceData.clientState,
    partyStateCode: invoiceData.clientStateCode,
    reverseCharge: invoiceData.reverseCharge,
    transportMode: invoiceData.transportMode,
    vehicleNumber: invoiceData.vehicleNumber,
    dateOfSupply: invoiceData.dateOfSupply,
    placeOfSupply: invoiceData.placeOfSupply,
    serviceDescription: invoiceData.service,
    items: invoiceData.items,
    subtotal: invoiceData.amount,
    gstRate: invoiceData.gstRate,
    gstAmount: invoiceData.gstAmount,
    cgst: invoiceData.cgst !== undefined ? invoiceData.cgst : invoiceData.gstAmount/2,
    sgst: invoiceData.sgst !== undefined ? invoiceData.sgst : invoiceData.gstAmount/2,
    igst: invoiceData.igst || 0,
    gstType: invoiceData.gstType || 'intrastate',
    total: invoiceData.totalAmount,
    notes: invoiceData.notes,
    dueDate: invoiceData.dueDate,
    docDate: invoiceData.date,
    pdfUrl: invoiceData.pdfUrl,
    status: invoiceData.status || 'unpaid',
    paymentDetails: invoiceData.paymentDetails
  };
  const doc = await createDocument(docData);
  return mapDocToInvoice(doc);
};

const getInvoiceById = async (invoiceId) => {
  const doc = await getDocumentById(invoiceId);
  return mapDocToInvoice(doc);
};

const getUserInvoices = async (userId) => {
  const docs = await getUserDocuments(userId, 'sales_invoice');
  return docs.map(mapDocToInvoice);
};

const updateInvoiceStatus = async (invoiceId, status, paymentDetails = null) => {
  const doc = await updateDocumentStatus(invoiceId, status, paymentDetails);
  return mapDocToInvoice(doc);
};

const updateInvoicePdfUrl = async (invoiceId, pdfUrl) => {
  const doc = await updateDocumentPdfUrl(invoiceId, pdfUrl);
  return mapDocToInvoice(doc);
};

const deleteInvoice = async (invoiceId) => {
  return deleteDocument(invoiceId);
};

const getNextInvoiceNumber = async (userId) => {
  return getNextDocNumber(userId, 'sales_invoice');
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

// PURCHASE FUNCTIONS WRAPPERS
const mapDocToPurchase = (doc) => {
  if (!doc) return null;
  return {
    id: doc.id,
    userId: doc.user_id,
    supplierName: doc.party_name,
    supplierGst: doc.party_gst,
    invoiceNumber: doc.doc_number,
    invoiceDate: doc.doc_date,
    total: doc.total,
    subtotal: doc.subtotal,
    gstAmount: doc.gst_amount,
    status: doc.status,
    items: doc.items,
    pdfUrl: doc.pdf_url,
    createdAt: doc.created_at
  };
};

const createPurchaseInvoice = async (purchaseData) => {
  const docData = {
    id: purchaseData.id,
    userId: purchaseData.userId,
    docType: 'purchase_invoice',
    direction: 'inbound',
    docNumber: purchaseData.invoiceNumber || \`PI-\${Date.now()}\`,
    partyName: purchaseData.supplierName,
    partyGst: purchaseData.supplierGst,
    docDate: purchaseData.invoiceDate,
    total: purchaseData.total,
    subtotal: purchaseData.subtotal,
    gstAmount: purchaseData.gstAmount,
    status: purchaseData.status || 'Verified',
    items: purchaseData.items,
    pdfUrl: purchaseData.pdfUrl
  };
  const doc = await createDocument(docData);
  return mapDocToPurchase(doc);
};

const getPurchases = async (userId) => {
  const docs = await getUserDocuments(userId, 'purchase_invoice');
  return docs.map(mapDocToPurchase);
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
  createDocument,
  getDocumentById,
  getUserDocuments,
  updateDocumentStatus,
  updateDocumentPdfUrl,
  deleteDocument,
  getNextDocNumber,
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
