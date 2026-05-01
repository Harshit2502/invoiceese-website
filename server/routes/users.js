const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const db = require('../db');
const { normalizeWhatsAppNumber } = require('../utils/whatsapp');
const { getSupabaseClient } = require('../utils/supabase');
const path = require('path');

// Helper: upload base64 dataURL to Supabase Storage and return public URL
async function uploadDataUrlToSupabase(bucket, destPath, dataUrl) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  }
  const matches = dataUrl.match(/^data:(.+);base64,(.*)$/);
  if (!matches) throw new Error('Invalid data URL');
  const contentType = matches[1];
  const b64 = matches[2];
  const buffer = Buffer.from(b64, 'base64');

  const { error } = await supabase.storage.from(bucket).upload(destPath, buffer, {
    contentType,
    upsert: true
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(destPath);
  return data.publicUrl;
}

router.use(authMiddleware);

// POST /api/users/upload-logo
router.post('/upload-logo', async (req, res) => {
  let user = null;
  if (process.env.USE_POSTGRES === 'true') {
    const pgFunctions = require('../db-postgres');
    user = await pgFunctions.getUserById(req.userId);
  } else {
    user = db.users.find(u => u.id === req.userId);
  }
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { dataUrl, fileName } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'public';
  const safeName = (fileName || 'logo.png').replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const destPath = path.posix.join('logos', `${user.id}-${Date.now()}-${safeName}`);

  try {
    const publicUrl = await uploadDataUrlToSupabase(bucket, destPath, dataUrl);
    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      await pgFunctions.updateUser(user.id, { logoUrl: publicUrl });
    }
    user.logoUrl = publicUrl;
    const { passwordHash: _, ...userSafe } = user;
    res.json({ user: userSafe, logoUrl: publicUrl });
  } catch (err) {
    console.error('Error uploading logo to Supabase:', err.message || err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// GET /api/users/profile
router.get('/profile', async (req, res) => {
  let user = null;
  if (process.env.USE_POSTGRES === 'true') {
    const pgFunctions = require('../db-postgres');
    user = await pgFunctions.getUserById(req.userId);
  } else {
    user = db.users.find(u => u.id === req.userId);
  }
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash: _, ...userSafe } = user;
  res.json({ user: userSafe });
});

// PATCH /api/users/profile
router.patch('/profile', async (req, res) => {
  let user = null;
  if (process.env.USE_POSTGRES === 'true') {
    const pgFunctions = require('../db-postgres');
    user = await pgFunctions.getUserById(req.userId);
  } else {
    user = db.users.find(u => u.id === req.userId);
  }
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (req.body.whatsapp !== undefined) {
    const normalizedWhatsApp = normalizeWhatsAppNumber(req.body.whatsapp);
    if (!normalizedWhatsApp) {
      return res.status(400).json({ error: 'Phone number is invalid' });
    }
    let exists = null;
    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      const waUser = await pgFunctions.getUserByWhatsApp(normalizedWhatsApp);
      if (waUser && waUser.id !== req.userId) exists = waUser;
    } else {
      exists = db.users.find(u => u.id !== req.userId && normalizeWhatsAppNumber(u.whatsapp) === normalizedWhatsApp);
    }
    if (exists) {
      return res.status(409).json({ error: 'Phone number already in use' });
    }
    req.body.whatsapp = normalizedWhatsApp;
  }

  const allowed = ['businessName', 'gstNumber', 'panNumber', 'address', 'city', 'pincode', 'bankName', 'accountNumber', 'ifscCode', 'upiId', 'whatsapp', 'logoUrl', 'templateStyle', 'showWatermark'];
  
  if (process.env.USE_POSTGRES === 'true') {
    const pgFunctions = require('../db-postgres');
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    if (user.plan === 'free') updates.showWatermark = true;
    if (Object.keys(updates).length > 0) {
      await pgFunctions.updateUser(user.id, updates);
      Object.assign(user, updates);
    }
  } else {
    allowed.forEach(field => {
      if (req.body[field] !== undefined) user[field] = req.body[field];
    });
    if (user.plan === 'free') {
      user.showWatermark = true;
    }
  }

  const { passwordHash: _, ...userSafe } = user;
  res.json({ user: userSafe, message: 'Profile updated' });
});

// POST /api/users/settings - update premium settings
router.post('/settings', async (req, res) => {
  let user = null;
  if (process.env.USE_POSTGRES === 'true') {
    const pgFunctions = require('../db-postgres');
    user = await pgFunctions.getUserById(req.userId);
  } else {
    user = db.users.find(u => u.id === req.userId);
  }
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { templateStyle, showWatermark } = req.body;

  // Pro/Business plan allows all templates
  if (templateStyle && ['modern', 'minimal', 'classic', 'premium'].includes(templateStyle)) {
    user.templateStyle = templateStyle;
  }

  // Only Pro+ plans can remove watermark
  if (showWatermark !== undefined && user.plan !== 'free') {
    user.showWatermark = showWatermark;
  }

  if (process.env.USE_POSTGRES === 'true') {
    const pgFunctions = require('../db-postgres');
    await pgFunctions.updateUser(user.id, { templateStyle: user.templateStyle, showWatermark: user.showWatermark });
  }

  const { passwordHash: _, ...userSafe } = user;
  res.json({ user: userSafe, message: 'Settings updated' });
});

module.exports = router;
