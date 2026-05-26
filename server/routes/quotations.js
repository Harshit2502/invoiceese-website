const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const authMiddleware = require('../middleware/auth');
const db = require('../db');
const { generateInvoicePDF } = require('../pdf-generator');
const { sendQuotationEmail } = require('../services/email');
const { sendWhatsAppMessage } = require('../services/whatsapp');

let pgFunctions = null;
try {
  pgFunctions = require('../db-postgres');
} catch (err) {
  // Ignored
}

const USE_POSTGRES = process.env.USE_POSTGRES === 'true';

router.use(authMiddleware);

// Helper to format dates consistently in local YYYY-MM-DD format
const getLocalDateString = (dateObj) => {
  const d = new Date(dateObj);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// GET /api/quotations - list user's quotations & proformas
router.get('/', async (req, res) => {
  try {
    let quotations = [];
    if (USE_POSTGRES && pgFunctions) {
      const rows = await pgFunctions.dbQuery(
        `SELECT * FROM documents WHERE user_id = $1 AND doc_type IN ('quotation', 'proforma') ORDER BY created_at DESC`,
        [req.userId]
      );
      quotations = rows.map(pgFunctions.mapDocToInvoice);
    } else {
      quotations = db.invoices.filter(
        inv => inv.userId === req.userId && (inv.docType === 'quotation' || inv.docType === 'proforma')
      );
    }

    // Map to a consistent format for the client
    const mapped = quotations.map(q => {
      const safeAmount = Number(q.totalAmount || q.amount || 0);
      return {
        ...q,
        amount: Number(q.amount || q.subtotal || 0),
        gstAmount: Number(q.gstAmount) || 0,
        totalAmount: safeAmount,
        pdfUrl: q.pdfUrl || `${process.env.BASE_URL || 'http://localhost:5000'}/api/pdf/${q.id}`,
      };
    });

    res.json({ quotations: mapped });
  } catch (err) {
    console.error('Error fetching quotations:', err);
    res.status(500).json({ error: 'Failed to fetch quotations' });
  }
});

// POST /api/quotations - create a quotation/proforma
router.post('/', async (req, res) => {
  try {
    let user = null;
    if (USE_POSTGRES && pgFunctions) {
      user = await pgFunctions.getUserById(req.userId);
    } else {
      user = db.users.find(u => u.id === req.userId);
    }
    if (!user) return res.status(404).json({ error: 'User not found' });

    const {
      docType = 'quotation', // 'quotation' or 'proforma'
      clientName,
      clientGst,
      clientAddress,
      clientMobile,
      clientState,
      clientStateCode,
      reverseCharge = false,
      transportMode,
      vehicleNumber,
      dateOfSupply,
      placeOfSupply,
      service,
      amount,
      items,
      gstRate = 18,
      notes,
      validUntil,
      templateStyle
    } = req.body;

    if (!clientName) {
      return res.status(400).json({ error: 'Client name is required' });
    }

    let normalizedItems = [];
    let subtotal = 0;
    
    if (Array.isArray(items) && items.length > 0) {
      subtotal = items.reduce((sum, item) => sum + (Number(item.quantity || 1) * Number(item.unitPrice || 0)), 0);
      normalizedItems = items.map(item => ({
        description: item.description,
        hsn: item.hsn || '',
        uom: item.uom || 'PCS.',
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        amount: Number(item.quantity) * Number(item.unitPrice)
      }));
    } else {
      subtotal = Number(amount) || 0;
      normalizedItems = [{
        description: service || 'Estimated Services',
        hsn: '',
        uom: 'PCS.',
        quantity: 1,
        unitPrice: subtotal,
        amount: subtotal
      }];
    }

    // Quotations are pre-tax estimates. GST rates apply only to proformas.
    const isProforma = docType === 'proforma';
    const rate = isProforma ? Number(gstRate) : 0;
    const gstAmount = isProforma ? Number((subtotal * rate / 100).toFixed(2)) : 0;
    const cgst = isProforma ? Number((gstAmount / 2).toFixed(2)) : 0;
    const sgst = isProforma ? Number((gstAmount / 2).toFixed(2)) : 0;
    const igst = 0; // Standardize on intrastate or local state CGST/SGST breakdown
    const total = subtotal + gstAmount;

    // Generate doc number
    let docNumber;
    if (USE_POSTGRES && pgFunctions) {
      docNumber = await pgFunctions.getNextDocNumber(req.userId, docType);
    } else {
      const year = new Date().getFullYear();
      const prefix = docType === 'quotation' ? `QT-${year}-` : `PI-${year}-`;
      const userDocs = db.invoices.filter(doc => doc.userId === req.userId && doc.docType === docType);
      docNumber = `${prefix}${String(userDocs.length + 1).padStart(3, '0')}`;
    }

    const docId = uuidv4();
    const invoiceData = {
      id: docId,
      userId: req.userId,
      docType,
      invoiceNumber: docNumber,
      clientName,
      clientGst: clientGst || '',
      clientAddress: clientAddress || '',
      clientMobile: clientMobile || '',
      clientState: clientState || '',
      clientStateCode: clientStateCode || '',
      reverseCharge,
      transportMode: transportMode || '',
      vehicleNumber: vehicleNumber || '',
      dateOfSupply: dateOfSupply || null,
      placeOfSupply: placeOfSupply || '',
      service: service || '',
      items: normalizedItems,
      amount: subtotal,
      gstRate: rate,
      gstAmount,
      cgst,
      sgst,
      igst,
      gstType: 'intrastate',
      totalAmount: total,
      notes: notes || '',
      dueDate: validUntil, // Map validity date to due_date or valid_until field
      date: getLocalDateString(new Date()),
      status: 'draft',
      paymentStatus: 'unpaid',
      paidAmount: 0.00,
      validUntil: validUntil || null,
      quoteStatus: 'draft',
      convertedInvoiceId: null,
      templateStyle: templateStyle || user.templateStyle || 'modern',
      showWatermark: user.showWatermark
    };

    // Generate PDF
    try {
      const pdfResult = await generateInvoicePDF(invoiceData, user);
      invoiceData.pdfUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api${pdfResult.url}`;
    } catch (pdfErr) {
      console.error('PDF Generation failed for quotation:', pdfErr);
      invoiceData.pdfUrl = `https://invoiceease.example.com/print/${docNumber}.pdf`;
    }

    // Save
    if (USE_POSTGRES && pgFunctions) {
      await pgFunctions.createInvoice(invoiceData);
    } else {
      db.invoices.push(invoiceData);
    }

    res.status(201).json(invoiceData);
  } catch (err) {
    console.error('Error creating quotation:', err);
    res.status(500).json({ error: 'Failed to create quotation' });
  }
});

// PATCH /api/quotations/:id - Edit quotation details
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let quote = null;
    let user = null;

    if (USE_POSTGRES && pgFunctions) {
      const doc = await pgFunctions.getDocumentById(id);
      quote = pgFunctions.mapDocToInvoice(doc);
      user = await pgFunctions.getUserById(req.userId);
    } else {
      quote = db.invoices.find(inv => inv.id === id && inv.userId === req.userId);
      user = db.users.find(u => u.id === req.userId);
    }

    if (!quote) return res.status(404).json({ error: 'Quotation not found' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updates = req.body;
    
    // Update fields
    const updatedQuote = {
      ...quote,
      ...updates,
      items: updates.items || quote.items,
      amount: updates.amount !== undefined ? Number(updates.amount) : quote.amount,
      totalAmount: updates.totalAmount !== undefined ? Number(updates.totalAmount) : quote.totalAmount,
      quoteStatus: updates.quoteStatus || quote.quoteStatus,
      validUntil: updates.validUntil || quote.validUntil
    };

    // Recalculate totals if items changed
    if (updates.items) {
      const subtotal = updates.items.reduce((sum, item) => sum + (Number(item.quantity || 1) * Number(item.unitPrice || 0)), 0);
      updatedQuote.amount = subtotal;
      
      const isProforma = updatedQuote.docType === 'proforma';
      const rate = isProforma ? Number(updatedQuote.gstRate || 18) : 0;
      const gstAmount = isProforma ? Number((subtotal * rate / 100).toFixed(2)) : 0;
      updatedQuote.gstAmount = gstAmount;
      updatedQuote.cgst = isProforma ? Number((gstAmount / 2).toFixed(2)) : 0;
      updatedQuote.sgst = isProforma ? Number((gstAmount / 2).toFixed(2)) : 0;
      updatedQuote.totalAmount = subtotal + gstAmount;
    }

    // Regenerate PDF
    try {
      const pdfResult = await generateInvoicePDF(updatedQuote, user);
      updatedQuote.pdfUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api${pdfResult.url}`;
    } catch (pdfErr) {
      console.error('PDF Generation failed during update:', pdfErr);
    }

    // Save update
    if (USE_POSTGRES && pgFunctions) {
      const query = `
        UPDATE documents 
        SET party_name = $1, party_gst = $2, party_address = $3, party_mobile = $4,
            party_state = $5, party_state_code = $6, items = $7::jsonb, subtotal = $8,
            gst_rate = $9, gst_amount = $10, cgst = $11, sgst = $12, total = $13,
            notes = $14, valid_until = $15, quote_status = $16, pdf_url = $17, status = $18, updated_at = NOW()
        WHERE id = $19
      `;
      await pgFunctions.dbQuery(query, [
        updatedQuote.clientName,
        updatedQuote.clientGst,
        updatedQuote.clientAddress,
        updatedQuote.clientMobile,
        updatedQuote.clientState,
        updatedQuote.clientStateCode,
        JSON.stringify(updatedQuote.items),
        updatedQuote.amount,
        updatedQuote.gstRate,
        updatedQuote.gstAmount,
        updatedQuote.cgst,
        updatedQuote.sgst,
        updatedQuote.totalAmount,
        updatedQuote.notes,
        updatedQuote.validUntil,
        updatedQuote.quoteStatus,
        updatedQuote.pdfUrl,
        updatedQuote.quoteStatus === 'converted' ? 'paid' : updatedQuote.quoteStatus,
        id
      ]);

      // Also update invoices table if legacy
      await pgFunctions.dbQuery(
        `UPDATE invoices SET quote_status = $1, valid_until = $2, pdf_url = $3, updated_at = NOW() WHERE id = $4`,
        [updatedQuote.quoteStatus, updatedQuote.validUntil, updatedQuote.pdfUrl, id]
      ).catch(() => {});
    } else {
      const idx = db.invoices.findIndex(inv => inv.id === id);
      if (idx > -1) {
        db.invoices[idx] = updatedQuote;
      }
    }

    res.json(updatedQuote);
  } catch (err) {
    console.error('Error updating quotation:', err);
    res.status(500).json({ error: 'Failed to update quotation' });
  }
});

// POST /api/quotations/:id/convert - Convert accepted quotation to invoice
router.post('/:id/convert', async (req, res) => {
  try {
    const { id } = req.params;
    let quote = null;
    let user = null;

    if (USE_POSTGRES && pgFunctions) {
      const doc = await pgFunctions.getDocumentById(id);
      quote = pgFunctions.mapDocToInvoice(doc);
      user = await pgFunctions.getUserById(req.userId);
    } else {
      quote = db.invoices.find(inv => inv.id === id && inv.userId === req.userId);
      user = db.users.find(u => u.id === req.userId);
    }

    if (!quote) return res.status(404).json({ error: 'Quotation/Proforma not found' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Generate next invoice number sequence
    let invoiceNumber;
    if (USE_POSTGRES && pgFunctions) {
      invoiceNumber = await pgFunctions.getNextInvoiceNumber(req.userId);
    } else {
      const userInvoices = db.invoices.filter(inv => inv.userId === req.userId && inv.docType === 'sales_invoice');
      invoiceNumber = `INV-${String(userInvoices.length + 1).padStart(3, '0')}`;
    }

    const newInvoiceId = uuidv4();
    const invoiceDate = getLocalDateString(new Date());

    // Calculate due date relative to today using user's settings defaults
    const dueDays = user.defaultDueDays || 30;
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + dueDays);
    const dueDate = getLocalDateString(dueDateObj);

    // If converting from quotation (which is pre-tax estimate), apply GST standard 18% or copy details
    const subtotal = quote.amount;
    const gstRate = quote.gstRate || 18;
    const gstAmount = Number((subtotal * gstRate / 100).toFixed(2));
    const cgst = Number((gstAmount / 2).toFixed(2));
    const sgst = Number((gstAmount / 2).toFixed(2));
    const totalAmount = subtotal + gstAmount;

    const invoiceData = {
      id: newInvoiceId,
      userId: req.userId,
      docType: 'sales_invoice',
      invoiceNumber,
      clientName: quote.clientName,
      clientGst: quote.clientGst,
      clientAddress: quote.clientAddress,
      clientMobile: quote.clientMobile,
      clientState: quote.clientState,
      clientStateCode: quote.clientStateCode,
      reverseCharge: quote.reverseCharge || false,
      transportMode: quote.transportMode || '',
      vehicleNumber: quote.vehicleNumber || '',
      dateOfSupply: quote.dateOfSupply || null,
      placeOfSupply: quote.placeOfSupply || '',
      service: quote.service || '',
      items: quote.items.map(item => ({
        ...item,
        amount: item.amount
      })),
      amount: subtotal,
      gstRate,
      gstAmount,
      cgst,
      sgst,
      igst: 0,
      gstType: 'intrastate',
      totalAmount,
      notes: quote.notes || '',
      dueDate,
      date: invoiceDate,
      status: 'unpaid',
      paymentStatus: 'unpaid',
      paidAmount: 0.00,
      validUntil: null,
      quoteStatus: null,
      convertedInvoiceId: null,
      templateStyle: quote.templateStyle || 'modern',
      showWatermark: quote.showWatermark
    };

    // Generate new Invoice PDF
    try {
      const pdfResult = await generateInvoicePDF(invoiceData, user);
      invoiceData.pdfUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api${pdfResult.url}`;
    } catch (pdfErr) {
      console.error('PDF Generation failed during quotation conversion:', pdfErr);
      invoiceData.pdfUrl = `https://invoiceease.example.com/print/${invoiceNumber}.pdf`;
    }

    // Save new invoice document and update quotation status
    if (USE_POSTGRES && pgFunctions) {
      // 1. Create Sales Invoice
      await pgFunctions.createInvoice(invoiceData);
      
      // 2. Initialize default reminders configuration for this sales invoice
      const remindOnDays = user.defaultRemindOnDays || [1, 3, 7, 14];
      const channels = user.defaultReminderChannels || ['email'];
      await pgFunctions.upsertPaymentReminder(newInvoiceId, { remindOnDays, channels });

      // 3. Update Quotation Status
      await pgFunctions.dbQuery(
        `UPDATE documents SET quote_status = 'converted', converted_invoice_id = $1, updated_at = NOW() WHERE id = $2`,
        [newInvoiceId, id]
      );
      await pgFunctions.dbQuery(
        `UPDATE invoices SET quote_status = 'converted', converted_invoice_id = $1, updated_at = NOW() WHERE id = $2`,
        [newInvoiceId, id]
      ).catch(() => {});
    } else {
      // Create invoice
      db.invoices.push(invoiceData);

      // Create reminder config
      db.paymentReminders.push({
        invoiceId: newInvoiceId,
        remindOnDays: user.defaultRemindOnDays || [1, 3, 7, 14],
        channels: user.defaultReminderChannels || ['email'],
        lastSentAt: null
      });

      // Update Quotation Status
      const idx = db.invoices.findIndex(inv => inv.id === id);
      if (idx > -1) {
        db.invoices[idx].quoteStatus = 'converted';
        db.invoices[idx].convertedInvoiceId = newInvoiceId;
      }
    }

    res.json({ invoiceId: newInvoiceId, invoiceNumber });
  } catch (err) {
    console.error('Error converting quotation to invoice:', err);
    res.status(500).json({ error: 'Failed to convert quotation' });
  }
});

