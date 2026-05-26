const Razorpay = require('razorpay');

let razorpayInstance = null;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  try {
    razorpayInstance = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  } catch (err) {
    console.error('Failed to initialize Razorpay:', err.message);
  }
}

const createPaymentLink = async (invoice) => {
  const amountInPaise = Math.round(Number(invoice.totalAmount || invoice.amount || 0) * 100);
  if (amountInPaise <= 0) {
    throw new Error('Invoice amount must be greater than zero');
  }

  if (!razorpayInstance) {
    console.warn('⚠️ Razorpay credentials missing. Generating fallback simulation payment link.');
    const invoiceId = invoice.id;
    return `https://checkout.razorpay.com/simulated?invoice=${invoiceId}&amount=${amountInPaise / 100}`;
  }

  try {
    const response = await razorpayInstance.paymentLink.create({
      amount: amountInPaise,
      currency: 'INR',
      accept_partial: false,
      description: `Payment for Invoice #${invoice.invoiceNumber || 'INV-XXX'} - ${invoice.service || 'Services'}`,
      customer: {
        name: invoice.clientName || 'Valued Customer',
        contact: invoice.clientMobile || undefined,
        email: invoice.clientEmail || undefined,
      },
      notify: {
        sms: false,
        email: false,
      },
      reminder_enable: false,
      notes: {
        invoiceId: invoice.id,
      },
      callback_url: `${process.env.BASE_URL || 'http://localhost:5000'}/api/payments/callback`,
      callback_method: 'get',
    });
    return response.short_url;
  } catch (err) {
    console.error('Razorpay payment link creation failed:', err);
    return `https://checkout.razorpay.com/simulated?invoice=${invoice.id}&amount=${amountInPaise / 100}`;
  }
};

module.exports = {
  createPaymentLink,
};
