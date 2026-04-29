const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { normalizeWhatsAppNumber } = require('../utils/whatsapp');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.warn('⚠️ WARNING: JWT_SECRET environment variable is missing!');
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, whatsapp, password, businessName, gstNumber, panNumber, address, city, pincode, bankName, accountNumber, ifscCode, upiId } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedWhatsApp = normalizeWhatsAppNumber(whatsapp);

    if (!normalizedEmail || !password || !businessName || !normalizedWhatsApp) {
      return res.status(400).json({ error: 'Email, WhatsApp, password, and business name are required' });
    }

    let existing = null;
    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      existing = await pgFunctions.getUserByEmail(normalizedEmail) || await pgFunctions.getUserByWhatsApp(normalizedWhatsApp);
    } else {
      existing = db.users.find(u => u.email === normalizedEmail || normalizeWhatsAppNumber(u.whatsapp) === normalizedWhatsApp);
    }
    if (existing) return res.status(409).json({ error: 'Email or WhatsApp already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      email: normalizedEmail, whatsapp: normalizedWhatsApp, passwordHash, businessName,
      gstNumber: gstNumber || '', panNumber: panNumber || '',
      address: address || '', city: city || '', pincode: pincode || '',
      bankName: bankName || '', accountNumber: accountNumber || '',
      ifscCode: ifscCode || '', upiId: upiId || '',
      plan: 'free', invoicesThisMonth: 0,
      logoUrl: '', templateStyle: 'modern',
      showWatermark: true, hasCustomLogo: false,
      createdAt: new Date().toISOString(),
    };

    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      await pgFunctions.createUser(newUser);
    } else {
      db.users.push(newUser);
    }

    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
    const { passwordHash: _, ...userSafe } = newUser;

    res.status(201).json({ token, user: userSafe, message: 'Account created successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const normalizedLogin = String(email || '').trim().toLowerCase();
    const normalizedWhatsApp = normalizeWhatsAppNumber(email);

    let user = null;
    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      user = await pgFunctions.getUserByEmail(normalizedLogin) || await pgFunctions.getUserByWhatsApp(normalizedWhatsApp);
    } else {
      user = db.users.find(u => u.email === normalizedLogin || normalizeWhatsAppNumber(u.whatsapp) === normalizedWhatsApp);
    }
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const { passwordHash: _, ...userSafe } = user;

    res.json({ token, user: userSafe });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), async (req, res) => {
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

module.exports = router;
