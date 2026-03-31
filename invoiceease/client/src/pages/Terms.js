import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './LegalPages.css';

export default function Terms() {
  return (
    <div>
      <Navbar />
      <section className="legal-hero">
        <div className="container">
          <h1 className="gradient-text">Terms of Service</h1>
          <p>Last updated: March 29, 2026</p>
        </div>
      </section>
      <div className="container legal-body">
        <div className="legal-card">
          <p>Welcome to InvoiceEase. These Terms of Service ("Terms") govern your use of our service. By using InvoiceEase, you agree to these Terms.</p>

          <h2>1. Service Description</h2>
          <p>InvoiceEase is a WhatsApp-based invoice generation platform that helps freelancers and businesses create GST-compliant invoices instantly. Our service includes WhatsApp-based invoice generation, GST-compliant PDF creation, cloud storage, dashboard management, and payment tracking.</p>

          <h2>2. Account Registration</h2>
          <p>To use InvoiceEase, you must be at least 18 years old, provide accurate registration information, maintain the security of your credentials, notify us immediately of any unauthorised access, and accept responsibility for all activities under your account.</p>

          <h2>3. Subscription Plans</h2>
          <h3>3.1 Free Plan</h3>
          <p>The Free plan provides 5 invoices per month at no cost. We reserve the right to modify or discontinue the Free plan with notice.</p>
          <h3>3.2 Paid Plans</h3>
          <p>Paid subscriptions (Pro and Business) are billed monthly or annually in advance. You authorise us to charge your payment method for all subscription fees.</p>
          <h3>3.3 Cancellation and Refunds</h3>
          <p>You may cancel your subscription at any time from your dashboard. Cancellations take effect at the end of the current billing period. We offer a 30-day money-back guarantee for first-time subscribers. No refunds for partial months or unused services.</p>

          <h2>4. Acceptable Use</h2>
          <p>You agree not to use InvoiceEase to generate fraudulent or illegal invoices, violate any applicable laws or regulations, infringe intellectual property rights, transmit malicious code, attempt to gain unauthorised access to our systems, or use the service for any unlawful purpose.</p>

          <div className="legal-highlight">
            <strong>Important:</strong> You are solely responsible for the accuracy and legality of invoices you generate. InvoiceEase is a tool for invoice creation; we do not provide tax, legal, or accounting advice.
          </div>

          <h2>5. Invoice Accuracy and Tax Compliance</h2>
          <p>While InvoiceEase generates GST-compliant invoice templates, you are responsible for providing accurate information, ensuring compliance with applicable tax laws, consulting a tax professional for specific advice, and all invoice numbering and GST calculations based on information you provide.</p>

          <h2>6. Data and Privacy</h2>
          <p>Your use of InvoiceEase is subject to our Privacy Policy. We collect and store business details, client information, and invoice data. WhatsApp messages are processed and immediately deleted from our servers. Invoice PDFs are stored securely. We do not sell or share your personal data with third parties for marketing.</p>

          <h2>7. Intellectual Property</h2>
          <p>InvoiceEase and all its original content are owned by us and protected by applicable laws. You may not copy, modify, reverse engineer our software, or remove copyright notices (except watermark removal on paid plans).</p>

          <h2>8. Service Availability</h2>
          <p>We strive to provide reliable service but do not guarantee uninterrupted or error-free operation, that defects will be corrected, or specific uptime percentages. We reserve the right to modify, suspend, or discontinue the service with reasonable notice.</p>

          <h2>9. Limitation of Liability</h2>
          <p><strong>To the maximum extent permitted by law:</strong> InvoiceEase is provided "AS IS" without warranties of any kind. We are not liable for indirect, incidental, or consequential damages. Our total liability shall not exceed the amount you paid in the last 12 months.</p>

          <h2>10. Governing Law</h2>
          <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Mumbai, Maharashtra.</p>

          <h2>11. Contact Information</h2>
          <p><strong>Email:</strong> legal@invoiceease.in<br /><strong>Address:</strong> InvoiceEase, Mumbai, Maharashtra, India</p>

          <div className="legal-highlight">
            <strong>Note:</strong> By using InvoiceEase, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
