require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const invoiceRoutes = require('./routes/invoices');
const userRoutes = require('./routes/users');
const telegramRoutes = require('./routes/telegram');
const paymentRoutes = require('./routes/payments');
const productRoutes = require('./routes/products');
const purchaseRoutes = require('./routes/purchases');

// PostgreSQL initialization (optional - disabled by default)
if (process.env.USE_POSTGRES === 'true' && (process.env.DATABASE_URL || process.env.DB_HOST)) {
  try {
    const { initializeDatabase } = require('./db-postgres');
    initializeDatabase().then(() => {
      console.log('📦 PostgreSQL database ready');
    }).catch(err => {
      console.warn('⚠️ PostgreSQL unavailable, using in-memory database:', err.message);
    });
  } catch (err) {
    console.warn('⚠️ PostgreSQL module not available, using in-memory database');
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);

// Public PDF route (no auth required)
app.get('/api/pdf/:id', async (req, res) => {
  let invoice = null;
  if (process.env.USE_POSTGRES === 'true') {
    const pgFunctions = require('./db-postgres');
    invoice = await pgFunctions.getInvoiceById(req.params.id);
  } else {
    const db = require('./db');
    invoice = db.invoices.find(inv => inv.id === req.params.id);
  }
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  const fs = require('fs');
  const path = require('path');
  const pdfPath = path.join(__dirname, '..', 'pdfs', `${invoice.invoiceNumber}.pdf`);

  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({ error: 'PDF not found. Please regenerate the invoice.' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);

  const fileStream = fs.createReadStream(pdfPath);
  fileStream.pipe(res);

  fileStream.on('error', (err) => {
    console.error('Error streaming PDF:', err);
    res.status(500).json({ error: 'Error downloading PDF' });
  });
});

app.use('/api/invoices', invoiceRoutes); // Authenticated routes
app.use('/api/users', userRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/products', productRoutes);
app.use('/api/purchases', purchaseRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'InvoiceEase API running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 InvoiceEase server running on http://localhost:${PORT}`);
});
