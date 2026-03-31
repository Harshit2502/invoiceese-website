const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'invoiceease_secret_key_2026';

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};
