const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const db = require('../db');
const { normalizeWhatsAppNumber } = require('../utils/whatsapp');

router.use(authMiddleware);

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
