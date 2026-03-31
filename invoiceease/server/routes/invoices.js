const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const db = require('../db');

// All invoice routes require auth
router.use(authMiddleware);

// GET /api/invoices - list user's invoices
router.get('/', (req, res) => {
  const invoices = db.invoices
    .filter(inv => inv.userId === req.userId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const stats = {
    total: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + inv.amount, 0),
    paid: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0),
    pending: invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + inv.amount, 0),
    pendingCount: invoices.filter(inv => inv.status !== 'paid').length,
  };

  res.json({ invoices, stats });
});

// POST /api/invoices - create new invoice
router.post('/', (req, res) => {
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Free plan limit check
  if (user.plan === 'free' && user.invoicesThisMonth >= 5) {
    return res.status(403).json({ error: 'Free plan limit reached (5/month). Please upgrade to Pro.' });
  }

  const { clientName, service, amount, gstRate = 18, notes, dueDate } = req.body;
  if (!clientName || !service || !amount) {
    return res.status(400).json({ error: 'Client name, service, and amount are required' });
  }

  const userInvoices = db.invoices.filter(inv => inv.userId === req.userId);
  const invoiceNum = userInvoices.length + 1;
  const invoiceNumber = `INV-${String(invoiceNum).padStart(3, '0')}`;

  const gstAmount = (amount * gstRate) / 100;
  const totalAmount = amount + gstAmount;

  const invoice = {
    id: uuidv4(),
    userId: req.userId,
    invoiceNumber,
    clientName,
    service,
    amount: parseFloat(amount),
    gstRate,
    gstAmount,
    totalAmount,
    notes: notes || '',
    dueDate: dueDate || null,
    status: 'unpaid',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };

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

module.exports = router;
