const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { normalizeWhatsAppNumber } = require('../utils/whatsapp');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// PostgreSQL functions (imported if available)
let pgFunctions = null;
try {
  pgFunctions = require('../db-postgres');
} catch (err) {
  console.warn('⚠️ PostgreSQL module not available, using in-memory database');
}

const USE_POSTGRES = process.env.USE_POSTGRES === 'true';

// Conversation state machine (same as before)
const conversationStates = {
  IDLE: 'idle',
  WAITING_CLIENT_NAME: 'waiting_client_name',
  WAITING_ITEM_DESC: 'waiting_item_desc',
  WAITING_ITEM_QTY: 'waiting_item_qty',
  WAITING_ITEM_PRICE: 'waiting_item_price',
  WAITING_ADD_ANOTHER_ITEM: 'waiting_add_another_item',
  WAITING_GST_RATE: 'waiting_gst_rate',
  WAITING_NOTES: 'waiting_notes',
  WAITING_TEMPLATE: 'waiting_template',
  COMPLETED: 'completed',
};

const formatINR = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
};

const getPublicBaseUrl = (overrideBaseUrl) => {
  if (overrideBaseUrl) return overrideBaseUrl;
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  if (process.env.BASE_URL) return process.env.BASE_URL;
  return 'http://localhost:5000';
};

// --- User lookup by Telegram chat ID ---
const getUserByTelegram = async (chatId) => {
  const chatIdStr = String(chatId);
  if (USE_POSTGRES) {
    return await pgFunctions.dbQuerySingle(
      'SELECT * FROM users WHERE telegram_chat_id = $1',
      [chatIdStr]
    );
  }
  return db.users.find((u) => String(u.telegram_chat_id) === chatIdStr);
};

// --- Conversations storage (in-memory) ---
const initConversationsStorage = () => {
  if (!db.conversations) {
    db.conversations = [];
  }
};

const getConversationMemory = (chatId) => {
  initConversationsStorage();
  const chatIdStr = String(chatId);
  return db.conversations.find((c) => String(c.telegram_chat_id) === chatIdStr);
};

const createConversationMemory = (chatId) => {
  initConversationsStorage();
  const chatIdStr = String(chatId);
  const conversation = {
    id: uuidv4(),
    telegram_chat_id: chatIdStr,
    state: conversationStates.IDLE,
    data: {
      client_name: null,
      item_desc: null,
      item_qty: null,
      item_price: null,
      gst_rate: null,
      notes: null,
      template: null,
    },
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.conversations.push(conversation);
  return conversation;
};

const updateConversationStateMemory = (chatId, newState) => {
  const conversation = getConversationMemory(chatId);
  if (conversation) {
    conversation.state = newState;
    conversation.updated_at = new Date().toISOString();
  }
};

const updateConversationDataMemory = (chatId, data) => {
  const conversation = getConversationMemory(chatId);
  if (conversation) {
    conversation.data = { ...conversation.data, ...data };
    conversation.updated_at = new Date().toISOString();
  }
};

const resetConversationMemory = (chatId) => {
  initConversationsStorage();
  const chatIdStr = String(chatId);
  const idx = db.conversations.findIndex((c) => String(c.telegram_chat_id) === chatIdStr);
  if (idx > -1) {
    db.conversations[idx] = {
      ...db.conversations[idx],
      state: conversationStates.IDLE,
      data: {
        client_name: null,
        item_desc: null,
        item_qty: null,
        item_price: null,
        gst_rate: null,
        notes: null,
        template: null,
      },
      updated_at: new Date().toISOString(),
    };
  }
};

// --- Wrapper functions (PostgreSQL vs in-memory) ---
const getConversation = async (chatId) => {
  if (USE_POSTGRES) {
    return await pgFunctions.getConversation(String(chatId));
  }
  return getConversationMemory(chatId);
};

const createConversation = async (userId, chatId) => {
  if (USE_POSTGRES) {
    return await pgFunctions.createConversation(userId, String(chatId));
  }
  return createConversationMemory(chatId);
};

const updateConversationState = async (chatId, newState) => {
  if (USE_POSTGRES) {
    await pgFunctions.updateConversationState(String(chatId), newState);
  } else {
    updateConversationStateMemory(chatId, newState);
  }
};

const updateConversationData = async (chatId, data) => {
  if (USE_POSTGRES) {
    await pgFunctions.updateConversationData(String(chatId), data);
  } else {
    updateConversationDataMemory(chatId, data);
  }
};

const resetConversation = async (chatId) => {
  if (USE_POSTGRES) {
    await pgFunctions.resetConversation(String(chatId));
  } else {
    resetConversationMemory(chatId);
  }
};

// --- Telegram message sending ---
const sendTelegramMessage = async (chatId, text) => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('Telegram bot token not configured: message not sent');
    return;
  }

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Telegram send error:', response.status, body);
    }

    return await response.json();
  } catch (err) {
    console.error('Telegram message failed:', err);
  }
};

