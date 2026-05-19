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
      return res.status(400).json({ error: 'Email, Phone number, password, and business name are required' });
    }

    let existing = null;
    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      existing = await pgFunctions.getUserByEmail(normalizedEmail) || await pgFunctions.getUserByWhatsApp(normalizedWhatsApp);
    } else {
      existing = db.users.find(u => u.email === normalizedEmail || normalizeWhatsAppNumber(u.whatsapp) === normalizedWhatsApp);
    }
    if (existing) return res.status(409).json({ error: 'Email or Phone number already registered' });

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

    // Send welcome email in background
    const { sendWelcomeEmail } = require('../services/email');
    sendWelcomeEmail(normalizedEmail, businessName)
      .catch(err => console.error('Welcome email failed:', err));

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
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login', details: err.message });
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

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const normalizedEmail = String(email).trim().toLowerCase();

    let user = null;
    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      user = await pgFunctions.getUserByEmail(normalizedEmail);
    } else {
      user = db.users.find(u => u.email === normalizedEmail);
    }

    // Always return success to prevent email enumeration attacks
    if (!user) {
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    // Create a reset token (JWT with 1 hour expiry and purpose claim)
    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;

    const { sendPasswordResetEmail } = require('../services/email');
    await sendPasswordResetEmail(normalizedEmail, resetUrl);

    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    let user = null;
    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      user = await pgFunctions.getUserById(decoded.userId);
    } else {
      user = db.users.find(u => u.id === decoded.userId);
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newPasswordHash = await bcrypt.hash(password, 10);

    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      await pgFunctions.updateUserPassword(user.id, newPasswordHash);
    } else {
      user.passwordHash = newPasswordHash;
    }

    // Issue a login token so user is logged in immediately
    const loginToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const { passwordHash: _, ...userSafe } = user;

    res.json({ token: loginToken, user: userSafe, message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
