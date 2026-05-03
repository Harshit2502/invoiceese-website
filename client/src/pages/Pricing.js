import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './Pricing.css';

const plans = [
  {
    name: 'Free', monthly: 0, yearly: 0,
    desc: 'Perfect for trying out InvoiceEase',
    features: ['5 invoices/month', 'Telegram invoicing', 'GST compliant', 'Basic modern template', '7-day storage'],
    notIncluded: ['Premium templates (3)', 'Custom logo', 'Remove watermark', 'Payment tracking', 'Priority support'],
    cta: 'Start Free', ctaClass: 'btn-secondary', href: '/signup',
  },
  {
    name: 'Pro', monthly: 199, yearly: 159,
    desc: 'For serious freelancers',
    featured: true,
    features: ['Unlimited invoices', 'Telegram invoicing', 'GST compliant', '3 premium templates', 'Lifetime storage', 'Custom logo support', 'Remove watermark', 'Payment tracking', 'Priority email support'],
    notIncluded: [],
    cta: 'Start Pro Trial', ctaClass: 'btn-primary', href: '/signup',
  },
  {
    name: 'Business', monthly: 499, yearly: 399,
    desc: 'For agencies and teams',
    features: ['Everything in Pro', '5 team members', 'Multi-business support', 'Expense tracking', 'Advanced analytics', 'API access', 'Accounting integrations', 'Dedicated support', 'White-label option'],
    notIncluded: [],
    cta: 'Start Business', ctaClass: 'btn-primary', href: '/signup',
  },
];

const comparison = [
  { feature: 'Invoices', free: '5/month', pro: 'Unlimited', business: 'Unlimited' },
  { feature: 'Telegram invoicing', free: true, pro: true, business: true },
  { feature: 'GST compliant', free: true, pro: true, business: true },
  { feature: 'Invoice templates', free: '1 basic', pro: '3 premium', business: 'All' },
  { feature: 'Storage duration', free: '7 days', pro: 'Lifetime', business: 'Lifetime' },
  { feature: 'Custom logo upload', free: false, pro: true, business: true },
  { feature: 'Remove watermark', free: false, pro: true, business: true },
  { feature: 'Payment tracking', free: false, pro: true, business: true },
  { feature: 'Team members', free: '1', pro: '1', business: '5' },
  { feature: 'Expense tracking', free: false, pro: false, business: true },
  { feature: 'Analytics', free: false, pro: 'Basic', business: 'Advanced' },
  { feature: 'API access', free: false, pro: false, business: true },
  { feature: 'Support', free: 'Community', pro: 'Priority email', business: 'Dedicated account manager' },
];

const faqs = [
  { q: 'Can I change plans later?', a: 'Yes! Upgrade or downgrade anytime. When you upgrade, the prorated amount is charged immediately. Downgrades take effect at your next billing cycle.' },
  { q: 'Is there a free trial for Pro?', a: 'Yes! We offer a 7-day free trial for the Pro plan. No credit card required. Cancel anytime during the trial without being charged.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit/debit cards, UPI, net banking, and popular wallets through Razorpay. All payments are secure and encrypted.' },
  { q: 'Can I get a refund?', a: 'We offer a 30-day money-back guarantee. If you\'re not satisfied, contact us within 30 days for a full refund, no questions asked.' },
  { q: 'Do you offer annual billing discounts?', a: 'Yes! Save 20% with annual billing — that\'s 2.4 months free on the Pro plan.' },
  { q: 'What storage duration do I get on Free plan?', a: 'On the Free plan, invoices are stored for 7 days. Upgrade to Pro for lifetime storage, custom templates, watermark removal, and more.' },
  { q: 'Can I create unlimited invoices on the Free plan?', a: 'The Free plan allows you to create up to 5 invoices per month. To create unlimited invoices, you can upgrade to the Pro plan, which also includes advanced templates, watermark removal, and lifetime storage.' },
];

function CellVal({ val }) {
  if (val === true) return <span className="check">✓</span>;
  if (val === false) return <span className="cross">—</span>;
  return <span>{val}</span>;
}

