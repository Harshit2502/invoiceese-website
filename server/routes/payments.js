const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const authMiddleware = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
router.use(authMiddleware);

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return null;
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });
};

router.post('/razorpay/order', async (req, res) => {
  try {
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      return res.status(500).json({ error: 'Razorpay is not configured on server' });
    }

    const { invoiceId } = req.body;
    if (!invoiceId) {
      return res.status(400).json({ error: 'invoiceId is required' });
    }

    let invoice = null;
    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      invoice = await pgFunctions.getInvoiceById(invoiceId);
      if (invoice && invoice.userId !== req.userId) invoice = null;
    } else {
      invoice = db.invoices.find((inv) => inv.id === invoiceId && inv.userId === req.userId);
    }
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status === 'paid') {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const amountInPaise = Math.round(Number(invoice.totalAmount || invoice.amount || 0) * 100);
    if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
      return res.status(400).json({ error: 'Invoice amount is invalid' });
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: invoice.invoiceNumber,
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        userId: req.userId,
      },
    });

    res.json({
      key: process.env.RAZORPAY_KEY_ID,
      order,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: Number(invoice.totalAmount || invoice.amount || 0),
        clientName: invoice.clientName,
      },
    });
  } catch (error) {
    console.error('Razorpay order create failed:', error);
    res.status(500).json({ error: 'Failed to create Razorpay order' });
  }
});

router.post('/razorpay/verify', async (req, res) => {
  try {
    const { invoiceId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!invoiceId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(500).json({ error: 'Razorpay is not configured on server' });
    }

    let invoice = null;
    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      invoice = await pgFunctions.getInvoiceById(invoiceId);
      if (invoice && invoice.userId !== req.userId) invoice = null;
    } else {
      invoice = db.invoices.find((inv) => inv.id === invoiceId && inv.userId === req.userId);
    }
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    invoice.status = 'paid';
    invoice.payment = {
      gateway: 'razorpay',
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      paidAt: new Date().toISOString(),
    };

    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      await pgFunctions.updateInvoiceStatus(invoice.id, 'paid', invoice.payment);
    }

    res.json({
      message: 'Payment verified successfully',
      invoice,
    });
  } catch (error) {
    console.error('Razorpay verify failed:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

module.exports = router;
