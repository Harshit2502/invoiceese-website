const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

router.use(authenticateToken);

// GET /api/products
router.get('/', async (req, res) => {
  if (process.env.USE_POSTGRES !== 'true') {
    return res.json({ products: [] }); // In-memory fallback not fully implemented for products
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
    return res.status(400).json({ error: 'Postgres required for products' });
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
