const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const db = require('../db');

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

  const allowed = ['businessName', 'gstNumber', 'panNumber', 'address', 'city', 'pincode', 'bankName', 'accountNumber', 'ifscCode', 'upiId', 'whatsapp'];
  allowed.forEach(field => {
    if (req.body[field] !== undefined) user[field] = req.body[field];
  });

  const { passwordHash: _, ...userSafe } = user;
  res.json({ user: userSafe, message: 'Profile updated' });
});

module.exports = router;