const sendTelegramDocument = async (chatId, url, filename, caption) => {
  if (!TELEGRAM_BOT_TOKEN) return;

  try {
    const response = await fetch(`${TELEGRAM_API_URL}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        document: url,
        filename: filename,
        caption: caption || '',
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Telegram document send error:', response.status, body);
      return { ok: false };
    }

    return await response.json();
  } catch (err) {
    console.error('Telegram document send failed:', err);
    return { ok: false };
  }
};

// --- Invoice generation ---
const generateInvoice = async (chatId, conversation, baseUrlOverride) => {
  const data = conversation.data;
  const user = await getUserByTelegram(chatId);

  if (!user) {
    return { error: 'User not found' };
  }

  if (user.plan === 'free' && (user.invoicesThisMonth || 0) >= 5) {
    await resetConversation(chatId);
    return { reply: '❌ Free plan limit reached (5 invoices/month). Please upgrade at www.invoiceease.org.in to create more invoices.' };
  }

  const normalizedItems = Array.isArray(data.items) && data.items.length > 0 
    ? data.items 
    : [{
        description: data.item_desc,
        quantity: data.item_qty,
        unitPrice: data.item_price
      }];

  const parsedAmount = normalizedItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
  const parsedGstRate = Number(data.gst_rate) || 0;
  const gstAmount = Number(((parsedAmount * parsedGstRate) / 100).toFixed(2));
  const totalAmount = Number((parsedAmount + gstAmount).toFixed(2));

  // Generate invoice number
  let invoiceNumber;
  if (USE_POSTGRES) {
    invoiceNumber = await pgFunctions.getNextInvoiceNumber(user.id);
  } else {
    const userInvoices = db.invoices.filter((inv) => inv.userId === user.id);
    invoiceNumber = `INV-${String(userInvoices.length + 1).padStart(3, '0')}`;
  }


  const requestedTemplateStyle = ['modern', 'minimal', 'classic', 'premium'].includes(data.template)
    ? data.template
    : null;

  // Create invoice data
  const invoiceData = {
    id: uuidv4(),
    userId: user.id,
    invoiceNumber,
    clientName: data.client_name,
    clientGst: '',
    service: normalizedItems.length > 1 ? 'Multiple Items' : normalizedItems[0].description,
    items: normalizedItems,
    amount: parsedAmount,
    gstRate: parsedGstRate,
    gstAmount,
    totalAmount,
    notes: data.notes === 'skip' ? '' : (data.notes || ''),
    dueDate: null,
    status: 'unpaid',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    templateStyle: requestedTemplateStyle || user.templateStyle || 'modern',
    showWatermark: user.plan === 'free' ? true : (user.showWatermark !== false),
  };

  // Generate PDF
  let pdfResult;
  try {
    const { generateInvoicePDF } = require('../pdf-generator');
    const pdfPayload = {
      ...invoiceData,
      items: normalizedItems,
      subtotal: parsedAmount,
      cgst: parsedGstRate > 0 ? Number(((parsedAmount * parsedGstRate) / 100 / 2).toFixed(2)) : 0,
      sgst: parsedGstRate > 0 ? Number(((parsedAmount * parsedGstRate) / 100 / 2).toFixed(2)) : 0,
      igst: 0,
      total: totalAmount,
      gstType: 'intrastate',
      gstApplicable: parsedGstRate > 0,
    };
    pdfResult = await generateInvoicePDF(pdfPayload, user);
    const publicBaseUrl = getPublicBaseUrl(baseUrlOverride);
    invoiceData.pdfUrl = `${publicBaseUrl}/api${pdfResult.url}`;
  } catch (pdfError) {
    console.error('PDF generation error:', pdfError);
    invoiceData.pdfUrl = null;
  }

  // Save invoice
  if (USE_POSTGRES) {
    await pgFunctions.createInvoice(invoiceData);
    await pgFunctions.updateUser(user.id, { invoices_this_month: (user.invoicesThisMonth || 0) + 1 });
  } else {
    db.invoices.push(invoiceData);
    user.invoicesThisMonth = (user.invoicesThisMonth || 0) + 1;
  }

  // Send email
  if (invoiceData.pdfUrl && pdfResult && pdfResult.filePath) {
    const { sendInvoiceEmail } = require('../services/email');
    sendInvoiceEmail(user.email, data.client_name, invoiceData, pdfResult.filePath)
      .catch(err => console.error('Background email failed:', err));
  }

  // Reset conversation after invoice creation
  await resetConversation(chatId);

  const response = {
    text:
      `✅ *Invoice created successfully!*\n\n` +
      `📋 Invoice #: ${invoiceNumber}\n` +
      `👤 Client: ${data.client_name}\n` +
      `🔧 Item: ${data.item_desc} (x${data.item_qty})\n` +
      `💵 Subtotal: ${formatINR(parsedAmount)}\n` +
      (gstAmount ? `📊 GST (${parsedGstRate}%): ${formatINR(gstAmount)}\n` : '') +
      `💰 *Total: ${formatINR(totalAmount)}*\n\n` +
      (invoiceData.pdfUrl ? `📄 Download: ${invoiceData.pdfUrl}\n\n` : '') +
      `💡 View all invoices at: www.invoiceease.org.in/dashboard\n\n` +
      `Want to create another invoice? Type /newinvoice`,
  };

  if (invoiceData.pdfUrl) {
    response.document = {
      url: invoiceData.pdfUrl,
      filename: `${invoiceNumber}.pdf`,
    };
  }

  return response;
};

// --- Process incoming Telegram message ---
const processMessage = async (chatId, userMessage, baseUrlOverride) => {
  let user = await getUserByTelegram(chatId);

  // Auto-link: if no user found by chat ID, link to the most recent unlinked user
  // or prompt user to sign up
  if (!user) {
    const lowerMsg = userMessage.toLowerCase().trim();

    // Try to auto-link if user sends /start with their phone number
    // Format: /start +919876543210
    if (lowerMsg.startsWith('/start ') && userMessage.trim().split(' ').length === 2) {
      const phoneInput = userMessage.trim().split(' ')[1];
      const normalizedPhone = normalizeWhatsAppNumber(phoneInput);
      let matchedUser = null;

      if (!normalizedPhone) {
        return {
          reply:
            `❌ Invalid phone number format.\n\n` +
            `Please send it like this:\n` +
            `/start +919876543210`,
        };
      }

      if (USE_POSTGRES) {
        matchedUser = await pgFunctions.getUserByWhatsApp(normalizedPhone);
        if (matchedUser && matchedUser.telegram_chat_id) matchedUser = null; // already linked
      } else {
        matchedUser = db.users.find(
          (u) => u.whatsapp && normalizeWhatsAppNumber(u.whatsapp) === normalizedPhone && !u.telegram_chat_id
        );
      }

      if (matchedUser) {
        if (USE_POSTGRES) {
          await pgFunctions.updateUser(matchedUser.id, { telegram_chat_id: String(chatId) });
        } else {
          matchedUser.telegram_chat_id = String(chatId);
        }
        user = matchedUser;
        console.log(`✅ Auto-linked Telegram chat ${chatId} to user ${user.email}`);
      } else {
        return {
          reply:
            `❌ No account found for that phone number, or it's already linked.\n\n` +
            `Please sign up at www.invoiceease.org.in first, then send:\n` +
            `/start +919876543210`,
        };
      }
    } else {
      return {
        reply:
          `👋 Welcome to *InvoiceEase*!\n\n` +
          `To link your Telegram account, send:\n` +
          `/start +919876543210\n\n` +
          `(Use the phone number you signed up with at www.invoiceease.org.in)`,
      };
    }
  }

  let conversation = await getConversation(chatId);
  if (!conversation) {
    conversation = await createConversation(user.id, chatId);
  }

  const state = conversation.state;
  const lowerMessage = userMessage.toLowerCase().trim();

  // Handle new invoice trigger
  if (
    (state === conversationStates.IDLE || state === conversationStates.COMPLETED) &&
    ['/start', '/newinvoice', 'hi', 'hello', 'create invoice', 'new invoice', 'start'].includes(lowerMessage)
  ) {
    await resetConversation(chatId);
    await updateConversationState(chatId, conversationStates.WAITING_CLIENT_NAME);
    return {
      reply:
        `👋 Welcome to *InvoiceEase*!\n\n` +
        `Let me help you create an invoice. I'll ask you a few questions.\n\n` +
        `📝 *Question 1/7:* What's the client name?`,
    };
  }

  // Handle cancel command
  if (lowerMessage === '/cancel') {
    await resetConversation(chatId);
    return {
      reply: '❌ Invoice creation cancelled. Type /newinvoice to start again.',
    };
  }

  switch (state) {
    case conversationStates.IDLE:
      await resetConversation(chatId);
      await updateConversationState(chatId, conversationStates.WAITING_CLIENT_NAME);
      return {
        reply:
          `👋 Welcome to *InvoiceEase*!\n\n` +
          `Let me help you create an invoice. I'll ask you a few questions.\n\n` +
          `📝 *Question 1/7:* What's the client name?`,
      };

    case conversationStates.WAITING_CLIENT_NAME:
      if (!userMessage.trim()) {
        return { reply: '⚠️ Please enter a valid client name.' };
      }
      await updateConversationData(chatId, { client_name: userMessage.trim() });
      await updateConversationState(chatId, conversationStates.WAITING_ITEM_DESC);
      return {
        reply:
          `✅ Got it!\n\n` +
          `📝 *Question 2/7:* What's the item/service description?`,
      };

    case conversationStates.WAITING_ITEM_DESC:
      if (!userMessage.trim()) {
        return { reply: '⚠️ Please enter a valid item description.' };
      }
      await updateConversationData(chatId, { item_desc: userMessage.trim() });
      await updateConversationState(chatId, conversationStates.WAITING_ITEM_QTY);
      return {
        reply:
          `✅ Noted!\n\n` +
          `📝 *Question 3/7:* What's the quantity?`,
      };

    case conversationStates.WAITING_ITEM_QTY:
      const qty = Number(userMessage.replace(/[^0-9.]/g, ''));
      if (isNaN(qty) || qty <= 0) {
        return { reply: `❌ Invalid quantity. Please enter a valid number (e.g. 1).` };
      }
      await updateConversationData(chatId, { item_qty: qty });
      await updateConversationState(chatId, conversationStates.WAITING_ITEM_PRICE);
      return {
        reply:
          `✅ Quantity: ${qty}\n\n` +
          `📝 *Question 4/7:* What's the unit price (in ₹)?`,
      };

    case conversationStates.WAITING_ITEM_PRICE:
      const price = Number(userMessage.replace(/[^0-9.]/g, ''));
      if (isNaN(price) || price < 0) {
        return { reply: `❌ Invalid price. Please enter a valid number.` };
      }
      const currentItems = conversation.data.items || [];
      currentItems.push({
        description: conversation.data.item_desc,
        quantity: conversation.data.item_qty,
        unitPrice: price
      });
      await updateConversationData(chatId, { items: currentItems, item_price: price });
      await updateConversationState(chatId, conversationStates.WAITING_ADD_ANOTHER_ITEM);
      return {
        reply:
          `✅ Item added: ${conversation.data.item_desc} - ${formatINR(price)}\n\n` +
          `📝 Do you want to add another item? (Reply Yes or No)`,
      };

    case conversationStates.WAITING_ADD_ANOTHER_ITEM:
      const answer = lowerMessage;
      if (answer === 'yes' || answer === 'y') {
        await updateConversationState(chatId, conversationStates.WAITING_ITEM_DESC);
        return {
          reply: `📝 What's the description for the next item?`,
        };
      } else if (answer === 'no' || answer === 'n') {
        await updateConversationState(chatId, conversationStates.WAITING_GST_RATE);
        return {
          reply:
            `✅ Items saved!\n\n` +
            `📝 What's the GST Rate for the invoice?\n` +
            `(Reply with: 0, 5, 12, 18, or 28)`,
        };
      } else {
        return { reply: `❌ Please reply with Yes or No.` };
      }

    case conversationStates.WAITING_GST_RATE:
      const rate = Number(userMessage.replace(/[^0-9.]/g, ''));
      if (![0, 5, 12, 18, 28].includes(rate)) {
        return { reply: `❌ Invalid GST rate. Please reply with 0, 5, 12, 18, or 28.` };
      }
      await updateConversationData(chatId, { gst_rate: rate });
      await updateConversationState(chatId, conversationStates.WAITING_NOTES);
      return {
        reply:
          `✅ GST Rate: ${rate}%\n\n` +
          `📝 *Question 6/7:* Any notes/payment terms? (Type 'skip' if none)`,
      };

    case conversationStates.WAITING_NOTES:
      await updateConversationData(chatId, { notes: userMessage.trim() });
      
      const isPro = user.plan === 'pro' || user.plan === 'business';
      if (!isPro) {
        await updateConversationData(chatId, { template: 'modern' });
        return await generateInvoice(chatId, conversation, baseUrlOverride);
      }
      
      await updateConversationState(chatId, conversationStates.WAITING_TEMPLATE);
      return {
        reply:
          `✅ Notes added!\n\n` +
          `📝 *Question 7/7:* Which invoice template do you want?\n` +
          `Options: modern, minimal, classic, premium`,
      };

    case conversationStates.WAITING_TEMPLATE:
      const template = lowerMessage;
      if (!['modern', 'minimal', 'classic', 'premium'].includes(template)) {
        return { reply: `❌ Invalid template. Please reply with modern, minimal, classic, or premium.` };
      }
      await updateConversationData(chatId, { template });
      return await generateInvoice(chatId, conversation, baseUrlOverride);

    default:
      return {
        reply: `Type /newinvoice to create an invoice or /cancel to start over.`,
      };
  }
};

// --- Telegram Webhook endpoint ---
router.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    console.log('📩 Telegram update received:', JSON.stringify(update).substring(0, 300));
    const forwardedProto = req.get('x-forwarded-proto');
    const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
    const requestBaseUrl = `${protocol}://${req.get('host')}`;

    // Handle text messages
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      const response = await processMessage(chatId, text, requestBaseUrl);

      if (response.error) {
        await sendTelegramMessage(chatId, '⚠️ ' + response.error);
      } else {
        if (response.reply) {
          await sendTelegramMessage(chatId, response.reply);
        }
        if (response.text) {
          await sendTelegramMessage(chatId, response.text);
        }
        if (response.document && response.document.url) {
          const sent = await sendTelegramDocument(
            chatId,
            response.document.url,
            response.document.filename,
            'Your invoice PDF is ready'
          );

          if (!sent || sent.ok === false) {
            await sendTelegramMessage(chatId, `📄 Your invoice is ready: ${response.document.url}`);
          }
        }
      }
    }

    // Telegram expects 200 OK always
    res.status(200).send('OK');
  } catch (err) {
    console.error('Telegram webhook error:', err);
    res.status(200).send('OK'); // Still send 200 to avoid Telegram retries
  }
});

