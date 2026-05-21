require('dotenv').config();
const db = require('./db-postgres');
const pg = require('pg');

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
    items: doc.items,
    subtotal: doc.subtotal,
    gstRate: doc.gst_rate,
    gstAmount: doc.gst_amount,
    cgst: doc.cgst,
    sgst: doc.sgst,
    igst: doc.igst,
    gstType: doc.gst_type,
    totalAmount: doc.total,
    notes: doc.notes,
    dueDate: doc.due_date,
    date: doc.doc_date,
    pdfUrl: doc.pdf_url,
    status: doc.status,
    createdAt: doc.created_at
  };
};

async function checkDocs() {
  try {
    console.log('Querying all users directly from db...');
    const users = await db.dbQuery('SELECT id, email, "businessName", "gstNumber" FROM users');
    console.log(JSON.stringify(users, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Failed to query users:', err);
    process.exit(1);
  }
}

checkDocs();
