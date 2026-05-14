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

// POST /api/purchases/extract (MOCK OCR)
router.post('/extract', async (req, res) => {
  // Mock OCR logic to return realistic data
  setTimeout(() => {
    res.json({
      data: {
        supplier: "Metro Wholesale Hub Pvt. Ltd.",
        invoiceNo: "MWH/2026/04821",
        date: "2026-05-12",
        gst: "22AAAAA0000A1Z5",
        items: [
          { name: "Nike Air Max 90", qty: 24, unit: 2100, total: 50400, conf: 0.98 },
          { name: "Adidas Superstar", qty: 12, unit: 1800, total: 21600, conf: 0.95 },
          { name: "Puma RS-X", qty: 18, unit: 1650, total: 29700, conf: 0.91 },
        ],
        subtotal: 101700,
        gstAmt: 18306,
        total: 120006,
      }
    });
  }, 1500); // 1.5 second delay to simulate AI processing
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
