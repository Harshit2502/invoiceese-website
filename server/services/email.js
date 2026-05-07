const { Resend } = require('resend');
const fs = require('fs');
const path = require('path');

const resend = new Resend(process.env.RESEND_API_KEY);

// Domain that you'll verify in Resend (e.g., invoiceease.org.in)
// For testing without verification, use the onboarding domain from Resend dashboard if needed.
const FROM_EMAIL = 'InvoiceEase <hello@invoiceease.org.in>';

const sendInvoiceEmail = async (userEmail, clientName, invoice, pdfPath) => {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your_resend_api_key_here') {
    console.warn('⚠️ RESEND_API_KEY not configured. Email not sent.');
    return { success: false, error: 'Resend API key not configured' };
  }

  try {
    let attachments = [];
    if (pdfPath && fs.existsSync(pdfPath)) {
      const pdfContent = fs.readFileSync(pdfPath);
      attachments.push({
        filename: `${invoice.invoiceNumber}.pdf`,
        content: pdfContent,
      });
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [userEmail],
      subject: `Your Invoice ${invoice.invoiceNumber} is ready`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Invoice Created Successfully</h2>
          <p>Hi,</p>
          <p>Your invoice for <strong>${clientName}</strong> has been generated.</p>
          <ul>
            <li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
            <li><strong>Amount:</strong> ₹${invoice.totalAmount || invoice.total}</li>
            <li><strong>Status:</strong> ${invoice.status}</li>
          </ul>
          <p>You can find the PDF attached to this email.</p>
          <br/>
          <p>Best regards,<br/>The InvoiceEase Team</p>
        </div>
      `,
      attachments,
    });

    if (error) {
      console.error('Resend email error:', error);
      return { success: false, error };
    }

    console.log('✅ Invoice email sent successfully:', data.id);
    return { success: true, data };
  } catch (err) {
    console.error('Failed to send invoice email:', err);
    return { success: false, error: err.message };
  }
};

const sendPasswordResetEmail = async (userEmail, resetUrl) => {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'your_resend_api_key_here') {
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
  sendInvoiceEmail,
  sendPasswordResetEmail,
};
