import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">
            <div className="logo-icon">IE</div>
            InvoiceEase
          </div>
          <p>GST invoices in 30 seconds via WhatsApp. Built for Indian freelancers.</p>
        </div>

        <div className="footer-links">
          <div className="footer-col">
            <h4>Product</h4>
            <Link to="/pricing">Pricing</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>
          <div className="footer-col">
            <h4>Legal</h4>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </div>
          <div className="footer-col">
            <h4>Account</h4>
            <Link to="/signup">Sign up free</Link>
            <Link to="/login">Log in</Link>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 InvoiceEase. Made with ❤️ for Indian freelancers.</p>
      </div>
    </footer>
  );
}