// --- Set webhook URL (call once to register with Telegram) ---
router.post('/set-webhook', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Missing webhook URL in body' });
    }

    const webhookUrl = `${url}/api/telegram/webhook`;
    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const result = await response.json();
    console.log('Telegram setWebhook result:', result);

    res.json({ success: result.ok, result });
  } catch (err) {
    console.error('Failed to set Telegram webhook:', err);
    res.status(500).json({ error: 'Failed to set webhook' });
  }
});

// --- One-time auto-setup webhook (visit in browser to register) ---
router.get('/setup-webhook', async (req, res) => {
  try {
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${baseUrl}/api/telegram/webhook`;

    const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl }),
    });

    const result = await response.json();
    console.log('Telegram setWebhook result:', result);

    res.json({ success: result.ok, webhookUrl, result });
  } catch (err) {
    console.error('Failed to set Telegram webhook:', err);
    res.status(500).json({ error: 'Failed to set webhook' });
  }
});

// --- Get webhook info ---
router.get('/webhook-info', async (req, res) => {
  try {
    const response = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`);
    const result = await response.json();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get webhook info' });
  }
});

// --- Test endpoint to simulate a message ---
router.post('/incoming', async (req, res) => {
  try {
    const { chatId, text } = req.body;

    if (!chatId || !text) {
      return res.status(400).json({ error: 'Missing "chatId" or "text" in body' });
    }

    const response = await processMessage(chatId, text.trim(), process.env.PUBLIC_BASE_URL || process.env.BASE_URL);

    if (response.error) {
      return res.status(400).json(response);
    }

    return res.status(200).json(response);
  } catch (err) {
    console.error('Telegram incoming error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Status endpoint ---
router.get('/status', (req, res) => {
  res.json({
    provider: 'telegram',
    configured: Boolean(TELEGRAM_BOT_TOKEN),
    webhookPath: '/api/telegram/webhook',
  });
});

// --- Link Telegram account to user ---
router.post('/link', authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.body;
    if (!chatId) {
      return res.status(400).json({ error: 'Missing chatId' });
    }

    const user = db.users.find((u) => u.id === req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.telegram_chat_id = String(chatId);
    res.json({ message: 'Telegram linked successfully', chatId });
  } catch (err) {
    console.error('Telegram link error:', err);
    res.status(500).json({ error: 'Failed to link Telegram' });
  }
});

// --- Test send message ---
router.post('/test-send', authMiddleware, async (req, res) => {
  try {
    const user = db.users.find((entry) => entry.id === req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.telegram_chat_id) {
      return res.status(400).json({ error: 'No Telegram account linked for this user' });
    }

    const previewText =
      req.body?.text ||
      `🧾 InvoiceEase test message for ${user.businessName}. Reply with /newinvoice to begin.`;
    await sendTelegramMessage(user.telegram_chat_id, previewText);

    return res.json({ message: 'Test Telegram message sent', chatId: user.telegram_chat_id });
  } catch (error) {
    console.error('Telegram test send failed:', error);
    return res.status(500).json({ error: 'Failed to send test Telegram message' });
  }
});

module.exports = router;
