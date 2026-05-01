const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { normalizeWhatsAppNumber } = require('../utils/whatsapp');

const WHATSAPP_PROVIDER = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();

// Meta Cloud API config
const META_WHATSAPP_TOKEN = process.env.WHATSAPP_API_KEY || process.env.WHATSAPP_ACCESS_TOKEN;
const META_WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Gupshup config
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_APP_NAME = process.env.GUPSHUP_APP_NAME;
const GUPSHUP_SOURCE_NUMBER = normalizeWhatsAppNumber(process.env.GUPSHUP_SOURCE_NUMBER || '');

const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'invoiceease-whatsapp-token';
const WHATSAPP_PUBLIC_NUMBER = process.env.WHATSAPP_PUBLIC_NUMBER || process.env.REACT_APP_WHATSAPP_NUMBER || '';

// PostgreSQL functions (imported if available)
let pgFunctions = null;
try {
  pgFunctions = require('../db-postgres');
} catch (err) {
  console.warn('⚠️ PostgreSQL module not available, using in-memory database');
}

const USE_POSTGRES = process.env.USE_POSTGRES === 'true'; // Enable when PostgreSQL is configured

// Conversation state machine
const conversationStates = {
  IDLE: 'idle',
  WAITING_CLIENT_NAME: 'waiting_client_name',
  WAITING_CLIENT_GST: 'waiting_client_gst',
  WAITING_SERVICE: 'waiting_service',
  WAITING_AMOUNT: 'waiting_amount',
  WAITING_GST_CONFIRM: 'waiting_gst_confirm',
  WAITING_GST_TYPE: 'waiting_gst_type',
  COMPLETED: 'completed',
};

const formatINR = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
};

const getUserByWhatsApp = async (whatsappNumber) => {
  const normalizedWhatsApp = normalizeWhatsAppNumber(whatsappNumber);
  if (USE_POSTGRES) {
    return await pgFunctions.dbQuerySingle(
      "SELECT * FROM users WHERE regexp_replace(whatsapp, '[^0-9]', '', 'g') = $1",
      [normalizedWhatsApp]
    );
  }
  return db.users.find((u) => normalizeWhatsAppNumber(u.whatsapp) === normalizedWhatsApp);
};

// Initialize conversations storage for in-memory db
const initConversationsStorage = () => {
  if (!db.conversations) {
    db.conversations = [];
  }
};

const getConversationMemory = (whatsappNumber) => {
  initConversationsStorage();
  const normalizedWhatsApp = normalizeWhatsAppNumber(whatsappNumber);
  return db.conversations.find((c) => normalizeWhatsAppNumber(c.whatsapp_number) === normalizedWhatsApp);
};

