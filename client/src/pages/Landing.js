import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './Landing.css';

const features = [
  { icon: '⚡', title: 'Instant generation', desc: 'Create professional, GST-compliant invoices in under 30 seconds directly from your browser.' },
  { icon: '✓', title: 'GST compliant', desc: 'Automatic CGST & SGST calculations. All invoices follow Indian tax regulations perfectly.' },
  { icon: '💼', title: 'Professional look', desc: 'Beautiful templates with your logo and branding. Make a great impression on every client.' },
  { icon: '📱', title: 'No app needed', desc: 'Fully responsive web application. Generate and manage invoices from any mobile or desktop browser.' },
  { icon: '🔒', title: 'Secure storage', desc: 'All invoices saved securely in the cloud. Access them anytime, from anywhere.' },
  { icon: '📊', title: 'Track payments', desc: 'See which invoices are paid and pending. Keep your finances organised effortlessly.' },
];

const steps = [
  { n: '1', title: 'Sign up and set up', desc: 'Create your account in 2 minutes. Add your business name, GST number, and bank details once.' },
  { n: '2', title: 'Enter invoice details', desc: 'Input your client name, amount, and item details manually, or upload a receipt to parse details.' },
  { n: '3', title: 'Download your PDF instantly', desc: 'Get a clean, professional, GST-compliant PDF invoice generated instantly. Ready to share with your clients!' },
];

export default function Landing() {
  return (
    <div className="landing">
      <Navbar />

      {/* Hero */}
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-content">
            <div className="hero-badge">🇮🇳 Built for Indian freelancers</div>
            <h1>GST Invoices in<br /><span className="gradient-text">30 Seconds</span></h1>
            <p>Stop wasting time on billing. Generate professional, GST-compliant invoices instantly from your web dashboard on any device.</p>
            <div className="hero-buttons">
              <Link to="/signup" className="btn btn-primary btn-lg">Get Started Free</Link>
              <Link to="#how-it-works" className="btn btn-secondary btn-lg">See How It Works</Link>
            </div>
            <div className="hero-stats">
              <div className="stat"><strong>500+</strong><span>Freelancers</span></div>
              <div className="stat-divider" />
              <div className="stat"><strong>10K+</strong><span>Invoices generated</span></div>
              <div className="stat-divider" />
              <div className="stat"><strong>30s</strong><span>Average time</span></div>
            </div>
          </div>

          <div className="hero-demo">
            <div className="demo-header">
              <div className="demo-dot red" /><div className="demo-dot yellow" /><div className="demo-dot green" />
              <span className="demo-title">Invoice Generator</span>
            </div>
            <div className="telegram-mockup">
              <div className="tg-message user" style={{ background: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>📄 Web Invoice Form</strong>
                <span style={{ fontSize: 11, color: '#0f6e56', fontWeight: 600 }}>Ready</span>
              </div>
              <div className="tg-message bot" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 8, padding: '16px' }}>
                <div style={{ borderBottom: '1px solid var(--border2)', paddingBottom: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: 'var(--ink)' }}>Invoice #INV-001</strong>
                  <span style={{ fontSize: 11, color: '#10b981', background: '#d1fae5', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>Generated</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink3)' }}>Client:</span><strong style={{ color: 'var(--ink)' }}>Acme Corp</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink3)' }}>Amount:</span><strong style={{ color: 'var(--ink)' }}>₹50,000.00</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--ink3)' }}>GST (18%):</span><strong style={{ color: 'var(--ink)' }}>₹9,000.00</strong></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border2)', paddingTop: 6, fontWeight: 700, fontSize: 14 }}><span style={{ color: 'var(--ink)' }}>Total:</span><strong style={{ color: 'var(--green)' }}>₹59,000.00</strong></div>
                </div>
              </div>
            </div>
            <div className="demo-footer">⚡ 30 seconds. That's it.</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Why freelancers love InvoiceEase</h2>
          <p className="section-subtitle">Everything you need to get paid professionally</p>
          <div className="features-grid">
            {features.map((f, i) => (
              <div className="feature-card" key={i}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-section" id="how-it-works">
        <div className="container how-grid">
          <div className="how-text">
            <h2 className="section-title" style={{ textAlign: 'left' }}>How it works</h2>
            <p className="section-subtitle" style={{ textAlign: 'left' }}>Get started in less than 5 minutes</p>
            <div className="steps">
              {steps.map((s) => (
                <div className="step" key={s.n}>
                  <div className="step-num">{s.n}</div>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="how-visual">
            <div className="how-card">
              <div className="how-card-icon">📸</div>
              <div className="how-card-title">AI Receipt OCR</div>
              <div className="how-card-example">Upload a photo/PDF of any purchase invoice</div>
              <div className="how-card-sub">AI reads items, GSTIN, and totals in 5 seconds</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="pricing-preview">
        <div className="container">
          <h2 className="section-title">Simple, transparent pricing</h2>
          <p className="section-subtitle">Start free, upgrade when you need more</p>
          <div className="pricing-cards">
            <div className="pricing-card">
              <h3>Free</h3>
              <div className="price">₹0<span>/month</span></div>
              <p className="price-desc">Perfect for trying out</p>
              <ul>
                <li>✓ 5 invoices per month</li>
                <li>✓ GST compliant</li>
                <li>✓ Basic template</li>
                <li>✓ Web dashboard access</li>
              </ul>
              <Link to="/signup" className="btn btn-secondary btn-block" style={{ marginTop: 24 }}>Start Free</Link>
            </div>
            <div className="pricing-card featured">
              <div className="featured-badge">Most Popular</div>
              <h3>Pro</h3>
              <div className="price">₹199<span>/month</span></div>
              <p className="price-desc">For serious freelancers</p>
              <ul>
                <li>✓ Unlimited invoices</li>
                <li>✓ Custom logo</li>
                <li>✓ No watermark</li>
                <li>✓ Payment tracking</li>
                <li>✓ Priority support</li>
              </ul>
              <Link to="/signup" className="btn btn-primary btn-block" style={{ marginTop: 24 }}>Start Pro Trial</Link>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Link to="/pricing" className="see-all-link">See all plans & features →</Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <div className="container">
          <h2>Ready to save hours on invoicing?</h2>
          <p>Join hundreds of freelancers who've already made the switch</p>
          <Link to="/signup" className="btn btn-accent btn-lg">Start Free Today</Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
