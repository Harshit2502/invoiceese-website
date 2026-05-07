const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const authMiddleware = require('../middleware/auth');
const db = require('../db');

const router = express.Router();
router.use(authMiddleware);

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

router.post('/razorpay/subscription-order', async (req, res) => {
  try {
    const razorpay = getRazorpayClient();
    if (!razorpay) return res.status(500).json({ error: 'Razorpay is not configured on server' });

    const { planName, isYearly } = req.body;
    let planId;
    if (planName === 'pro') {
      planId = isYearly ? process.env.RAZORPAY_PRO_YEARLY_PLAN_ID : process.env.RAZORPAY_PRO_MONTHLY_PLAN_ID;
    } else if (planName === 'business') {
      planId = isYearly ? process.env.RAZORPAY_BUSINESS_YEARLY_PLAN_ID : process.env.RAZORPAY_BUSINESS_MONTHLY_PLAN_ID;
    }

    if (!planId) {
      return res.status(500).json({ error: `Please configure RAZORPAY_${planName.toUpperCase()}_${isYearly ? 'YEARLY' : 'MONTHLY'}_PLAN_ID in your .env file.` });
    }

    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      customer_notify: 1,
      total_count: isYearly ? 10 : 120, // yearly: 10 years, monthly: 120 months (10 years)
      notes: {
        userId: req.userId,
        planName,
        isYearly: isYearly ? 'true' : 'false'
      }
    });

    res.json({
      key: process.env.RAZORPAY_KEY_ID,
      subscription_id: subscription.id,
      planName,
    });
  } catch (error) {
    console.error('Razorpay subscription create failed:', error);
    res.status(500).json({ error: error.message || 'Failed to create subscription' });
  }
});

router.post('/razorpay/subscription-verify', async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, planName } = req.body;

    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature || !planName) {
      return res.status(400).json({ error: 'Missing payment verification fields' });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) return res.status(500).json({ error: 'Razorpay is not configured' });

    const body = `${razorpay_payment_id}|${razorpay_subscription_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    let user = null;
    let userEmail = '';
    let businessName = '';
    if (process.env.USE_POSTGRES === 'true') {
      const pgFunctions = require('../db-postgres');
      const fullUser = await pgFunctions.getUserById(req.userId);
      userEmail = fullUser?.email || '';
      businessName = fullUser?.businessName || '';
      user = await pgFunctions.updateUser(req.userId, { plan: planName });
    } else {
      user = db.users.find(u => u.id === req.userId);
      if (user) {
        user.plan = planName;
        userEmail = user.email;
        businessName = user.businessName;
      }
    }

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Send upgrade email in background
    if (userEmail) {
      const { sendPlanUpgradeEmail } = require('../services/email');
      sendPlanUpgradeEmail(userEmail, businessName, planName)
        .catch(err => console.error('Upgrade email failed:', err));
    }

    res.json({ message: 'Subscription successful', plan: planName });
  } catch (error) {
    console.error('Razorpay verify failed:', error);
    res.status(500).json({ error: 'Failed to verify subscription' });
  }
});

module.exports = router;