const createConversationMemory = (whatsappNumber) => {
  initConversationsStorage();
  const normalizedWhatsApp = normalizeWhatsAppNumber(whatsappNumber);
  const conversation = {
    id: uuidv4(),
    whatsapp_number: normalizedWhatsApp,
    state: conversationStates.IDLE,
    data: {
      client_name: null,
      client_gst: null,
      service: null,
      amount: null,
      gst_applicable: null,
      gst_type: null,
    },
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.conversations.push(conversation);
  return conversation;
};

const updateConversationStateMemory = (whatsappNumber, newState) => {
  const conversation = getConversationMemory(whatsappNumber);
  if (conversation) {
    conversation.state = newState;
    conversation.updated_at = new Date().toISOString();
  }
};

const updateConversationDataMemory = (whatsappNumber, data) => {
  const conversation = getConversationMemory(whatsappNumber);
  if (conversation) {
    conversation.data = { ...conversation.data, ...data };
    conversation.updated_at = new Date().toISOString();
  }
};

const resetConversationMemory = (whatsappNumber) => {
  const normalizedWhatsApp = normalizeWhatsAppNumber(whatsappNumber);
  const idx = db.conversations.findIndex((c) => normalizeWhatsAppNumber(c.whatsapp_number) === normalizedWhatsApp);
  if (idx > -1) {
    db.conversations[idx] = {
      ...db.conversations[idx],
      state: conversationStates.IDLE,
      data: {
        client_name: null,
        client_gst: null,
        service: null,
        amount: null,
        gst_applicable: null,
        gst_type: null,
      },
      updated_at: new Date().toISOString(),
    };
  }
};

const isMetaConfigured = () => Boolean(META_WHATSAPP_TOKEN && META_WHATSAPP_PHONE_NUMBER_ID);
const isGupshupConfigured = () => Boolean(GUPSHUP_API_KEY && GUPSHUP_SOURCE_NUMBER);
const isProviderConfigured = () => (WHATSAPP_PROVIDER === 'gupshup' ? isGupshupConfigured() : isMetaConfigured());

const sendMetaWhatsAppMessage = async (to, text) => {
  const normalizedTo = normalizeWhatsAppNumber(to);
  if (!isMetaConfigured()) {
    console.warn('Meta WhatsApp is not configured: message not sent');
    return;
  }

  const url = `https://graph.facebook.com/v17.0/${META_WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: normalizedTo,
    type: 'text',
    text: { body: text },
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${META_WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('WhatsApp message error:', response.status, body);
    }
  } catch (err) {
    console.error('Meta WhatsApp message failed:', err);
  }
};

const sendGupshupWhatsAppMessage = async (to, text) => {
  const normalizedTo = normalizeWhatsAppNumber(to);
  if (!isGupshupConfigured()) {
    console.warn('Gupshup is not configured: message not sent');
    return;
  }

  const messagePayload = JSON.stringify({ type: 'text', text });
  const body = new URLSearchParams();
  body.set('channel', 'whatsapp');
  body.set('source', GUPSHUP_SOURCE_NUMBER);
  body.set('destination', normalizedTo);
  body.set('message', messagePayload);
  if (GUPSHUP_APP_NAME) {
    body.set('src.name', GUPSHUP_APP_NAME);
  }

  try {
    const response = await fetch('https://api.gupshup.io/wa/api/v1/msg', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apikey: GUPSHUP_API_KEY,
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      console.error('Gupshup message error:', response.status, bodyText);
    }
  } catch (err) {
    console.error('Gupshup message failed:', err);
  }
};

// WhatsApp transport wrapper (provider switch)
const sendWhatsAppMessage = async (to, text) => {
  if (WHATSAPP_PROVIDER === 'gupshup') {
    return sendGupshupWhatsAppMessage(to, text);
  }
  return sendMetaWhatsAppMessage(to, text);
};

const extractMetaMessages = (body) => {
  if (!body || !Array.isArray(body.entry)) return [];
  const messages = [];
  for (const entry of body.entry) {
    if (!entry.changes) continue;
    for (const change of entry.changes) {
      if (!change.value || !Array.isArray(change.value.messages)) continue;
      for (const msg of change.value.messages) {
        const from = normalizeWhatsAppNumber(msg.from);
        let text = '';

        if (msg.type === 'text') text = msg.text?.body || '';
        if (msg.type === 'button') text = msg.button?.text || msg.button?.payload || '';
        if (msg.type === 'interactive') {
          text = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
        }

        if (from && text) messages.push({ from, text });
      }
    }
  }
  return messages;
};

const extractGupshupMessages = (body) => {
  const normalized = typeof body?.payload === 'string'
    ? { ...body, payload: (() => { try { return JSON.parse(body.payload); } catch { return null; } })() }
    : body;

  const payload = normalized?.payload;
  if (!payload) return [];

  const from = normalizeWhatsAppNumber(payload.source || payload.sender?.phone || payload.sender?.id || '');

  let text = '';
  if (payload.type === 'text') {
    text = payload.payload?.text || payload.text || '';
  } else if (payload.type === 'button_reply') {
    text = payload.payload?.title || payload.payload?.text || '';
  } else if (payload.type === 'list_reply') {
    text = payload.payload?.title || payload.payload?.text || '';
  } else {
    text = payload.payload?.text || payload.text || '';
  }

  if (!from || !text) return [];
  return [{ from, text }];
};

const handleWhatsAppText = async (whatsappNumber, text) => {
  let conversation = await getConversation(whatsappNumber);
  if (!conversation) {
    conversation = await createConversation(null, whatsappNumber);
  }

  const state = conversation.state || conversationStates.IDLE;
  text = text.trim();

  if (text.toLowerCase() === 'new invoice') {
    await updateConversationState(whatsappNumber, conversationStates.WAITING_CLIENT_NAME);
    await updateConversationData(whatsappNumber, { client_name: null, client_gst: null, service: null, amount: null, gst_applicable: null, gst_type: null });
    await sendWhatsAppMessage(whatsappNumber, '✅ Great! What is your client name?');
    return;
  }

  switch (state) {
    case conversationStates.WAITING_CLIENT_NAME:
      await updateConversationData(whatsappNumber, { client_name: text });
      await updateConversationState(whatsappNumber, conversationStates.WAITING_CLIENT_GST);
      await sendWhatsAppMessage(whatsappNumber, 'Do they have GST number? (yes/no)');
      break;

    case conversationStates.WAITING_CLIENT_GST:
      if (text.toLowerCase() === 'yes') {
        await updateConversationState(whatsappNumber, conversationStates.WAITING_SERVICE);
        await updateConversationData(whatsappNumber, { client_gst: '', gst_applicable: true });
        await sendWhatsAppMessage(whatsappNumber, 'Please share client GST number');
      } else {
        await updateConversationState(whatsappNumber, conversationStates.WAITING_SERVICE);
        await updateConversationData(whatsappNumber, { client_gst: '', gst_applicable: false });
        await sendWhatsAppMessage(whatsappNumber, 'Please enter service description');
      }
      break;

    case conversationStates.WAITING_SERVICE:
      await updateConversationData(whatsappNumber, { service: text });
      await updateConversationState(whatsappNumber, conversationStates.WAITING_AMOUNT);
      await sendWhatsAppMessage(whatsappNumber, 'Enter the invoice amount (INR)');
      break;

    case conversationStates.WAITING_AMOUNT:
      {
        const amount = parseFloat(text.replace(/[^0-9.]/g, ''));
        if (isNaN(amount) || amount <= 0) {
          await sendWhatsAppMessage(whatsappNumber, 'Please enter a valid amount in INR');
          return;
        }
        await updateConversationData(whatsappNumber, { amount });
        await updateConversationState(whatsappNumber, conversationStates.WAITING_GST_CONFIRM);
        await sendWhatsAppMessage(whatsappNumber, 'Is GST applicable? (yes/no)');
      }
      break;

    case conversationStates.WAITING_GST_CONFIRM:
      if (text.toLowerCase() === 'yes') {
        await updateConversationState(whatsappNumber, conversationStates.WAITING_GST_TYPE);
        await sendWhatsAppMessage(whatsappNumber, 'Is this Intra-state or Inter-state? (intra/inter)');
      } else {
        await updateConversationData(whatsappNumber, { gst_applicable: false, gst_type: 'none' });
        await updateConversationState(whatsappNumber, conversationStates.COMPLETED);
        const completed = await generateInvoice(whatsappNumber, await getConversation(whatsappNumber));
        await sendWhatsAppMessage(whatsappNumber, completed.text || 'Invoice created.');
      }
      break;

    case conversationStates.WAITING_GST_TYPE:
      if (text.toLowerCase().startsWith('intra')) {
        await updateConversationData(whatsappNumber, { gst_type: 'intrastate' });
      } else {
        await updateConversationData(whatsappNumber, { gst_type: 'interstate' });
      }
      await updateConversationState(whatsappNumber, conversationStates.COMPLETED);
      const completed = await generateInvoice(whatsappNumber, await getConversation(whatsappNumber));
      await sendWhatsAppMessage(whatsappNumber, completed.text || 'Invoice created.');
      break;

    default:
      await sendWhatsAppMessage(whatsappNumber, 'Hi! Type *new invoice* to start creating a new invoice.');
      break;
  }
};

// Wrapper functions choosing between PostgreSQL and in-memory
const getConversation = async (whatsappNumber) => {
  if (USE_POSTGRES) {
    return await pgFunctions.getConversation(whatsappNumber);
  }
  return getConversationMemory(whatsappNumber);
};

const createConversation = async (userId, whatsappNumber) => {
  if (USE_POSTGRES) {
    return await pgFunctions.createConversation(userId, whatsappNumber);
  }
  return createConversationMemory(whatsappNumber);
};

const updateConversationState = async (whatsappNumber, newState) => {
  if (USE_POSTGRES) {
    await pgFunctions.updateConversationState(whatsappNumber, newState);
  } else {
    updateConversationStateMemory(whatsappNumber, newState);
  }
};

const updateConversationData = async (whatsappNumber, data) => {
  if (USE_POSTGRES) {
    await pgFunctions.updateConversationData(whatsappNumber, data);
  } else {
    updateConversationDataMemory(whatsappNumber, data);
  }
};

const resetConversation = async (whatsappNumber) => {
  if (USE_POSTGRES) {
    await pgFunctions.resetConversation(whatsappNumber);
  } else {
    resetConversationMemory(whatsappNumber);
  }
};

const generateInvoice = async (whatsappNumber, conversation) => {
  const data = conversation.data;

  let user;
  user = await getUserByWhatsApp(whatsappNumber);

  if (!user) {
    return { error: 'User not found' };
  }

  // Calculate GST
  let subtotal, cgst, sgst, igst, total;
  const gstRate = 18;

  if (data.gst_applicable) {
    subtotal = Number((data.amount / (1 + gstRate / 100)).toFixed(2));

    if (data.gst_type === 'intrastate') {
      cgst = Number((subtotal * (gstRate / 2) / 100).toFixed(2));
      sgst = Number((subtotal * (gstRate / 2) / 100).toFixed(2));
      igst = 0;
    } else {
      cgst = 0;
      sgst = 0;
      igst = Number((subtotal * (gstRate / 100)).toFixed(2));
    }
    total = data.amount;
  } else {
    subtotal = data.amount;
    cgst = sgst = igst = 0;
    total = data.amount;
  }

  // Generate invoice number
  let invoiceNumber;
  if (USE_POSTGRES) {
    invoiceNumber = await pgFunctions.getNextInvoiceNumber(user.id);
  } else {
    const userInvoices = db.invoices.filter((inv) => inv.userId === user.id);
    invoiceNumber = `INV-${String(userInvoices.length + 1).padStart(3, '0')}`;
  }

  // Create invoice data
  const invoiceData = {
    id: uuidv4(),
    userId: user.id,
    invoiceNumber,
    clientName: data.client_name,
    clientGst: data.client_gst || '',
    service: data.service,
    amount: data.amount,
    gstType: data.gst_applicable ? data.gst_type : 'none',
    subtotal,
    cgst,
    sgst,
    igst,
    total,
    gstRate: data.gst_applicable ? gstRate : 0,
    status: 'unpaid',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };

  // Generate PDF
  let pdfResult;
  try {
    const { generateInvoicePDF } = require('../pdf-generator');
    pdfResult = await generateInvoicePDF(invoiceData, user);
    invoiceData.pdfUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api${pdfResult.url}`;
  } catch (pdfError) {
    console.error('PDF generation error:', pdfError);
    // Fallback to placeholder URL if PDF generation fails
    invoiceData.pdfUrl = `https://invoiceease.example.com/print/${invoiceNumber}.pdf`;
  }

  // Save invoice
  if (USE_POSTGRES) {
    await pgFunctions.createInvoice(invoiceData);
  } else {
    db.invoices.push(invoiceData);
    user.invoicesThisMonth = (user.invoicesThisMonth || 0) + 1;
  }

  // Reset conversation after successful invoice creation
  await resetConversation(whatsappNumber);

  const response = {
    text:
      `✅ Invoice created successfully!\n\n` +
      `Invoice #: ${invoiceNumber}\n` +
      `Client: ${data.client_name}\n` +
      `Service: ${data.service}\n` +
      (subtotal ? `Subtotal: ${formatINR(subtotal)}\n` : '') +
      (cgst ? `CGST (9%): ${formatINR(cgst)}\n` : '') +
      (sgst ? `SGST (9%): ${formatINR(sgst)}\n` : '') +
      (igst ? `IGST (18%): ${formatINR(igst)}\n` : '') +
      `Total: ${formatINR(total)}\n\n` +
      `📄 Download: ${invoiceData.pdfUrl}\n\n` +
      `💡 View all invoices at: www.invoiceease.org.in/dashboard\n\n` +
      `Want to create another invoice? Type 'new invoice'`,
    document: {
      url: invoiceData.pdfUrl,
      filename: `${invoiceNumber}.pdf`,
    },
  };

  return response;
};

