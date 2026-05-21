const express = require('express');
const db = require('./db');
const { v4: uuidv4 } = require('uuid');

// Let's mock a request object and test the purchases route directly!
const authFetchMock = async (userId, body) => {
  const req = {
    userId,
    body
  };
  
  let statusResult = null;
  let jsonResult = null;
  
  const res = {
    status: (code) => {
      statusResult = code;
      return res;
    },
    json: (data) => {
      jsonResult = data;
      return res;
    }
  };

  const purchasesRouter = require('./routes/purchases');
  // Find the POST handler
  const postHandler = purchasesRouter.stack.find(layer => layer.route && layer.route.methods.post && layer.route.path === '/');
  if (postHandler) {
    const routeHandler = postHandler.route.stack[postHandler.route.stack.length - 1].handle;
    await routeHandler(req, res);
  } else {
    throw new Error('POST / handler not found');
  }

  return { status: statusResult || 200, body: jsonResult };
};

async function testInMemory() {
  process.env.USE_POSTGRES = 'false';
  console.log('Testing in-memory mode...');
  
  const userId = 'demo-user-1';
  db.products = db.products.filter(p => p.userId !== userId);
  db.purchases = [];

  // Create a purchase invoice
  const purchasePayload = {
    docType: 'purchase_invoice',
    supplier: 'Test Supplier LLC',
    invoiceNo: 'PI-9999',
    date: '2026-05-21',
    gst: '27GSTIN1234F1Z5',
    items: [
      { name: 'Microphone USB', qty: 10, unit: 1500, total: 15000 }
    ],
    subtotal: 15000,
    gstAmt: 2700,
    total: 17700
  };

  console.log('Saving purchase invoice...');
  const result = await authFetchMock(userId, purchasePayload);
  console.log('Result status:', result.status);
  console.log('Result body:', JSON.stringify(result.body, null, 2));

  console.log('Purchases in db:', JSON.stringify(db.purchases, null, 2));
  console.log('Products in db:', JSON.stringify(db.products, null, 2));
}

testInMemory().catch(console.error);
