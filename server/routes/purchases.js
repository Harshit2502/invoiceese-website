const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.use(authenticateToken);

// GET /api/purchases
router.get('/', async (req, res) => {
  if (process.env.USE_POSTGRES !== 'true') {
    return res.json({ purchases: [] });
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
    // Use gemini-2.5-pro for high accuracy vision tasks
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

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
    res.status(500).json({ error: 'Failed to extract invoice data. The image might be unreadable.' });
  }
});

// POST /api/purchases
router.post('/', async (req, res) => {
  if (process.env.USE_POSTGRES !== 'true') {
    return res.status(400).json({ error: 'Postgres required for purchases' });
  }
  try {
    const { docType = 'purchase_invoice', supplier, invoiceNo, date, gst, items, subtotal, gstAmt, total } = req.body;
    
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
          let productId = null;
          let product = await pgFunctions.getProductByName(req.userId, item.name);
          
          if (!product) {
            product = await pgFunctions.createProduct({
              id: uuidv4(),
              userId: req.userId,
              name: item.name,
              stockQty: 0,
              avgCost: Number(item.unit) || 0,
              sellingPrice: (Number(item.unit) || 0) * 1.3
            });
          }
          
          productId = product.id;
          const newQty = Number(item.qty) || 0;
          const currentQty = product.stockQty || 0;
          const currentCost = product.avgCost || 0;
          const itemCost = Number(item.unit) || 0;
          
          const totalNewQty = currentQty + newQty;
          const newAvgCost = totalNewQty > 0 
            ? ((currentQty * currentCost) + (newQty * itemCost)) / totalNewQty 
            : itemCost;
            
          await pgFunctions.updateProductStock(productId, newQty, newAvgCost);
          
          processedItems.push({
            productId,
            description: item.name,
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
        invoiceDate: date,
        total: Number(total),
        subtotal: Number(subtotal),
        gstAmount: Number(gstAmt),
        status: 'Verified',
        items: processedItems
      });
    } else {
      // Process items (Outbound stock reduction)
      let processedItems = [];
      if (Array.isArray(items)) {
        for (const item of items) {
          let productId = null;
          let product = await pgFunctions.getProductByName(req.userId, item.name);
          
          if (!product) {
            product = await pgFunctions.createProduct({
              id: uuidv4(),
              userId: req.userId,
              name: item.name,
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
            description: item.name,
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
          date,
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
        docNumber: invoiceNo,
        partyName: supplier,
        partyGst: gst,
        items: processedItems,
        subtotal: Number(subtotal),
        gstRate: subtotal > 0 ? Math.round((Number(gstAmt) * 100) / Number(subtotal)) : 0,
        gstAmount: Number(gstAmt),
        total: Number(total),
        docDate: date,
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

module.exports = router;