const processMessage = async (whatsappNumber, userMessage) => {
  const normalizedWhatsApp = normalizeWhatsAppNumber(whatsappNumber);
  const user = await getUserByWhatsApp(normalizedWhatsApp);

  if (!user) {
    return { error: 'WhatsApp number not associated with any user' };
  }

  let conversation = await getConversation(normalizedWhatsApp);
  if (!conversation) {
    conversation = await createConversation(user.id, normalizedWhatsApp);
  }

  const state = conversation.state;
  const data = conversation.data;
  const lowerMessage = userMessage.toLowerCase().trim();

  // Handle new invoice trigger
  if (
    (state === conversationStates.IDLE || state === conversationStates.COMPLETED) &&
    ['hi', 'hello', 'create invoice', 'new invoice', 'start'].includes(lowerMessage)
  ) {
    await resetConversation(normalizedWhatsApp);
    await updateConversationState(normalizedWhatsApp, conversationStates.WAITING_CLIENT_NAME);
    return {
      reply:
        `👋 Welcome to InvoiceEase!\n\n` +
        `Let me help you create an invoice. I'll ask you a few questions.\n\n` +
        `📝 Question 1/6: What's the client name?`,
    };
  }

  switch (state) {
    case conversationStates.IDLE:
      await resetConversation(normalizedWhatsApp);
      await updateConversationState(normalizedWhatsApp, conversationStates.WAITING_CLIENT_NAME);
      return {
        reply:
          `👋 Welcome to InvoiceEase!\n\n` +
          `Let me help you create an invoice. I'll ask you a few questions.\n\n` +
          `📝 Question 1/6: What's the client name?`,
      };

    case conversationStates.WAITING_CLIENT_NAME:
      if (!userMessage.trim()) {
        return { reply: '⚠️ Please enter a valid client name.' };
      }
      await updateConversationData(normalizedWhatsApp, { client_name: userMessage.trim() });
      await updateConversationState(normalizedWhatsApp, conversationStates.WAITING_CLIENT_GST);
      return {
        reply:
          `✅ Got it!\n\n` +
          `📝 Question 2/6: What's the client's GST number?\n` +
          `(Type 'skip' if not applicable)`,
      };

    case conversationStates.WAITING_CLIENT_GST:
      const gstInput = lowerMessage === 'skip' ? null : userMessage.trim();
      await updateConversationData(normalizedWhatsApp, { client_gst: gstInput });
      await updateConversationState(normalizedWhatsApp, conversationStates.WAITING_SERVICE);
      return {
        reply:
          `✅ Noted!\n\n` +
          `📝 Question 3/6: What's the service/product description?`,
      };

    case conversationStates.WAITING_SERVICE:
      if (!userMessage.trim()) {
        return { reply: '⚠️ Please enter a valid service description.' };
      }
      await updateConversationData(normalizedWhatsApp, { service: userMessage.trim() });
      await updateConversationState(normalizedWhatsApp, conversationStates.WAITING_AMOUNT);
      return {
        reply:
          `✅ Perfect!\n\n` +
          `📝 Question 4/6: What's the total amount (in ₹)?`,
      };

    case conversationStates.WAITING_AMOUNT:
      const amount = Number(userMessage.replace(/[^0-9.]/g, ''));
      if (isNaN(amount) || amount <= 0) {
        return {
          reply:
            `❌ Invalid amount. Please enter a valid number.\n\n` +
            `Example: 50000 or 50,000`,
        };
      }
      await updateConversationData(normalizedWhatsApp, { amount });
      await updateConversationState(normalizedWhatsApp, conversationStates.WAITING_GST_CONFIRM);
      return {
        reply:
          `✅ Amount: ${formatINR(amount)}\n\n` +
          `📝 Question 5/6: Is GST applicable?\n` +
          `Reply 'Yes' or 'No'`,
      };

    case conversationStates.WAITING_GST_CONFIRM:
      if (!['yes', 'no', 'y', 'n'].includes(lowerMessage)) {
        return {
          reply: `❌ Please reply with 'Yes' or 'No'`,
        };
      }
      const gstApplicable = ['yes', 'y'].includes(lowerMessage);
      await updateConversationData(normalizedWhatsApp, { gst_applicable: gstApplicable });

      if (gstApplicable) {
        await updateConversationState(normalizedWhatsApp, conversationStates.WAITING_GST_TYPE);
        return {
          reply:
            `📝 Question 6/6: GST type?\n\n` +
            `1️⃣ Intra-State (CGST + SGST)\n` +
            `2️⃣ Inter-State (IGST)\n\n` +
            `Reply with 1 or 2`,
        };
      } else {
        // No GST - generate invoice directly
        return await generateInvoice(normalizedWhatsApp, conversation);
      }

    case conversationStates.WAITING_GST_TYPE:
      if (!['1', '2'].includes(userMessage.trim())) {
        return {
          reply: `❌ Please reply with 1 (Intra-State) or 2 (Inter-State)`,
        };
      }
      const gstType = userMessage.trim() === '1' ? 'intrastate' : 'interstate';
      await updateConversationData(normalizedWhatsApp, { gst_type: gstType });

      // Generate invoice
      return await generateInvoice(normalizedWhatsApp, conversation);

    default:
      return {
        reply: `Type 'new invoice' to create an invoice`,
      };
  }
};

