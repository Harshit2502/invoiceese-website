const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

function standardizeDate(dateStr) {
  if (!dateStr) return null;
  // If it's already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  // Try parsing the date
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  // Handle DD/MM/YYYY or DD-MM-YYYY formats specifically
  const parts = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (parts) {
    const day = parts[1].padStart(2, '0');
    const month = parts[2].padStart(2, '0');
    const year = parts[3];
    const testDate = new Date(`${year}-${month}-${day}`);
    if (!isNaN(testDate.getTime())) {
      return `${year}-${month}-${day}`;
    }
  }
  return new Date().toISOString().split('T')[0];
}

router.use(authenticateToken);

// GET /api/purchases
router.get('/', async (req, res) => {
  if (process.env.USE_POSTGRES !== 'true') {
    const purchases = db.purchases ? db.purchases.filter(p => p.userId === req.userId) : [];
    return res.json({ purchases });
  }
  try {
    const pgFunctions = require('../db-postgres');
    const purchases = await pgFunctions.getPurchases(req.userId);
    res.json({ purchases });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// POST /api/purchases/extract (Gemini Vision OCR)
router.post('/extract', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    let user = null;
    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      user = await pgFunctions.getUserById(req.userId);
    }
    const businessName = user?.businessName || '';
    const businessGst = user?.gstNumber || '';

    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-2.5-flash which is the active free-tier model for multimodal tasks
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are an expert OCR and data extraction tool. Analyze this document. 
      The current user's business name is "${businessName}" and their GSTIN is "${businessGst}".
      Detect if this is a purchase invoice (issued TO the user's business by a supplier) or a sales invoice (issued BY the user's business to a customer) or a delivery challan / credit note / debit note / provisional bill.
      
      Return ONLY a valid JSON object with the exact keys:
      {
        "docType": "one of: purchase_invoice, sales_invoice, credit_note, debit_note, delivery_challan, provisional_invoice",
        "supplier": "Full name of the party (if it is a purchase invoice, this is the vendor; if sales invoice, this is the client/buyer)",
        "invoiceNo": "Invoice number or bill number",
        "date": "Invoice date in YYYY-MM-DD format",
        "gst": "The other party's GSTIN if available",
        "items": [
          { "name": "Item description", "qty": Number, "unit": Number (Unit Price), "total": Number (Line total) }
        ],
        "subtotal": Number (total before taxes),
        "gstAmt": Number (total tax amount),
        "total": Number (grand total)
      }
      If any field is missing or unreadable, put null for strings or 0 for numbers.
      Do not include any markdown formatting like \`\`\`json. Return just the raw JSON object.
    `;

    // Strip out the data URL prefix if it exists (handles both image/ and application/pdf)
    const base64Data = image.replace(/^data:.*?;base64,/, "");

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: mimeType || "image/jpeg"
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    let text = response.text();
    
    // Clean up potential markdown formatting from the response
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const extractedData = JSON.parse(text);

    res.json({ data: extractedData });
  } catch (error) {
    console.error('Error extracting invoice data:', error);
    let errorMessage = 'Failed to extract invoice data. The image might be unreadable.';
    if (error.message) {
      if (error.message.includes('API key') || error.message.includes('key was reported as leaked') || error.message.includes('API_KEY')) {
        errorMessage = 'Gemini API key error: The key is invalid or has been revoked (possibly leaked). Please check and update your GEMINI_API_KEY in the server\'s .env file.';
      } else {
        errorMessage = `Failed to extract invoice data: ${error.message}`;
      }
    }
    res.status(500).json({ error: errorMessage });
  }
});

