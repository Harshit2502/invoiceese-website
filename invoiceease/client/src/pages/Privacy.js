import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './LegalPages.css';

export default function Privacy() {
  return (
    <div>
      <Navbar />
      <section className="legal-hero">
        <div className="container">
          <h1 className="gradient-text">Privacy Policy</h1>
          <p>Last updated: March 29, 2026</p>
        </div>
      </section>
      <div className="container legal-body">
        <div className="legal-card">
          <p>At InvoiceEase, we take your privacy seriously. This Privacy Policy explains how we collect, use, store, and protect your personal information.</p>

          <div className="legal-highlight">
            <strong>TL;DR:</strong> We collect only the data needed to provide the service. We don't sell your data. We use encryption to keep it safe. You can delete your account anytime.
          </div>

          <h2>1. Information We Collect</h2>
          <h3>Account Information</h3>
          <p>Email address, WhatsApp number, hashed password, and profile details you provide during signup.</p>
          <h3>Business Information</h3>
          <p>Business name, GST number, PAN number, address, and bank details you provide for invoice generation.</p>
          <h3>Invoice Data</h3>
          <p>Client names, amounts, service descriptions, and other invoice details you provide.</p>
          <h3>Usage Data</h3>
          <p>How you use the service, including pages visited, features used, and timestamps.</p>

          <h2>2. How We Use Your Information</h2>
          <p>We use your information to provide and improve the InvoiceEase service, generate invoices on your behalf, send account-related notifications, provide customer support, detect and prevent fraud, and comply with legal obligations.</p>

          <h2>3. WhatsApp Messages</h2>
          <p>When you send invoice requests via WhatsApp, your messages are processed by our AI to extract invoice details. Messages are deleted from our servers within 24 hours of processing. We do not store your WhatsApp conversation history.</p>

          <h2>4. Data Storage and Security</h2>
          <p>Your data is stored on secure cloud servers with industry-standard 256-bit SSL encryption. We implement access controls, regular security audits, and follow data minimisation principles. Invoice PDFs are stored for the duration of your plan (7 days on Free, lifetime on paid plans).</p>

          <h2>5. Third-Party Services</h2>
          <p>InvoiceEase integrates with: <strong>Razorpay</strong> for payment processing, <strong>WhatsApp/Gupshup</strong> for message delivery, <strong>AWS/Cloudflare</strong> for cloud hosting and file storage, and <strong>OpenAI</strong> for invoice parsing (only invoice text is sent, not your business details). Each has their own privacy policy.</p>

          <h2>6. Your Rights</h2>
          <p>You have the right to access all personal data we hold about you, correct inaccurate data, download your data in a portable format (CSV/JSON), delete your account and all associated data, opt out of marketing communications, and withdraw consent at any time.</p>
          <p>To exercise these rights, email us at privacy@invoiceease.in.</p>

          <h2>7. Data Retention</h2>
          <p>We retain your account data while your account is active. On Free plan: invoices stored for 7 days. On paid plans: invoices stored indefinitely. After account deletion, we delete all personal data within 30 days.</p>

          <h2>8. Children's Privacy</h2>
          <p>InvoiceEase is not intended for users under 18. We do not knowingly collect information from children. If you believe we've collected data from a child, contact us immediately.</p>

          <h2>9. Changes to This Policy</h2>
          <p>We may update this Privacy Policy periodically. We'll notify you of material changes via email or in-app notification. Continued use after changes constitutes acceptance.</p>

          <h2>10. Contact Us</h2>
          <p><strong>Email:</strong> privacy@invoiceease.in<br /><strong>Address:</strong> InvoiceEase, Mumbai, Maharashtra, India</p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
