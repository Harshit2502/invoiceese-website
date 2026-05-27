const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const db = require('../db'); // in-memory fallback

router.use(authenticateToken);

// GET /api/gst/filing-status
router.get('/filing-status', async (req, res) => {
  if (process.env.USE_POSTGRES !== 'true') {
    if (!db.gstrFilingStatus) db.gstrFilingStatus = [];
    const statuses = db.gstrFilingStatus.filter(s => s.userId === req.userId);
    return res.json({ statuses });
  }

  try {
    const pgFunctions = require('../db-postgres');
    const statuses = await pgFunctions.getGstrFilingStatuses(req.userId);
    res.json({ statuses });
  } catch (error) {
    console.error('Error fetching GSTR filing status:', error);
    res.status(500).json({ error: 'Failed to fetch filing status' });
  }
});

// POST /api/gst/filing-status
router.post('/filing-status', async (req, res) => {
  const { filingMonth, arn, status } = req.body;
  if (!filingMonth) {
    return res.status(400).json({ error: 'filingMonth is required' });
  }

  if (process.env.USE_POSTGRES !== 'true') {
    if (!db.gstrFilingStatus) db.gstrFilingStatus = [];
    const existingIndex = db.gstrFilingStatus.findIndex(s => s.userId === req.userId && s.filingMonth === filingMonth);
    const filingRecord = {
      id: existingIndex >= 0 ? db.gstrFilingStatus[existingIndex].id : require('uuid').v4(),
      userId: req.userId,
      filingMonth,
      arn: arn || null,
      status: status || 'filed',
      filedAt: new Date().toISOString()
    };
    if (existingIndex >= 0) {
      db.gstrFilingStatus[existingIndex] = filingRecord;
    } else {
      db.gstrFilingStatus.push(filingRecord);
    }
    return res.json({ filingStatus: filingRecord, message: 'Filing status updated successfully' });
  }

  try {
    const pgFunctions = require('../db-postgres');
    const filingRecord = await pgFunctions.upsertGstrFilingStatus(req.userId, { filingMonth, arn, status });
    res.json({ filingStatus: filingRecord, message: 'Filing status updated successfully' });
  } catch (error) {
    console.error('Error updating GSTR filing status:', error);
    res.status(500).json({ error: 'Failed to update filing status' });
  }
});

module.exports = router;
