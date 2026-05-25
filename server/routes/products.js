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
  const { name, sku, stockQty, avgCost, sellingPrice, hsnCode } = req.body;
  if (!name) return res.status(400).json({ error: 'Product name is required' });

  if (process.env.USE_POSTGRES !== 'true') {
    try {
      if (!db.products) db.products = [];
      const product = {
        id: uuidv4(),
        userId: req.userId,
        name: String(name).trim(),
        sku: String(sku || '').trim(),
        stockQty: Number(stockQty) || 0,
        avgCost: Number(avgCost) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        hsnCode: String(hsnCode || '').trim() || null,
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
    const pgFunctions = require('../db-postgres');
    const product = await pgFunctions.createProduct({
      id: uuidv4(),
      userId: req.userId,
      name,
      sku,
      stockQty: Number(stockQty) || 0,
      avgCost: Number(avgCost) || 0,
      sellingPrice: Number(sellingPrice) || 0,
      hsnCode: hsnCode ? String(hsnCode).trim() : null
    });
    res.status(201).json({ product });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, sku, stockQty, avgCost, sellingPrice, hsnCode } = req.body;
  if (!name) return res.status(400).json({ error: 'Product name is required' });

  if (process.env.USE_POSTGRES !== 'true') {
    try {
      if (!db.products) db.products = [];
      const product = db.products.find(p => p.id === id && p.userId === req.userId);
      if (!product) return res.status(404).json({ error: 'Product not found' });

      product.name = String(name).trim();
      product.sku = String(sku || '').trim();
      product.stockQty = Number(stockQty) || 0;
      product.avgCost = Number(avgCost) || 0;
      product.sellingPrice = Number(sellingPrice) || 0;
      product.hsnCode = hsnCode ? String(hsnCode).trim() : null;
      product.updatedAt = new Date().toISOString();

      return res.json({ product });
    } catch (error) {
      console.error('Error updating product in-memory:', error);
      return res.status(500).json({ error: 'Failed to update product' });
    }
  }

  try {
    const pgFunctions = require('../db-postgres');
    const product = await pgFunctions.updateProduct(id, { name, sku, stockQty, avgCost, sellingPrice, hsnCode });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (process.env.USE_POSTGRES !== 'true') {
    try {
      if (!db.products) db.products = [];
      const idx = db.products.findIndex(p => p.id === id && p.userId === req.userId);
      if (idx === -1) return res.status(404).json({ error: 'Product not found' });

      db.products.splice(idx, 1);
      return res.json({ message: 'Product deleted successfully' });
    } catch (error) {
      console.error('Error deleting product in-memory:', error);
      return res.status(500).json({ error: 'Failed to delete product' });
    }
  }

  try {
    const pgFunctions = require('../db-postgres');
    const product = await pgFunctions.getProductById(id);
    if (!product || product.userId !== req.userId) {
      return res.status(404).json({ error: 'Product not found' });
    }
    await pgFunctions.deleteProduct(id);
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
