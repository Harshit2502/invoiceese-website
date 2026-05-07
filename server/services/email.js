const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = 'InvoiceEase <hello@invoiceease.org.in>';

const isConfigured = () => {
  return process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 'your_resend_api_key_here';
};

// --- Welcome Email (on signup) ---
const sendWelcomeEmail = async (userEmail, businessName) => {
  if (!isConfigured()) {
    console.warn('⚠️ RESEND_API_KEY not configured. Welcome email not sent.');
    return { success: false, error: 'Resend API key not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [userEmail],
      subject: `Welcome to InvoiceEase, ${businessName}! 🎉`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #0f6e56 0%, #14b88e 100%); padding: 36px; text-align: center;">
            <div style="display: inline-block; background: rgba(255,255,255,0.2); border-radius: 10px; width: 52px; height: 52px; line-height: 52px; font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 14px;">IE</div>
            <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Welcome to InvoiceEase!</h1>
          </div>
          <div style="padding: 36px;">
            <p style="color: #374151; font-size: 15px; line-height: 1.7;">Hi <strong>${businessName}</strong>,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.7;">Your account is all set! Here's what you can do:</p>
            <div style="background: #f0fdf4; border-radius: 10px; padding: 20px; margin: 20px 0;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #166534;"><strong>✅ Create GST-compliant invoices</strong> — via Dashboard or Telegram</p>
              <p style="margin: 0 0 10px; font-size: 14px; color: #166534;"><strong>✅ Generate professional PDFs</strong> — 4 beautiful templates</p>
              <p style="margin: 0 0 10px; font-size: 14px; color: #166534;"><strong>✅ Track payments</strong> — mark invoices as paid/unpaid</p>
              <p style="margin: 0; font-size: 14px; color: #166534;"><strong>✅ Telegram Bot</strong> — create invoices in 30 seconds via chat</p>
            </div>
            <div style="text-align: center; margin: 28px 0;">
              <a href="https://invoiceease.org.in/dashboard" style="display: inline-block; background: linear-gradient(135deg, #0f6e56, #14b88e); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600;">Go to Dashboard →</a>
            </div>
            <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">You're on the <strong>Free plan</strong> (5 invoices/month). Upgrade to Pro anytime for unlimited invoices, premium templates, and more.</p>
          </div>
          <div style="background: #f9fafb; padding: 18px 36px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} InvoiceEase. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend welcome email error:', error);
      return { success: false, error };
    }

    console.log('✅ Welcome email sent:', data.id);
    return { success: true, data };
  } catch (err) {
    console.error('Failed to send welcome email:', err);
    return { success: false, error: err.message };
  }
};

// --- Plan Upgrade Email (on Pro/Business purchase) ---
const sendPlanUpgradeEmail = async (userEmail, businessName, planName) => {
  if (!isConfigured()) {
    console.warn('⚠️ RESEND_API_KEY not configured. Upgrade email not sent.');
    return { success: false, error: 'Resend API key not configured' };
  }

  const planLabel = planName.charAt(0).toUpperCase() + planName.slice(1);
  const features = planName === 'business'
    ? [
        'Everything in Pro',
        '5 team members',
        'Multi-business support',
        'Expense tracking',
        'Advanced analytics',
        'API access',
        'Dedicated support',
      ]
    : [
        'Unlimited invoices',
        '3 premium templates',
        'Lifetime storage',
        'Custom logo support',
        'Remove watermark',
        'Payment tracking',
        'Priority email support',
      ];

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [userEmail],
      subject: `You're now on the ${planLabel} plan! 🚀`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #0f6e56 0%, #14b88e 100%); padding: 36px; text-align: center;">
            <div style="font-size: 40px; margin-bottom: 10px;">🚀</div>
            <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Welcome to ${planLabel}!</h1>
          </div>
          <div style="padding: 36px;">
            <p style="color: #374151; font-size: 15px; line-height: 1.7;">Hi <strong>${businessName}</strong>,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.7;">Thank you for upgrading! Your <strong>${planLabel}</strong> plan is now active. Here's what you've unlocked:</p>
            <div style="background: #f0fdf4; border-radius: 10px; padding: 20px; margin: 20px 0;">
              ${features.map(f => `<p style="margin: 0 0 8px; font-size: 14px; color: #166534;">✅ ${f}</p>`).join('')}
            </div>
            <div style="text-align: center; margin: 28px 0;">
              <a href="https://invoiceease.org.in/dashboard" style="display: inline-block; background: linear-gradient(135deg, #0f6e56, #14b88e); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600;">Start Creating →</a>
            </div>
            <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">Your subscription is managed via Razorpay. You can cancel or change plans anytime from your dashboard.</p>
          </div>
          <div style="background: #f9fafb; padding: 18px 36px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} InvoiceEase. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend upgrade email error:', error);
      return { success: false, error };
    }

    console.log('✅ Plan upgrade email sent:', data.id);
    return { success: true, data };
  } catch (err) {
    console.error('Failed to send upgrade email:', err);
    return { success: false, error: err.message };
  }
};

// --- Password Reset Email ---
const sendPasswordResetEmail = async (userEmail, resetUrl) => {
  if (!isConfigured()) {
    console.warn('⚠️ RESEND_API_KEY not configured. Password reset email not sent.');
    return { success: false, error: 'Resend API key not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [userEmail],
      subject: 'Reset your InvoiceEase password',
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
          <div style="background: linear-gradient(135deg, #0f6e56 0%, #14b88e 100%); padding: 32px 36px; text-align: center;">
            <div style="display: inline-block; background: rgba(255,255,255,0.2); border-radius: 10px; width: 48px; height: 48px; line-height: 48px; font-size: 20px; font-weight: 700; color: #fff; margin-bottom: 12px;">IE</div>
            <h1 style="color: #ffffff; font-size: 22px; margin: 0;">Password Reset</h1>
          </div>
          <div style="padding: 36px;">
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hi,</p>
            <p style="color: #374151; font-size: 15px; line-height: 1.6;">We received a request to reset your password. Click the button below to create a new one:</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #0f6e56, #14b88e); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 15px; font-weight: 600; letter-spacing: 0.3px;">Reset My Password</a>
            </div>
            <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
            <p style="color: #9ca3af; font-size: 12px;">If the button doesn't work, copy and paste this URL:<br/><a href="${resetUrl}" style="color: #0f6e56; word-break: break-all;">${resetUrl}</a></p>
          </div>
          <div style="background: #f9fafb; padding: 18px 36px; text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} InvoiceEase. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend password reset email error:', error);
      return { success: false, error };
    }

    console.log('✅ Password reset email sent:', data.id);
    return { success: true, data };
  } catch (err) {
    console.error('Failed to send password reset email:', err);
    return { success: false, error: err.message };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendPlanUpgradeEmail,
  sendPasswordResetEmail,
};