// POST /api/quotations/:id/send - Send quotation PDF to client
router.post('/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, whatsapp } = req.body;
    let quote = null;
    let user = null;

    if (USE_POSTGRES && pgFunctions) {
      const doc = await pgFunctions.getDocumentById(id);
      quote = pgFunctions.mapDocToInvoice(doc);
      user = await pgFunctions.getUserById(req.userId);
    } else {
      quote = db.invoices.find(inv => inv.id === id && inv.userId === req.userId);
      user = db.users.find(u => u.id === req.userId);
    }

    if (!quote) return res.status(404).json({ error: 'Quotation/Proforma not found' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const targetEmail = email || quote.clientEmail || `${quote.clientName.replace(/\s+/g, '').toLowerCase()}@example.com`;
    const targetMobile = whatsapp || quote.clientMobile || '';

    let emailSent = false;
    let whatsappSent = false;

    // Send Email
    try {
      const emailRes = await sendQuotationEmail(
        targetEmail,
        quote.clientName,
        quote.invoiceNumber,
        quote.totalAmount || quote.amount,
        quote.validUntil ? getLocalDateString(quote.validUntil) : 'NA',
        quote.pdfUrl
      );
      emailSent = emailRes.success !== false;
    } catch (emailErr) {
      console.error('Quotation email dispatch failed:', emailErr.message);
    }

    // Send WhatsApp
    if (targetMobile) {
      try {
        const msg = `Hello ${quote.clientName}, please find our quotation #${quote.invoiceNumber} for ₹${quote.totalAmount || quote.amount} (valid until ${quote.validUntil ? getLocalDateString(quote.validUntil) : 'NA'}): ${quote.pdfUrl}`;
        await sendWhatsAppMessage(targetMobile, msg);
        whatsappSent = true;
      } catch (waErr) {
        console.error('Quotation WhatsApp dispatch failed:', waErr.message);
      }
    }

    // Update status to 'sent'
    if (USE_POSTGRES && pgFunctions) {
      await pgFunctions.dbQuery(
        `UPDATE documents SET quote_status = 'sent', status = 'sent', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      await pgFunctions.dbQuery(
        `UPDATE invoices SET quote_status = 'sent', status = 'sent', updated_at = NOW() WHERE id = $1`,
        [id]
      ).catch(() => {});
    } else {
      const idx = db.invoices.findIndex(inv => inv.id === id);
      if (idx > -1) {
        db.invoices[idx].quoteStatus = 'sent';
        db.invoices[idx].status = 'sent';
      }
    }

    res.json({ success: true, emailSent, whatsappSent });
  } catch (err) {
    console.error('Error sending quotation:', err);
    res.status(500).json({ error: 'Failed to send quotation' });
  }
});

module.exports = router;
