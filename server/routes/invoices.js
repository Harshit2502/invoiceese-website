const express = require('express');
const router = express.Router();
const publicRouter = express.Router(); // Public routes without auth
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const db = require('../db');

// Public routes (no auth required)
publicRouter.get('/pdf/:id', (req, res) => {
  console.log('PDF route hit for ID:', req.params.id);
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

// All other invoice routes require auth
router.use(authMiddleware);

// GET /api/invoices - list user's invoices
router.get('/', (req, res) => {
  const invoices = db.invoices
    .filter(inv => inv.userId === req.userId)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .map((inv) => {
      const safeAmount = Number(inv.amount) || 0;
      const normalizedItems = Array.isArray(inv.items) && inv.items.length > 0
        ? inv.items.map((item) => {
            const quantity = Number(item.quantity) || 1;
            const unitPrice = Number(item.unitPrice) || 0;
            return {
              description: item.description || inv.service || 'Service',
              quantity,
              unitPrice,
              amount: Number((quantity * unitPrice).toFixed(2)),
            };
          })
        : [
            {
              description: inv.service || 'Service',
              quantity: 1,
              unitPrice: safeAmount,
              amount: safeAmount,
            },
          ];

      return {
        ...inv,
        items: normalizedItems,
        amount: safeAmount,
        gstAmount: Number(inv.gstAmount) || 0,
        totalAmount: Number(inv.totalAmount) || safeAmount,
        pdfUrl: inv.pdfUrl || `${process.env.BASE_URL || 'http://localhost:5000'}/api/pdf/${inv.id}`,
      };
    });

  const stats = {
    total: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + (inv.totalAmount || inv.amount), 0),
    paid: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + (inv.totalAmount || inv.amount), 0),
    pending: invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + (inv.totalAmount || inv.amount), 0),
    pendingCount: invoices.filter(inv => inv.status !== 'paid').length,
  };

  res.json({ invoices, stats });
});

// POST /api/invoices - create new invoice
router.post('/', async (req, res) => {
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // All plans now have unlimited invoices
  // (Free plan no longer has per-month limits)

  const { clientName, service, amount, items, gstRate = 18, notes, dueDate, templateStyle } = req.body;
  if (!clientName) {
    return res.status(400).json({ error: 'Client name is required' });
  }

  const normalizedItems = Array.isArray(items) && items.length > 0
    ? items.map((item) => {
        const description = String(item.description || '').trim();
        const quantity = Number(item.quantity);
        const unitPrice = Number(item.unitPrice);
        return {
          description,
          quantity,
          unitPrice,
          amount: Number((quantity * unitPrice).toFixed(2)),
        };
      }).filter((item) => item.description && Number.isFinite(item.quantity) && item.quantity > 0 && Number.isFinite(item.unitPrice) && item.unitPrice > 0)
    : [];

  // Backward compatibility: if no items are provided, use single service+amount input.
  if (normalizedItems.length === 0) {
    const fallbackService = String(service || '').trim();
    const fallbackAmount = Number(amount);
    if (!fallbackService || !Number.isFinite(fallbackAmount) || fallbackAmount <= 0) {
      return res.status(400).json({ error: 'At least one valid item is required' });
    }
    normalizedItems.push({
      description: fallbackService,
      quantity: 1,
      unitPrice: fallbackAmount,
      amount: Number(fallbackAmount.toFixed(2)),
    });
  }

  const parsedAmount = Number(normalizedItems.reduce((sum, item) => sum + item.amount, 0).toFixed(2));
  const parsedGstRate = Number(gstRate);

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a valid positive number' });
  }

  if (!Number.isFinite(parsedGstRate) || parsedGstRate < 0) {
    return res.status(400).json({ error: 'GST rate must be a valid non-negative number' });
  }

  const userInvoices = db.invoices.filter(inv => inv.userId === req.userId);
  const invoiceNum = userInvoices.length + 1;
  const invoiceNumber = `INV-${String(invoiceNum).padStart(3, '0')}`;

  const gstAmount = Number(((parsedAmount * parsedGstRate) / 100).toFixed(2));
  const totalAmount = Number((parsedAmount + gstAmount).toFixed(2));

  const requestedTemplateStyle = ['modern', 'minimal', 'classic', 'premium'].includes(templateStyle)
    ? templateStyle
    : null;

  const invoice = {
    id: uuidv4(),
    userId: req.userId,
    invoiceNumber,
    clientName,
    service: normalizedItems[0].description,
    items: normalizedItems,
    amount: parsedAmount,
    gstRate: parsedGstRate,
    gstAmount,
    totalAmount,
    notes: notes || '',
    dueDate: dueDate || null,
    status: 'unpaid',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    templateStyle: requestedTemplateStyle || user.templateStyle || 'modern',
    showWatermark: user.plan === 'free' ? true : (user.showWatermark !== false),
  };

  // Generate PDF for the invoice
  try {
    const userMeta = db.users.find(u => u.id === req.userId);
    const { generateInvoicePDF } = require('../pdf-generator');

    const pdfPayload = {
      ...invoice,
      items: normalizedItems,
      subtotal: parsedAmount,
      cgst: parsedGstRate > 0 ? Number(((parsedAmount * parsedGstRate) / 100 / 2).toFixed(2)) : 0,
      sgst: parsedGstRate > 0 ? Number(((parsedAmount * parsedGstRate) / 100 / 2).toFixed(2)) : 0,
      igst: 0,
      total: totalAmount,
      gstType: 'intrastate',
      gstApplicable: parsedGstRate > 0,
    };

    const pdfResult = await generateInvoicePDF(pdfPayload, userMeta || {});
    invoice.pdfUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/pdf/${invoice.id}`;
  } catch (err) {
    console.error('Failed to generate invoice PDF:', err);
    invoice.pdfUrl = null;
  }

  db.invoices.push(invoice);
  user.invoicesThisMonth = (user.invoicesThisMonth || 0) + 1;

  res.status(201).json({ invoice, message: 'Invoice created successfully' });
});

// PATCH /api/invoices/:id/status - update payment status
router.patch('/:id/status', (req, res) => {
  const invoice = db.invoices.find(inv => inv.id === req.params.id && inv.userId === req.userId);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

  const { status } = req.body;
  if (!['paid', 'unpaid', 'overdue'].includes(status)) {
    return res.status(400).json({ error: 'Status must be paid, unpaid, or overdue' });
  }

  invoice.status = status;
  res.json({ invoice, message: 'Status updated' });
});

// DELETE /api/invoices/:id
router.delete('/:id', (req, res) => {
  const idx = db.invoices.findIndex(inv => inv.id === req.params.id && inv.userId === req.userId);
  if (idx === -1) return res.status(404).json({ error: 'Invoice not found' });
  db.invoices.splice(idx, 1);
  res.json({ message: 'Invoice deleted' });
});

// GET /api/invoices/:id/pdf - download PDF (public access for WhatsApp downloads)
publicRouter.get('/:id/pdf', (req, res) => {
  const invoice = db.invoices.find(inv => inv.id === req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

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

module.exports = router;