export default function Pricing() {
  const [yearly, setYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const { user, authFetch, setUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (window.Razorpay) return;
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  const handleSubscribe = async (planName, isYearly) => {
    if (!window.Razorpay) {
      window.alert('Razorpay SDK is not loaded yet. Please refresh and try again.');
      return;
    }

    try {
      const orderRes = await authFetch('/api/payments/razorpay/subscription-order', {
        method: 'POST',
        body: JSON.stringify({ planName: planName.toLowerCase(), isYearly }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData.error || 'Failed to create subscription order');

      const options = {
        key: orderData.key,
        subscription_id: orderData.subscription_id,
        name: 'InvoiceEase',
        description: `${planName} Plan Subscription`,
        prefill: {
          name: user?.businessName || '',
          email: user?.email || '',
          contact: user?.whatsapp || '',
        },
        theme: { color: '#0f6e56' },
        handler: async function (response) {
          try {
            const verifyRes = await authFetch('/api/payments/razorpay/subscription-verify', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
                planName: orderData.planName,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Subscription verification failed');

            setUser(prev => ({ ...prev, plan: verifyData.plan }));
            window.alert('Subscription successful! Welcome to the new plan.');
            navigate('/dashboard');
          } catch (e) {
            window.alert(e.message);
          }
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function (response) {
        window.alert(`Payment failed: ${response?.error?.description || 'Unknown error'}`);
      });
      razorpay.open();
    } catch (error) {
      window.alert(error.message || 'Could not start subscription process.');
    }
  };

  return (
    <div>
      <Navbar />

      <section className="pricing-hero">
        <div className="container" style={{ textAlign: 'center' }}>
          <h1 className="gradient-text">Choose Your Plan</h1>
          <p>Simple, transparent pricing that grows with you. Start free, upgrade when you need more.</p>

          <div className="billing-toggle">
            <span className={!yearly ? 'active' : ''}>Monthly</span>
            <button className={`toggle-track ${yearly ? 'on' : ''}`} onClick={() => setYearly(v => !v)}>
              <span className="toggle-thumb" />
            </button>
            <span className={yearly ? 'active' : ''}>Yearly</span>
            <span className="savings-chip">Save 20%</span>
          </div>
        </div>
      </section>

      <section className="pricing-cards-section">
        <div className="container">
          <div className="plans-grid">
            {plans.map(plan => (
              <div className={`plan-card ${plan.featured ? 'featured' : ''}`} key={plan.name}>
                {plan.featured && <div className="plan-badge">Most Popular</div>}
                <h3>{plan.name}</h3>
                <p className="plan-desc">{plan.desc}</p>
                <div className="plan-price">
                  ₹{yearly ? plan.yearly : plan.monthly}
                  <span>/month</span>
                </div>
                {yearly && plan.yearly > 0 && (
                  <p className="billed-yearly">Billed yearly (₹{plan.yearly * 12})</p>
                )}
                {user && plan.name.toLowerCase() !== 'free' ? (
                  <button onClick={() => handleSubscribe(plan.name, yearly)} className={`btn ${plan.ctaClass} btn-block`} style={{ marginTop: 24, marginBottom: 8 }}>
                    {plan.cta}
                  </button>
                ) : (
                  <Link to={plan.href} className={`btn ${plan.ctaClass} btn-block`} style={{ marginTop: 24, marginBottom: 8 }}>
                    {plan.cta}
                  </Link>
                )}
                <ul className="plan-features">
                  {plan.features.map(f => <li key={f}><span className="check">✓</span>{f}</li>)}
                  {plan.notIncluded.map(f => <li key={f} className="not-included"><span className="cross">—</span>{f}</li>)}
                </ul>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="comparison-wrap">
            <h2 className="section-title">Compare all features</h2>
            <p className="section-subtitle">See exactly what's included in each plan</p>
            <div className="table-scroll">
              <table className="comp-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Free</th>
                    <th className="col-pro">Pro</th>
                    <th>Business</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(row => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <td><CellVal val={row.free} /></td>
                      <td className="col-pro"><CellVal val={row.pro} /></td>
                      <td><CellVal val={row.business} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ */}
          <div className="faq-section">
            <h2 className="section-title">Frequently Asked Questions</h2>
            <div className="faq-list">
              {faqs.map((faq, i) => (
                <div className={`faq-item ${openFaq === i ? 'open' : ''}`} key={i}>
                  <button className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span>{faq.q}</span>
                    <span className="faq-chevron">{openFaq === i ? '−' : '+'}</span>
                  </button>
                  {openFaq === i && <div className="faq-a">{faq.a}</div>}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="pricing-cta">
            <h2>Ready to streamline your invoicing?</h2>
            <p>Start with our free plan. No credit card required.</p>
            <Link to="/signup" className="btn btn-accent btn-lg">Start Free Today</Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
