const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

router.use(authenticateToken);

// GET /api/products
router.get('/', async (req, res) => {
  if (process.env.USE_POSTGRES !== 'true') {
    const products = db.products ? db.products.filter(p => p.userId === req.userId) : [];
    return res.json({ products });
  }
  try {
    const pgFunctions = require('../db-postgres');
    const products = await pgFunctions.getProducts(req.userId);
    res.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// POST /api/products
router.post('/', async (req, res) => {
  if (process.env.USE_POSTGRES !== 'true') {
    try {
      const { name, sku, stockQty, avgCost, sellingPrice } = req.body;
      if (!name) return res.status(400).json({ error: 'Product name is required' });

      if (!db.products) db.products = [];
      const product = {
        id: uuidv4(),
        userId: req.userId,
        name: String(name).trim(),
        sku: String(sku || '').trim(),
        stockQty: Number(stockQty) || 0,
        avgCost: Number(avgCost) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      db.products.push(product);
      return res.status(201).json({ product });
    } catch (error) {
      console.error('Error creating product in-memory:', error);
      return res.status(500).json({ error: 'Failed to create product' });
    }
  }
  try {
    const { name, sku, stockQty, avgCost, sellingPrice } = req.body;
    if (!name) return res.status(400).json({ error: 'Product name is required' });

    const pgFunctions = require('../db-postgres');
    const product = await pgFunctions.createProduct({
      id: uuidv4(),
      userId: req.userId,
      name,
      sku,
      stockQty: Number(stockQty) || 0,
      avgCost: Number(avgCost) || 0,
      sellingPrice: Number(sellingPrice) || 0,
    });
    res.status(201).json({ product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

module.exports = router;