// Webhook verification endpoint required by WhatsApp Business API
router.get('/webhook', (req, res) => {
  if (WHATSAPP_PROVIDER === 'gupshup') {
    // Gupshup may call GET webhook as connectivity probe.
    return res.status(200).send('OK');
  }

  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === WHATSAPP_VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  return res.status(403).send('Forbidden');
});

// Main WhatsApp webhook: receives messages from WhatsApp Business API
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body || {};
    const incomingMessages = WHATSAPP_PROVIDER === 'gupshup'
      ? extractGupshupMessages(body)
      : extractMetaMessages(body);

    if (!incomingMessages.length) {
      return res.status(200).send('EVENT_RECEIVED');
    }

    for (const incoming of incomingMessages) {
      const response = await processMessage(incoming.from, incoming.text);

      if (response.error) {
        await sendWhatsAppMessage(incoming.from, '⚠️ ' + response.error);
      } else {
        if (response.reply) {
          await sendWhatsAppMessage(incoming.from, response.reply);
        }

        if (response.text) {
          await sendWhatsAppMessage(incoming.from, response.text);
        }

        if (response.document && response.document.url) {
          // For now respond with a link (WhatsApp template file messages require advanced API)
          await sendWhatsAppMessage(incoming.from, `Your invoice is ready: ${response.document.url}`);
        }
      }
    }

    res.status(200).send('EVENT_RECEIVED');
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    res.status(500).send('ERROR');
  }
});

