const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const db = require('../db');
const { normalizeWhatsAppNumber } = require('../utils/whatsapp');
const supabase = require('../utils/supabase');
const path = require('path');

// Helper: upload base64 dataURL to Supabase Storage and return public URL
async function uploadDataUrlToSupabase(bucket, destPath, dataUrl) {
  if (!supabase) throw new Error('Supabase client not configured');
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
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { dataUrl, fileName } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'dataUrl required' });

  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'public';
  const safeName = (fileName || 'logo.png').replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const destPath = path.posix.join('logos', `${user.id}-${Date.now()}-${safeName}`);

  try {
    const publicUrl = await uploadDataUrlToSupabase(bucket, destPath, dataUrl);
    user.logoUrl = publicUrl;
    const { passwordHash: _, ...userSafe } = user;
    res.json({ user: userSafe, logoUrl: publicUrl });
  } catch (err) {
    console.error('Error uploading logo to Supabase:', err.message || err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
});

// GET /api/users/profile
router.get('/profile', (req, res) => {
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash: _, ...userSafe } = user;
  res.json({ user: userSafe });
});

// PATCH /api/users/profile
router.patch('/profile', (req, res) => {
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (req.body.whatsapp !== undefined) {
    const normalizedWhatsApp = normalizeWhatsAppNumber(req.body.whatsapp);
    if (!normalizedWhatsApp) {
      return res.status(400).json({ error: 'WhatsApp number is invalid' });
    }
    const exists = db.users.find(u => u.id !== req.userId && normalizeWhatsAppNumber(u.whatsapp) === normalizedWhatsApp);
    if (exists) {
      return res.status(409).json({ error: 'WhatsApp number already in use' });
    }
    req.body.whatsapp = normalizedWhatsApp;
  }

  const allowed = ['businessName', 'gstNumber', 'panNumber', 'address', 'city', 'pincode', 'bankName', 'accountNumber', 'ifscCode', 'upiId', 'whatsapp', 'logoUrl', 'templateStyle', 'showWatermark'];
  allowed.forEach(field => {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  });

  // Validate premium features based on plan
  if (user.plan === 'free') {
    user.showWatermark = true; // Force watermark on free plan
    // user.templateStyle = 'modern'; // Only modern template for free
  }

  const { passwordHash: _, ...userSafe } = user;
  res.json({ user: userSafe, message: 'Profile updated' });
});

// POST /api/users/settings - update premium settings
router.post('/settings', (req, res) => {
  const user = db.users.find(u => u.id === req.userId);
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

  const { passwordHash: _, ...userSafe } = user;
  res.json({ user: userSafe, message: 'Settings updated' });
});

module.exports = router;