// POST /api/purchases
router.post('/', async (req, res) => {
  if (process.env.USE_POSTGRES !== 'true') {
    try {
      const { docType = 'purchase_invoice', supplier, invoiceNo, date, gst, items, subtotal, gstAmt, total, itcEligibility = 'inputs' } = req.body;
      
      if (!supplier || !total) {
        return res.status(400).json({ error: 'Supplier/Client and total are required' });
      }

      if (!db.purchases) db.purchases = [];
      if (!db.products) db.products = [];
      if (!db.invoices) db.invoices = [];

      const invoiceId = uuidv4();
      let processedItems = [];

      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item) continue;
          const itemName = String(item.name || '').trim() || 'Unnamed Product';
          let productId = null;
          let product = db.products.find(p => p.userId === req.userId && p.name && p.name.toLowerCase() === itemName.toLowerCase());
          
          if (!product) {
            product = {
              id: uuidv4(),
              userId: req.userId,
              name: itemName,
              sku: '',
              stockQty: 0,
              avgCost: Number(item.unit) || 0,
              sellingPrice: (Number(item.unit) || 0) * 1.3,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            db.products.push(product);
          }
          
          productId = product.id;
          const newQty = Number(item.qty) || 0;
          const currentQty = product.stockQty || 0;
          const currentCost = product.avgCost || 0;
          const itemCost = Number(item.unit) || 0;
          
          if (docType === 'purchase_invoice') {
            const totalNewQty = currentQty + newQty;
            const newAvgCost = totalNewQty > 0 
              ? ((currentQty * currentCost) + (newQty * itemCost)) / totalNewQty 
              : itemCost;
            
            product.stockQty = totalNewQty;
            product.avgCost = Number(newAvgCost.toFixed(2));
          } else if (docType === 'credit_note') {
            product.stockQty = currentQty + newQty;
          } else {
            product.stockQty = currentQty - newQty;
          }
          product.updatedAt = new Date().toISOString();
          
          processedItems.push({
            productId,
            description: itemName,
            quantity: newQty,
            unitPrice: itemCost,
            amount: Number(item.total) || (newQty * itemCost)
          });
        }
      }

      let resultDoc;
      if (docType === 'purchase_invoice') {
        resultDoc = {
          id: invoiceId,
          userId: req.userId,
          supplierName: supplier,
          supplierGst: gst || '',
          invoiceNumber: invoiceNo || `PI-${Date.now()}`,
          invoiceDate: standardizeDate(date || new Date().toISOString().split('T')[0]),
          total: Number(total),
          subtotal: Number(subtotal),
          gstAmount: Number(gstAmt),
          status: 'Verified',
          items: processedItems,
          itcEligibility: itcEligibility || 'inputs',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.purchases.push(resultDoc);
      } else {
        const requestedTemplateStyle = 'modern';
        const calculatedGstType = 'intrastate';
        const parsedAmount = Number(subtotal);
        const parsedGstRate = subtotal > 0 ? Math.round((Number(gstAmt) * 100) / Number(subtotal)) : 0;

        const doc = {
          id: invoiceId,
          userId: req.userId,
          docType,
          direction: 'outbound',
          invoiceNumber: invoiceNo || `INV-${Date.now()}`,
          clientName: supplier,
          clientGst: gst || '',
          clientAddress: '',
          clientMobile: '',
          clientState: '',
          clientStateCode: '',
          reverseCharge: false,
          transportMode: '',
          vehicleNumber: '',
          dateOfSupply: '',
          placeOfSupply: '',
          service: processedItems[0]?.description || 'Service',
          items: processedItems,
          amount: parsedAmount,
          gstRate: parsedGstRate,
          gstAmount: Number(gstAmt),
          cgst: parsedGstRate > 0 ? Number(((parsedAmount * parsedGstRate) / 100 / 2).toFixed(2)) : 0,
          sgst: parsedGstRate > 0 ? Number(((parsedAmount * parsedGstRate) / 100 / 2).toFixed(2)) : 0,
          igst: 0,
          gstType: calculatedGstType,
          totalAmount: Number(total),
          notes: '',
          dueDate: null,
          status: 'unpaid',
          date: standardizeDate(date || new Date().toISOString().split('T')[0]),
          createdAt: new Date().toISOString(),
          templateStyle: requestedTemplateStyle,
          showWatermark: true
        };

        // Generate PDF URL for the outbound document
        let pdfUrl = null;
        try {
          const { generateInvoicePDF } = require('../pdf-generator');
          const userMeta = db.users.find(u => u.id === req.userId) || {};
          const pdfPayload = {
            ...doc,
            subtotal: parsedAmount,
            gstApplicable: parsedGstRate > 0,
          };
          await generateInvoicePDF(pdfPayload, userMeta);
          pdfUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/pdf/${invoiceId}`;
        } catch (err) {
          console.error('Failed to generate OCR outbound PDF (in-memory):', err);
        }

        doc.pdfUrl = pdfUrl;
        db.invoices.push(doc);
        resultDoc = doc;
      }

      return res.status(201).json({ purchase: resultDoc });
    } catch (error) {
      console.error('Error saving purchase (in-memory):', error);
      return res.status(500).json({ error: 'Failed to save purchase invoice' });
    }
  }
  try {
    const { docType = 'purchase_invoice', supplier, invoiceNo, date, gst, items, subtotal, gstAmt, total, itcEligibility = 'inputs' } = req.body;
    
    if (!supplier || !total) {
      return res.status(400).json({ error: 'Supplier/Client and total are required' });
    }

    const pgFunctions = require('../db-postgres');
    const invoiceId = uuidv4();
    
    let resultDoc;
    if (docType === 'purchase_invoice') {
      // Process items and update products (Inbound stock addition)
      let processedItems = [];
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item) continue;
          const itemName = String(item.name || '').trim() || 'Unnamed Product';
          let productId = null;
          let product = await pgFunctions.getProductByName(req.userId, itemName);
          
          if (!product) {
            product = await pgFunctions.createProduct({
              id: uuidv4(),
              userId: req.userId,
              name: itemName,
              stockQty: 0,
              avgCost: Number(item.unit) || 0,
              sellingPrice: (Number(item.unit) || 0) * 1.3
            });
          }
          
          productId = product.id;
          const newQty = Number(item.qty) || 0;
          const currentQty = Number(product.stockQty) || 0;
          const currentCost = Number(product.avgCost) || 0;
          const itemCost = Number(item.unit) || 0;
          
          const totalNewQty = currentQty + newQty;
          const newAvgCost = totalNewQty > 0 
            ? ((currentQty * currentCost) + (newQty * itemCost)) / totalNewQty 
            : itemCost;
            
          await pgFunctions.updateProductStock(productId, newQty, newAvgCost);
          
          processedItems.push({
            productId,
            description: itemName,
            quantity: newQty,
            unitPrice: itemCost,
            amount: Number(item.total) || (newQty * itemCost)
          });
        }
      }

      resultDoc = await pgFunctions.createPurchaseInvoice({
        id: invoiceId,
        userId: req.userId,
        supplierName: supplier,
        supplierGst: gst,
        invoiceNumber: invoiceNo,
        invoiceDate: standardizeDate(date || new Date().toISOString().split('T')[0]),
        total: Number(total),
        subtotal: Number(subtotal),
        gstAmount: Number(gstAmt),
        status: 'Verified',
        items: processedItems,
        itcEligibility: itcEligibility || 'inputs'
      });
    } else {
      // Process items (Outbound stock reduction)
      let processedItems = [];
      if (Array.isArray(items)) {
        for (const item of items) {
          if (!item) continue;
          const itemName = String(item.name || '').trim() || 'Unnamed Product';
          let productId = null;
          let product = await pgFunctions.getProductByName(req.userId, itemName);
          
          if (!product) {
            product = await pgFunctions.createProduct({
              id: uuidv4(),
              userId: req.userId,
              name: itemName,
              stockQty: 0,
              avgCost: Number(item.unit) || 0,
              sellingPrice: Number(item.unit) || 0
            });
          }
          
          productId = product.id;
          const qty = Number(item.qty) || 0;
          if (docType === 'credit_note') {
            await pgFunctions.updateProductStock(productId, qty);
          } else {
            await pgFunctions.updateProductStock(productId, -qty);
          }
          
          processedItems.push({
            productId,
            description: itemName,
            quantity: qty,
            unitPrice: Number(item.unit) || 0,
            amount: Number(item.total) || (qty * (Number(item.unit) || 0))
          });
        }
      }

      // Generate PDF URL for the outbound document
      let pdfUrl = null;
      try {
        const userMeta = await pgFunctions.getUserById(req.userId);
        const { generateInvoicePDF } = require('../pdf-generator');
        const pdfPayload = {
          id: invoiceId,
          userId: req.userId,
          docType,
          invoiceNumber: invoiceNo,
          clientName: supplier,
          clientGst: gst,
          date: standardizeDate(date || new Date().toISOString().split('T')[0]),
          items: processedItems,
          amount: Number(subtotal),
          gstRate: subtotal > 0 ? Math.round((Number(gstAmt) * 100) / Number(subtotal)) : 0,
          gstAmount: Number(gstAmt),
          totalAmount: Number(total),
          status: 'unpaid',
          createdAt: new Date().toISOString()
        };
        await generateInvoicePDF(pdfPayload, userMeta || {});
        pdfUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/pdf/${invoiceId}`;
      } catch (err) {
        console.error('Failed to generate OCR outbound PDF:', err);
      }

      const doc = await pgFunctions.createDocument({
        id: invoiceId,
        userId: req.userId,
        docType,
        direction: 'outbound',
        docNumber: invoiceNo || `INV-${Date.now()}`,
        partyName: supplier,
        partyGst: gst,
        items: processedItems,
        subtotal: Number(subtotal),
        gstRate: subtotal > 0 ? Math.round((Number(gstAmt) * 100) / Number(subtotal)) : 0,
        gstAmount: Number(gstAmt),
        total: Number(total),
        docDate: standardizeDate(date || new Date().toISOString().split('T')[0]),
        pdfUrl,
        status: 'unpaid'
      });
      resultDoc = doc;
    }

    res.status(201).json({ purchase: resultDoc });
  } catch (error) {
    console.error('Error saving purchase:', error);
    res.status(500).json({ error: 'Failed to save purchase invoice' });
  }
});