// Optional fallback route for test/integration
router.post('/incoming', async (req, res) => {
  try {
    const { from, text } = req.body;

    if (!from || !text) {
      return res.status(400).json({ error: 'Missing "from" or "text" in body' });
    }

    const whatsappNumber = normalizeWhatsAppNumber(from.trim());
    const userMessage = text.trim();
    const response = await processMessage(whatsappNumber, userMessage);

    if (response.error) {
      return res.status(400).json(response);
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error('WhatsApp incoming error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Optional: Test route to check if user exists
router.get('/user/:whatsapp', async (req, res) => {
  try {
    const whatsappNumber = normalizeWhatsAppNumber(req.params.whatsapp);
    const user = await getUserByWhatsApp(whatsappNumber);

    if (!user) {
      return res.status(404).json({ error: 'WhatsApp number not found' });
    }

    const conversation = await getConversation(whatsappNumber);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        businessName: user.businessName,
        whatsapp: user.whatsapp,
      },
      conversation: conversation
        ? {
            id: conversation.id,
            state: conversation.state,
            createdAt: conversation.started_at,
          }
        : null,
    });
  } catch (err) {
    console.error('Error in /user route:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status', (req, res) => {
  res.json({
    provider: WHATSAPP_PROVIDER,
    configured: isProviderConfigured(),
    webhookVerifyTokenConfigured: Boolean(WHATSAPP_VERIFY_TOKEN),
    phoneNumberIdConfigured: Boolean(META_WHATSAPP_PHONE_NUMBER_ID),
    metaConfigured: isMetaConfigured(),
    gupshupConfigured: isGupshupConfigured(),
    publicNumber: WHATSAPP_PUBLIC_NUMBER || null,
    webhookPath: '/api/whatsapp/webhook',
  });
});

router.post('/test-send', authMiddleware, async (req, res) => {
  try {
    const user = db.users.find((entry) => entry.id === req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.whatsapp) {
      return res.status(400).json({ error: 'No WhatsApp number saved for this user' });
    }

    const previewText = req.body?.text || `InvoiceEase test message for ${user.businessName}. Reply with "new invoice" to begin.`;
    await sendWhatsAppMessage(user.whatsapp, previewText);

    return res.json({ message: 'Test WhatsApp message queued', to: normalizeWhatsAppNumber(user.whatsapp) });
  } catch (error) {
    console.error('WhatsApp test send failed:', error);
    return res.status(500).json({ error: 'Failed to send test WhatsApp message' });
  }
});

module.exports = router;
