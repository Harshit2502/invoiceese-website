require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const invoiceRoutes = require('./routes/invoices');
const userRoutes = require('./routes/users');
const whatsappRoutes = require('./routes/whatsapp');

// PostgreSQL initialization (optional - disabled by default)
if (process.env.USE_POSTGRES === 'true' && process.env.DB_HOST) {
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
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

// Public PDF route (no auth required)
app.get('/api/pdf/:id', (req, res) => {
  const db = require('./db');
  const invoice = db.invoices.find(inv => inv.id === req.params.id);
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
app.use('/api/whatsapp', whatsappRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'InvoiceEase API running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 InvoiceEase server running on http://localhost:${PORT}`);
});