// DELETE /api/purchases/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (process.env.USE_POSTGRES !== 'true') {
    try {
      if (!db.purchases) db.purchases = [];
      const idx = db.purchases.findIndex(p => p.id === id && p.userId === req.userId);
      if (idx === -1) return res.status(404).json({ error: 'Purchase invoice not found' });

      db.purchases.splice(idx, 1);
      return res.json({ message: 'Purchase invoice deleted successfully' });
    } catch (error) {
      console.error('Error deleting purchase in-memory:', error);
      return res.status(500).json({ error: 'Failed to delete purchase invoice' });
    }
  }

  try {
    const pgFunctions = require('../db-postgres');
    const purchase = await pgFunctions.getDocumentById(id);
    if (!purchase || purchase.user_id !== req.userId || purchase.doc_type !== 'purchase_invoice') {
      return res.status(404).json({ error: 'Purchase invoice not found' });
    }
    await pgFunctions.deleteDocument(id);
    res.json({ message: 'Purchase invoice deleted successfully' });
  } catch (error) {
    console.error('Error deleting purchase:', error);
    res.status(500).json({ error: 'Failed to delete purchase invoice' });
  }
});

// PATCH /api/purchases/:id/itc
router.patch('/:id/itc', async (req, res) => {
  const { id } = req.params;
  const { itcEligibility } = req.body;
  if (!['inputs', 'capital_goods', 'input_services', 'ineligible'].includes(itcEligibility)) {
    return res.status(400).json({ error: 'Invalid ITC eligibility value' });
  }

  if (process.env.USE_POSTGRES !== 'true') {
    if (!db.purchases) db.purchases = [];
    const purchase = db.purchases.find(p => p.id === id && p.userId === req.userId);
    if (!purchase) return res.status(404).json({ error: 'Purchase invoice not found' });
    purchase.itcEligibility = itcEligibility;
    purchase.updatedAt = new Date().toISOString();
    return res.json({ purchase, message: 'ITC eligibility updated successfully' });
  }

  try {
    const pgFunctions = require('../db-postgres');
    const purchase = await pgFunctions.getDocumentById(id);
    if (!purchase || purchase.user_id !== req.userId || purchase.doc_type !== 'purchase_invoice') {
      return res.status(404).json({ error: 'Purchase invoice not found' });
    }
    const updated = await pgFunctions.updatePurchaseItc(id, itcEligibility);
    res.json({ purchase: updated, message: 'ITC eligibility updated successfully' });
  } catch (error) {
    console.error('Error updating purchase ITC:', error);
    res.status(500).json({ error: 'Failed to update ITC eligibility' });
  }
});

module.exports = router;
