// Script to create updated Razorpay yearly plans
const Razorpay = require('razorpay');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const plans = [
  {
    name: 'Pro Yearly',
    envKey: 'RAZORPAY_PRO_YEARLY_PLAN_ID',
    period: 'yearly',
    interval: 1,
    amount: 226800, // ₹189/mo × 12 = ₹2268 in paise
  },
  {
    name: 'Business Yearly',
    envKey: 'RAZORPAY_BUSINESS_YEARLY_PLAN_ID',
    period: 'yearly',
    interval: 1,
    amount: 562800, // ₹469/mo × 12 = ₹5628 in paise
  },
];

async function createPlans() {
  console.log('🚀 Creating updated yearly plans...\n');
  for (const plan of plans) {
    try {
      const created = await razorpay.plans.create({
        period: plan.period,
        interval: plan.interval,
        item: {
          name: `InvoiceEase ${plan.name}`,
          amount: plan.amount,
          currency: 'INR',
          description: `InvoiceEase ${plan.name} Plan`,
        },
      });
      console.log(`✅ ${plan.name}: ${created.id}  (₹${plan.amount / 100}/yr = ₹${plan.amount / 100 / 12}/mo)`);
      console.log(`${plan.envKey}=${created.id}`);
    } catch (err) {
      console.error(`❌ ${plan.name}:`, err.error?.description || err.message);
    }
  }
}

createPlans();
