const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'invoiceease_secret_key_2026';

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, whatsapp, password, businessName, gstNumber, panNumber, address, city, pincode, bankName, accountNumber, ifscCode, upiId } = req.body;

    if (!email || !password || !businessName || !whatsapp) {
      return res.status(400).json({ error: 'Email, WhatsApp, password, and business name are required' });
    }

    const existing = db.users.find(u => u.email === email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      email, whatsapp, passwordHash, businessName,
      gstNumber: gstNumber || '', panNumber: panNumber || '',
      address: address || '', city: city || '', pincode: pincode || '',
      bankName: bankName || '', accountNumber: accountNumber || '',
      ifscCode: ifscCode || '', upiId: upiId || '',
      plan: 'free', invoicesThisMonth: 0,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);

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

    const user = db.users.find(u => u.email === email);
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
router.get('/me', require('../middleware/auth'), (req, res) => {
  const user = db.users.find(u => u.id === req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash: _, ...userSafe } = user;
  res.json({ user: userSafe });
});

module.exports = router;
