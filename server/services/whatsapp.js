const fetch = require('node-fetch');
const { normalizeWhatsAppNumber } = require('../utils/whatsapp');

const WHATSAPP_PROVIDER = (process.env.WHATSAPP_PROVIDER || 'meta').toLowerCase();

// Meta Cloud API config
const META_WHATSAPP_TOKEN = process.env.WHATSAPP_API_KEY || process.env.WHATSAPP_ACCESS_TOKEN;
const META_WHATSAPP_PHONE_NUMBER_ID = process.env.META_WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_NUMBER_ID;

// Gupshup config
const GUPSHUP_API_KEY = process.env.GUPSHUP_API_KEY;
const GUPSHUP_APP_NAME = process.env.GUPSHUP_APP_NAME;
const GUPSHUP_SOURCE_NUMBER = normalizeWhatsAppNumber(process.env.GUPSHUP_SOURCE_NUMBER || '');

const isMetaConfigured = () => Boolean(META_WHATSAPP_TOKEN && META_WHATSAPP_PHONE_NUMBER_ID);
const isGupshupConfigured = () => Boolean(GUPSHUP_API_KEY && GUPSHUP_SOURCE_NUMBER);
const isProviderConfigured = () => (WHATSAPP_PROVIDER === 'gupshup' ? isGupshupConfigured() : isMetaConfigured());

const sendMetaWhatsAppMessage = async (to, text) => {
  const normalizedTo = normalizeWhatsAppNumber(to);
  if (!isMetaConfigured()) {
    console.warn('Meta WhatsApp is not configured: message not sent');
    return false;
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
      return false;
    }
    return true;
  } catch (err) {
    console.error('Meta WhatsApp message failed:', err);
    return false;
  }
};

const sendGupshupWhatsAppMessage = async (to, text) => {
  const normalizedTo = normalizeWhatsAppNumber(to);
  if (!isGupshupConfigured()) {
    console.warn('Gupshup is not configured: message not sent');
    return false;
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
      return false;
    }
    return true;
  } catch (err) {
    console.error('Gupshup message failed:', err);
    return false;
  }
};

const sendWhatsAppMessage = async (to, text) => {
  if (WHATSAPP_PROVIDER === 'gupshup') {
    return sendGupshupWhatsAppMessage(to, text);
  }
  return sendMetaWhatsAppMessage(to, text);
};

module.exports = {
  sendWhatsAppMessage,
  isProviderConfigured,
  isMetaConfigured,
  isGupshupConfigured,
  WHATSAPP_PROVIDER
};
