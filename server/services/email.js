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
      to: [userEmail], // In a real app, this might be the client's email. For now, sending to user for verification
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

module.exports = {
  sendInvoiceEmail
};
