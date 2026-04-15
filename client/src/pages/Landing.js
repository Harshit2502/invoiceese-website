import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './Landing.css';

const features = [
  { icon: '⚡', title: 'Instant generation', desc: 'No forms to fill. Just send a WhatsApp message and get your invoice in 30 seconds.' },
  { icon: '✓', title: 'GST compliant', desc: 'Automatic CGST & SGST calculations. All invoices follow Indian tax regulations perfectly.' },
  { icon: '💼', title: 'Professional look', desc: 'Beautiful templates with your logo and branding. Make a great impression on every client.' },
  { icon: '📱', title: 'No app needed', desc: 'Works entirely on WhatsApp. Your clients can access invoices instantly on any device.' },
  { icon: '🔒', title: 'Secure storage', desc: 'All invoices saved securely in the cloud. Access them anytime, from anywhere.' },
  { icon: '📊', title: 'Track payments', desc: 'See which invoices are paid and pending. Keep your finances organised effortlessly.' },
];

const steps = [
  { n: '1', title: 'Sign up and set up', desc: 'Create your account in 2 minutes. Add your business name, GST number, and bank details once.' },
  { n: '2', title: 'WhatsApp your invoice', desc: 'Send a message like "Invoice for Acme Corp, ₹50,000, Website Design" to our number.' },
  { n: '3', title: 'Get your PDF instantly', desc: 'Within 30 seconds, receive a professional GST-compliant invoice as a PDF. Download and share!' },
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
            <p>Stop wasting time on invoices. Just WhatsApp your details and get a professional, GST-compliant invoice instantly.</p>
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
              <span className="demo-title">WhatsApp</span>
            </div>
            <div className="whatsapp-mockup">
              <div className="wa-message user">Invoice for Acme Corp, ₹50,000, Website Design</div>
              <div className="wa-message bot">
                ✅ <strong>Invoice generated!</strong><br /><br />
                Invoice #INV-001<br />
                Client: Acme Corp<br />
                Amount: ₹50,000<br />
                GST (18%): ₹9,000<br />
                <strong>Total: ₹59,000</strong><br /><br />
                📄 <span className="link-text">Download PDF →</span>
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
              <div className="how-card-icon">💬</div>
              <div className="how-card-title">Say it in Hindi too!</div>
              <div className="how-card-example">"Sharma ji ke liye invoice banao, 50 hazaar, website design ke liye"</div>
              <div className="how-card-sub">Our AI understands Hindi, Marathi &amp; English</div>
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
                <li>✓ WhatsApp support</li>
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
