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
  WAITING_VALID_UNTIL: 'waiting_valid_until',
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

// --- Telegram keyboards and helpers ---
const defaultMenuKeyboard = {
  keyboard: [
    [{ text: '⚡ Create Invoice' }, { text: '📄 Create Quotation' }],
    [{ text: '📝 Create Proforma' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

const yesNoKeyboard = {
  keyboard: [
    [{ text: '✅ Yes, add another' }, { text: '🛑 No, finish items' }],
    [{ text: '❌ Cancel' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

const gstKeyboard = {
  keyboard: [
    [{ text: '0%' }, { text: '5%' }, { text: '12%' }],
    [{ text: '18%' }, { text: '28%' }],
    [{ text: '❌ Cancel' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

const templateKeyboard = {
  keyboard: [
    [{ text: 'modern' }, { text: 'minimal' }],
    [{ text: 'classic' }, { text: 'premium' }],
    [{ text: '❌ Cancel' }]
  ],
  resize_keyboard: true,
  one_time_keyboard: true
};

const parseAmountString = (str) => {
  const lower = str.toLowerCase();
  let multiplier = 1;

  if (lower.includes('hazaar') || lower.includes('thousand')) {
    multiplier = 1000;
  } else if (lower.includes('lakh') || lower.includes('lac')) {
    multiplier = 100000;
  } else if (/\b\d+k\b/.test(lower)) {
    multiplier = 1000;
  }

  const numOnly = lower.replace(/[^0-9.]/g, '');
  const parsedNum = parseFloat(numOnly);

  if (isNaN(parsedNum)) return 0;
  return parsedNum * multiplier;
};

const parseOneShotMessage = (text) => {
  const cleanText = text.trim().replace(/(\d),(\d)/g, '$1$2');
  const lowerText = cleanText.toLowerCase();

  // 1. Identify document type
  let docType = null;
  if (lowerText.includes('invoice') || lowerText.includes('bill')) {
    docType = 'sales_invoice';
  } else if (lowerText.includes('proforma')) {
    docType = 'proforma';
  } else if (lowerText.includes('quotation') || lowerText.includes('quote')) {
    docType = 'quotation';
  }

  if (!docType) {
    if (lowerText.includes('for ') && (/\b\d[\d,]*\b/.test(lowerText) || lowerText.includes('hazaar') || lowerText.includes('thousand'))) {
      docType = 'sales_invoice';
    } else {
      return null;
    }
  }

  // 2. Parse segments usually separated by commas or newlines
  const separators = cleanText.includes('\n') ? '\n' : ',';
  const parts = cleanText.split(separators).map(p => p.trim());

  let clientName = '';
  let amount = 0;
  let description = 'Services';

  if (parts.length >= 2) {
    const part1 = parts[0];
    const part1Lower = part1.toLowerCase();

    if (part1Lower.includes('for ')) {
      const idx = part1Lower.indexOf('for ');
      clientName = part1.substring(idx + 4).trim();
    } else if (part1Lower.includes('ke liye')) {
      const idx = part1Lower.indexOf('ke liye');
      clientName = part1.substring(0, idx).trim();
    } else {
      clientName = part1
        .replace(/invoice/gi, '')
        .replace(/quotation/gi, '')
        .replace(/quote/gi, '')
        .replace(/proforma/gi, '')
        .replace(/bill/gi, '')
        .replace(/banao/gi, '')
        .replace(/banaye/gi, '')
        .trim();
    }

    const part2 = parts[1];
    amount = parseAmountString(part2);

    if (parts.length >= 3) {
      description = parts.slice(2).join(', ').trim();
    }
  } else {
    const amountMatch = cleanText.match(/\b\d[\d,]*k?\b/i) || cleanText.match(/\b\d+\s*(hazaar|thousand|lakh|lacs?)\b/i);
    if (amountMatch) {
      amount = parseAmountString(amountMatch[0]);
      const textWithoutAmount = cleanText.replace(amountMatch[0], '');
      const parts2 = textWithoutAmount.split(/for|ke liye/i).map(p => p.trim());
      if (parts2.length >= 2) {
        clientName = parts2[1]
          .replace(/invoice/gi, '')
          .replace(/quotation/gi, '')
          .replace(/quote/gi, '')
          .replace(/proforma/gi, '')
          .replace(/banao/gi, '')
          .trim();
        description = parts2[0]
          .replace(/invoice/gi, '')
          .replace(/quotation/gi, '')
          .replace(/quote/gi, '')
          .replace(/proforma/gi, '')
          .replace(/banao/gi, '')
          .trim();
      }
    }
  }

  clientName = clientName.replace(/^[:\-\s\.,]+|[:\-\s\.,]+$/g, '').trim();
  description = description.replace(/^[:\-\s\.,]+|[:\-\s\.,]+$/g, '').trim();

  if (!clientName || amount <= 0) {
    return null;
  }

  return {
    docType,
    clientName,
    amount,
    description
  };
};

// --- Telegram message sending ---
const sendTelegramMessage = async (chatId, text, replyMarkup) => {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('Telegram bot token not configured: message not sent');
    return;
  }

  try {
    const bodyPayload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    };
    if (replyMarkup) {
      bodyPayload.reply_markup = replyMarkup;
    }

    const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
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

  const docType = data.doc_type || 'sales_invoice';
  const welcomeText = docType === 'quotation' ? 'Quotation' : (docType === 'proforma' ? 'Proforma' : 'Invoice');

  if (user.plan === 'free' && (user.invoicesThisMonth || 0) >= 5) {
    await resetConversation(chatId);
    return { 
      reply: `❌ *Free plan limit reached* (5 documents/month).\n\nPlease upgrade at [InvoiceEase Settings](${getPublicBaseUrl(baseUrlOverride)}/settings) to create more documents.`,
      replyMarkup: defaultMenuKeyboard
    };
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

  // Generate doc number
  let invoiceNumber;
  if (USE_POSTGRES) {
    invoiceNumber = await pgFunctions.getNextDocNumber(user.id, docType);
  } else {
    const year = new Date().getFullYear();
    const prefixMap = {
      sales_invoice: 'INV-',
      quotation: `QT-${year}-`,
      proforma: `PI-${year}-`
    };
    const prefix = prefixMap[docType] || 'INV-';
    const userDocs = db.invoices.filter((inv) => inv.userId === user.id && inv.docType === docType);
    invoiceNumber = `${prefix}${String(userDocs.length + 1).padStart(3, '0')}`;
  }

  const requestedTemplateStyle = ['modern', 'minimal', 'classic', 'premium'].includes(data.template)
    ? data.template
    : null;

  // Calculate due date and valid until date
  let dueDate = null;
  let validUntil = null;
  if (docType === 'quotation') {
    dueDate = data.valid_until || null;
    validUntil = data.valid_until || null;
  } else {
    const defaultDays = user.defaultDueDays || 30;
    const due = new Date();
    due.setDate(due.getDate() + defaultDays);
    dueDate = due.toISOString().split('T')[0];
  }

  // Create invoice/document data
  const invoiceData = {
    id: uuidv4(),
    userId: user.id,
    docType,
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
    dueDate,
    status: 'unpaid',
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    templateStyle: requestedTemplateStyle || user.templateStyle || 'modern',
    showWatermark: user.plan === 'free' ? true : (user.showWatermark !== false),
    paymentStatus: 'unpaid',
    paidAmount: 0.00,
    validUntil,
    quoteStatus: docType === 'quotation' ? 'draft' : null,
    convertedInvoiceId: null
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
    
    // Automatically initialize default reminder configuration record for sales invoices
    if (docType === 'sales_invoice') {
      const remindOnDays = user.defaultRemindOnDays || [1, 3, 7, 14];
      const channels = user.defaultReminderChannels || ['email'];
      await pgFunctions.upsertPaymentReminder(invoiceData.id, { remindOnDays, channels });
    }
    
    await pgFunctions.updateUser(user.id, { invoices_this_month: (user.invoicesThisMonth || 0) + 1 });
  } else {
    db.invoices.push(invoiceData);
    
    // Automatically initialize in-memory reminder config
    if (docType === 'sales_invoice') {
      if (!db.paymentReminders) db.paymentReminders = [];
      db.paymentReminders.push({
        invoiceId: invoiceData.id,
        remindOnDays: user.defaultRemindOnDays || [1, 3, 7, 14],
        channels: user.defaultReminderChannels || ['email'],
        lastSentAt: null
      });
    }
    
    user.invoicesThisMonth = (user.invoicesThisMonth || 0) + 1;
  }

  // Reset conversation after invoice creation
  await resetConversation(chatId);

  const isQuotation = docType === 'quotation';
  const limitDateLabel = isQuotation ? `⏳ *Valid Until:* ${invoiceData.validUntil || 'N/A'}` : `⏳ *Due Date:* ${invoiceData.dueDate || 'N/A'}`;
  const itemsText = normalizedItems.map((item, idx) => `  ${idx + 1}. _${item.description}_ (x${item.quantity}) - ${formatINR(item.unitPrice)}`).join('\n');

  const response = {
    text:
      `⚡ *InvoiceEase* — Premium Document Generated\n\n` +
      `*━━━━━━━━━━━━━━━━━━━━━━━━*\n` +
      `📄 *Document Type:* ${welcomeText}\n` +
      `📋 *Doc Number:* \`${invoiceNumber}\`\n` +
      `👤 *Client Name:* ${data.client_name}\n` +
      `📅 *Date:* ${invoiceData.date}\n` +
      `${limitDateLabel}\n` +
      `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
      `*Items List:*\n` +
      `${itemsText}\n\n` +
      `*Financial Summary:*\n` +
      `💵 *Subtotal:* ${formatINR(parsedAmount)}\n` +
      (gstAmount ? `📊 *GST (${parsedGstRate}%):* ${formatINR(gstAmount)}\n` : '') +
      `💰 *Total Amount:* *${formatINR(totalAmount)}*\n\n` +
      `*━━━━━━━━━━━━━━━━━━━━━━━━*\n` +
      (invoiceData.pdfUrl ? `📄 *PDF Download:* [Download Document PDF](${invoiceData.pdfUrl})\n\n` : '') +
      `💡 *Management & Tracking:*\n` +
      `Manage this document and track payments at:\n` +
      `[InvoiceEase Web Dashboard](${getPublicBaseUrl(baseUrlOverride)}/dashboard)\n\n` +
      `✨ _Select a command from the menu below to start a new document._`,
    replyMarkup: defaultMenuKeyboard
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

  // Auto-link: if no user found by chat ID, link by starting or by direct phone entry
  if (!user) {
    const lowerMsg = userMessage.toLowerCase().trim();
    let phoneInput = null;

    if (lowerMsg.startsWith('/start ') && userMessage.trim().split(' ').length === 2) {
      phoneInput = userMessage.trim().split(' ')[1];
    } else if (/^\+?[0-9\-\s]{10,15}$/.test(lowerMsg)) {
      phoneInput = userMessage.trim();
    }

    if (phoneInput) {
      const normalizedPhone = normalizeWhatsAppNumber(phoneInput);
      let matchedUser = null;

      if (!normalizedPhone) {
        return {
          reply:
            `❌ *Invalid phone number format.*\n\n` +
            `Please send it like this:\n` +
            `Example: /start 9876543210`,
        };
      }

      if (USE_POSTGRES) {
        matchedUser = await pgFunctions.getUserByWhatsApp(normalizedPhone);
        if (matchedUser && matchedUser.telegram_chat_id) matchedUser = null;
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

        return {
          reply:
            `⚡ *InvoiceEase Link Status*\n\n` +
            `✅ *Success!* Your Telegram account has been linked to your InvoiceEase profile.\n` +
            `You can now generate professional invoices, quotations, and proformas directly from this chat.\n\n` +
            `✨ Select a command from the menu below to start:`,
          replyMarkup: defaultMenuKeyboard
        };
      } else {
        return {
          reply:
            `❌ *No account found for that phone number, or it's already linked.*\n\n` +
            `Make sure you are sending your actual registered phone number.\n` +
            `Example: /start 9876543210\n\n` +
            `If you haven't created an account yet, sign up at [InvoiceEase website](https://invoiceease.org.in)`,
        };
      }
    } else {
      return {
        reply:
          `👋 *Welcome to InvoiceEase!*\n\n` +
          `To link your Telegram account, send the /start command followed by the phone number you registered with, or just type your phone number.\n\n` +
          `Example: /start 9876543210\n\n` +
          `Need an account? Sign up at [InvoiceEase website](https://invoiceease.org.in)`,
      };
    }
  }

  let conversation = await getConversation(chatId);
  if (!conversation) {
    conversation = await createConversation(user.id, chatId);
  }

  const state = conversation.state;
  let normalizedMsg = userMessage.trim();
  let lowerMessage = normalizedMsg.toLowerCase();

  // Normalize keyboard button inputs to wizard actions
  if (lowerMessage.includes('create invoice') || lowerMessage === '⚡ create invoice') {
    normalizedMsg = '/newinvoice';
    lowerMessage = '/newinvoice';
  } else if (lowerMessage.includes('create quotation') || lowerMessage === '📄 create quotation') {
    normalizedMsg = '/newquotation';
    lowerMessage = '/newquotation';
  } else if (lowerMessage.includes('create proforma') || lowerMessage === '📝 create proforma') {
    normalizedMsg = '/newproforma';
    lowerMessage = '/newproforma';
  } else if (lowerMessage.includes('cancel') || lowerMessage === '❌ cancel') {
    normalizedMsg = '/cancel';
    lowerMessage = '/cancel';
  } else if (lowerMessage.includes('yes, add another') || lowerMessage === '✅ yes, add another') {
    normalizedMsg = 'yes';
    lowerMessage = 'yes';
  } else if (lowerMessage.includes('no, finish items') || lowerMessage === '🛑 no, finish items') {
    normalizedMsg = 'no';
    lowerMessage = 'no';
  }

  if (lowerMessage.endsWith('%')) {
    normalizedMsg = normalizedMsg.replace('%', '');
    lowerMessage = lowerMessage.replace('%', '');
  }

  // Handle cancel command
  if (lowerMessage === '/cancel') {
    await resetConversation(chatId);
    return {
      reply: '❌ *Creation cancelled.* Select an option from the menu below to start again:',
      replyMarkup: defaultMenuKeyboard
    };
  }

  // Handle new document triggers or one-shot command if IDLE/COMPLETED
  if (state === conversationStates.IDLE || state === conversationStates.COMPLETED) {
    if (['/start', '/newinvoice', '/newquotation', '/newproforma', 'hi', 'hello', 'start'].includes(lowerMessage)) {
      await resetConversation(chatId);
      let docType = 'sales_invoice';
      let labelText = 'Invoice';
      if (lowerMessage === '/newquotation') {
        docType = 'quotation';
        labelText = 'Quotation';
      } else if (lowerMessage === '/newproforma') {
        docType = 'proforma';
        labelText = 'Proforma';
      }
      await updateConversationData(chatId, { doc_type: docType, items: [] });
      await updateConversationState(chatId, conversationStates.WAITING_CLIENT_NAME);
      return {
        reply:
          `⚡ *InvoiceEase Document Wizard*\n\n` +
          `Let's create a professional *${labelText}* for your business. I'll guide you step-by-step.\n\n` +
          `👤 *Step 1:* What is the *Client or Company Name*?\n\n` +
          `_You can type /cancel to abort at any time._`,
        replyMarkup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
      };
    }

    // Try parsing as one-shot message
    const oneShot = parseOneShotMessage(userMessage);
    if (oneShot) {
      const userGstRate = user.gstNumber ? 18 : 0;
      const initialData = {
        doc_type: oneShot.docType,
        client_name: oneShot.clientName,
        item_desc: oneShot.description,
        item_qty: 1,
        item_price: oneShot.amount,
        items: [{
          description: oneShot.description,
          quantity: 1,
          unitPrice: oneShot.amount
        }],
        gst_rate: oneShot.docType === 'quotation' ? 0 : userGstRate,
        notes: 'skip',
        template: 'modern',
      };

      if (oneShot.docType === 'quotation') {
        const validDate = new Date();
        validDate.setDate(validDate.getDate() + 30);
        initialData.valid_until = validDate.toISOString().split('T')[0];
      }

      await updateConversationData(chatId, initialData);
      const updatedConv = await getConversation(chatId);
      return await generateInvoice(chatId, updatedConv, baseUrlOverride);
    }

    return {
      reply: `👋 *Welcome back to InvoiceEase!*\n\nSelect a document type to create using the menu below, or send a details string (e.g. _Invoice for Acme Corp, 50000, Website Design_):`,
      replyMarkup: defaultMenuKeyboard
    };
  }

  switch (state) {
    case conversationStates.WAITING_CLIENT_NAME:
      if (!normalizedMsg.trim()) {
        return { 
          reply: '⚠️ *Please enter a valid client name.*',
          replyMarkup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
        };
      }
      await updateConversationData(chatId, { client_name: normalizedMsg.trim() });
      await updateConversationState(chatId, conversationStates.WAITING_ITEM_DESC);
      return {
        reply:
          `⚡ *InvoiceEase Document Wizard*\n` +
          `👤 *Client:* _${normalizedMsg.trim()}_\n` +
          `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
          `📝 *Step 2:* What is the *item or service description*?\n` +
          `_(e.g., Website Development, Consulting Hours)_`,
        replyMarkup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
      };

    case conversationStates.WAITING_ITEM_DESC:
      if (!normalizedMsg.trim()) {
        return { 
          reply: '⚠️ *Please enter a valid item description.*',
          replyMarkup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
        };
      }
      await updateConversationData(chatId, { item_desc: normalizedMsg.trim() });
      await updateConversationState(chatId, conversationStates.WAITING_ITEM_QTY);
      return {
        reply:
          `⚡ *InvoiceEase Document Wizard*\n` +
          `👤 *Client:* _${conversation.data.client_name}_\n` +
          `📝 *Service:* _${normalizedMsg.trim()}_\n` +
          `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
          `🔢 *Step 3:* What is the *quantity*?\n` +
          `_(e.g., 1, 5, 10)_`,
        replyMarkup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
      };

    case conversationStates.WAITING_ITEM_QTY:
      const qty = Number(normalizedMsg.replace(/[^0-9.]/g, ''));
      if (isNaN(qty) || qty <= 0) {
        return { 
          reply: `❌ *Invalid quantity.* Please enter a valid number (e.g. 1).`,
          replyMarkup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
        };
      }
      await updateConversationData(chatId, { item_qty: qty });
      await updateConversationState(chatId, conversationStates.WAITING_ITEM_PRICE);
      return {
        reply:
          `⚡ *InvoiceEase Document Wizard*\n` +
          `👤 *Client:* _${conversation.data.client_name}_\n` +
          `📝 *Service:* _${conversation.data.item_desc}_\n` +
          `🔢 *Quantity:* _${qty}_\n` +
          `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
          `💵 *Step 4:* What is the *unit price* per item (in INR)?\n` +
          `_(e.g., 5000, 25000)_`,
        replyMarkup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
      };

    case conversationStates.WAITING_ITEM_PRICE:
      const price = Number(normalizedMsg.replace(/[^0-9.]/g, ''));
      if (isNaN(price) || price < 0) {
        return { 
          reply: `❌ *Invalid price.* Please enter a valid number.`,
          replyMarkup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
        };
      }
      const currentItems = conversation.data.items || [];
      currentItems.push({
        description: conversation.data.item_desc,
        quantity: conversation.data.item_qty,
        unitPrice: price
      });
      await updateConversationData(chatId, { items: currentItems, item_price: price });
      await updateConversationState(chatId, conversationStates.WAITING_ADD_ANOTHER_ITEM);

      const itemsListText = currentItems.map((item, idx) => `  ${idx + 1}. _${item.description}_ (x${item.quantity}) - ${formatINR(item.unitPrice)}`).join('\n');

      return {
        reply:
          `⚡ *InvoiceEase Document Wizard*\n` +
          `👤 *Client:* _${conversation.data.client_name}_\n` +
          `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
          `📦 *Items Added so far:*\n` +
          `${itemsListText}\n\n` +
          `➕ Do you want to add *another item* to this document?`,
        replyMarkup: yesNoKeyboard
      };

    case conversationStates.WAITING_ADD_ANOTHER_ITEM:
      if (lowerMessage === 'yes') {
        await updateConversationState(chatId, conversationStates.WAITING_ITEM_DESC);
        const currentItems = conversation.data.items || [];
        const itemsListText = currentItems.map((item, idx) => `  ${idx + 1}. _${item.description}_ (x${item.quantity}) - ${formatINR(item.unitPrice)}`).join('\n');
        return {
          reply:
            `⚡ *InvoiceEase Document Wizard*\n` +
            `👤 *Client:* _${conversation.data.client_name}_\n` +
            `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
            `📦 *Items Added so far:*\n` +
            `${itemsListText}\n\n` +
            `📝 What is the description for the *next item*?`,
          replyMarkup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
        };
      } else if (lowerMessage === 'no') {
        const isQuote = conversation.data.doc_type === 'quotation';
        if (isQuote) {
          await updateConversationData(chatId, { gst_rate: 0 });
          await updateConversationState(chatId, conversationStates.WAITING_VALID_UNTIL);
          return {
            reply:
              `⚡ *InvoiceEase Document Wizard*\n` +
              `👤 *Client:* _${conversation.data.client_name}_\n` +
              `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
              `📅 *Step 5:* Please enter the *Validity Date* for this quotation.\n` +
              `Format: *YYYY-MM-DD* (e.g. 2026-06-30)`,
            replyMarkup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
          };
        } else if (user.gstNumber) {
          await updateConversationState(chatId, conversationStates.WAITING_GST_RATE);
          return {
            reply:
              `⚡ *InvoiceEase Document Wizard*\n` +
              `👤 *Client:* _${conversation.data.client_name}_\n` +
              `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
              `📊 *Step 5:* Select or type the *GST Rate* to apply:\n` +
              `Options: *0%*, *5%*, *12%*, *18%*, or *28%*`,
            replyMarkup: gstKeyboard
          };
        } else {
          await updateConversationData(chatId, { gst_rate: 0 });
          await updateConversationState(chatId, conversationStates.WAITING_NOTES);
          return {
            reply:
              `⚡ *InvoiceEase Document Wizard*\n` +
              `👤 *Client:* _${conversation.data.client_name}_\n` +
              `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
              `✍️ *Step 6:* Any *Notes or Payment Terms*?\n` +
              `_(e.g., Pay within 7 days, or type 'skip' if none)_`,
            replyMarkup: { keyboard: [[{ text: 'skip' }], [{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
          };
        }
      } else {
        return { 
          reply: `❌ *Invalid choice.* Please reply with Yes or No using the buttons below.`,
          replyMarkup: yesNoKeyboard
        };
      }

    case conversationStates.WAITING_GST_RATE:
      const rate = Number(normalizedMsg.replace(/[^0-9.]/g, ''));
      if (![0, 5, 12, 18, 28].includes(rate)) {
        return { 
          reply: `❌ *Invalid GST rate.* Please select 0%, 5%, 12%, 18%, or 28% from the buttons below.`,
          replyMarkup: gstKeyboard
        };
      }
      await updateConversationData(chatId, { gst_rate: rate });
      await updateConversationState(chatId, conversationStates.WAITING_NOTES);
      return {
        reply:
          `⚡ *InvoiceEase Document Wizard*\n` +
          `👤 *Client:* _${conversation.data.client_name}_\n` +
          `📊 *GST Rate:* _${rate}%_\n` +
          `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
          `✍️ *Step 6:* Any *Notes or Payment Terms*?\n` +
          `_(e.g., Pay within 7 days, or type 'skip' if none)_`,
        replyMarkup: { keyboard: [[{ text: 'skip' }], [{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
      };

    case conversationStates.WAITING_VALID_UNTIL:
      const dateStr = normalizedMsg.trim();
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateStr)) {
        return { 
          reply: '❌ *Invalid date format.* Please enter the validity date as YYYY-MM-DD (e.g. 2026-06-30).',
          replyMarkup: { keyboard: [[{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
        };
      }
      await updateConversationData(chatId, { valid_until: dateStr });
      await updateConversationState(chatId, conversationStates.WAITING_NOTES);
      return {
        reply:
          `⚡ *InvoiceEase Document Wizard*\n` +
          `👤 *Client:* _${conversation.data.client_name}_\n` +
          `📅 *Validity:* _${dateStr}_\n` +
          `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
          `✍️ *Step 6:* Any *Notes or T&C*?\n` +
          `_(e.g., Delivery in 5 days, or type 'skip' if none)_`,
        replyMarkup: { keyboard: [[{ text: 'skip' }], [{ text: '❌ Cancel' }]], resize_keyboard: true, one_time_keyboard: true }
      };

    case conversationStates.WAITING_NOTES:
      await updateConversationData(chatId, { notes: normalizedMsg.trim() });
      const isPro = user.plan === 'pro' || user.plan === 'business';
      if (!isPro) {
        await updateConversationData(chatId, { template: 'modern' });
        const updatedConv = await getConversation(chatId);
        return await generateInvoice(chatId, updatedConv, baseUrlOverride);
      }

      await updateConversationState(chatId, conversationStates.WAITING_TEMPLATE);
      return {
        reply:
          `⚡ *InvoiceEase Document Wizard*\n` +
          `👤 *Client:* _${conversation.data.client_name}_\n` +
          `📊 *GST Rate:* _${conversation.data.gst_rate}%_\n` +
          `✍️ *Notes:* _${normalizedMsg.trim() === 'skip' ? 'None' : normalizedMsg.trim()}_\n` +
          `*━━━━━━━━━━━━━━━━━━━━━━━━*\n\n` +
          `🎨 *Step 7:* Which *Template Style* do you want?\n` +
          `Options: *modern*, *minimal*, *classic*, *premium*`,
        replyMarkup: templateKeyboard
      };

    case conversationStates.WAITING_TEMPLATE:
      const template = lowerMessage;
      if (!['modern', 'minimal', 'classic', 'premium'].includes(template)) {
        return { 
          reply: `❌ *Invalid template.* Please select modern, minimal, classic, or premium.`,
          replyMarkup: templateKeyboard
        };
      }
      await updateConversationData(chatId, { template });
      const updatedConv = await getConversation(chatId);
      return await generateInvoice(chatId, updatedConv, baseUrlOverride);

    default:
      return {
        reply: `👋 *Welcome back to InvoiceEase!*\n\nSelect a document type to create using the menu below:`,
        replyMarkup: defaultMenuKeyboard
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
