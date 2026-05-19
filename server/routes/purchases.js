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
      return res.status(400).json({ error: 'No image provided' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Use gemini-2.5-pro for high accuracy vision tasks
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const prompt = `
      You are an expert OCR and data extraction tool. Extract the following details from this purchase invoice.
      Return ONLY a valid JSON object with the exact keys:
      {
        "supplier": "Full name of the supplier/vendor",
        "invoiceNo": "Invoice number or bill number",
        "date": "Invoice date in YYYY-MM-DD format",
        "gst": "Supplier's GSTIN if available",
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
    const { supplier, invoiceNo, date, gst, items, subtotal, gstAmt, total } = req.body;
    
    if (!supplier || !total) {
      return res.status(400).json({ error: 'Supplier and total are required' });
    }

    const pgFunctions = require('../db-postgres');
    const invoiceId = uuidv4();
    
    // Process items and update products
    let processedItems = [];
    if (Array.isArray(items)) {
      for (const item of items) {
        let productId = null;
        let product = await pgFunctions.getProductByName(req.userId, item.name);
        
        if (!product) {
          // Auto-create product for loose inventory
          product = await pgFunctions.createProduct({
            id: uuidv4(),
            userId: req.userId,
            name: item.name,
            stockQty: 0,
            avgCost: Number(item.unit) || 0,
            sellingPrice: (Number(item.unit) || 0) * 1.3 // 30% default markup
          });
        }
        
        productId = product.id;
        
        // Calculate new average cost
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

    const purchase = await pgFunctions.createPurchaseInvoice({
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

    res.status(201).json({ purchase });
  } catch (error) {
    console.error('Error saving purchase:', error);
    res.status(500).json({ error: 'Failed to save purchase invoice' });
  }
});

module.exports = router;
