import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import './FAQ.css';

const categories = [
  {
    title: 'Getting Started',
    items: [
      { q: 'How do I create my first invoice?', a: 'After signing up, send a WhatsApp message in this format: "Invoice for [Client Name], ₹[Amount], [Service Description]". For example: "Invoice for Acme Corp, ₹50,000, Website Design". You\'ll receive a GST-compliant PDF within 30 seconds!' },
      { q: 'Do I need to download an app?', a: 'No! Everything works through WhatsApp, which you already have. Just save our WhatsApp number and start sending invoice requests.' },
      { q: 'What information do I need during signup?', a: 'You\'ll need your email, WhatsApp number, and business name. GST number, PAN, address, and bank details are optional but recommended — the more you provide, the more automatic your invoices become.' },
    ],
  },
  {
    title: 'Using InvoiceEase',
    items: [
      { q: 'Can I send invoice requests in Hindi?', a: 'Yes! You can send requests in Hindi, Marathi, or English. Our AI understands all three languages, including voice notes. Example: "Sharma ji ke liye invoice banao, 50 hazaar, website design"' },
      { q: 'How do I add multiple items to one invoice?', a: 'List all items in your WhatsApp message. For example: "Invoice for ABC Ltd, Item 1: ₹20K website design, Item 2: ₹10K SEO services, Item 3: ₹5K content writing".' },
      { q: 'Can I customise the invoice template?', a: 'Pro and Business users get access to 3 professional templates and can upload their logo. Free users get one basic template.' },
      { q: 'Where can I see all my past invoices?', a: 'Log in to your dashboard to see all invoices. Download any as PDF, mark them paid/unpaid, and view analytics.' },
      { q: 'Can I edit an invoice after creation?', a: 'Invoices cannot be edited after creation (for accounting integrity). If you made a mistake, simply create a new invoice — this won\'t count against your monthly limit on paid plans.' },
    ],
  },
  {
    title: 'GST & Compliance',
    items: [
      { q: 'Are the invoices GST compliant?', a: 'Yes! All invoices are 100% GST compliant as per Indian tax regulations. They include CGST/SGST breakdown, sequential invoice numbering, GST numbers, and all required fields.' },
      { q: 'What if I don\'t have a GST number?', a: 'No problem! If you\'re not GST registered (turnover under ₹40 lakh), your invoices will show N/A for GST and no tax will be calculated. Your invoices remain professional and legally valid.' },
      { q: 'How is GST calculated?', a: 'For services, we apply 18% GST (9% CGST + 9% SGST) for intra-state transactions, and 18% IGST for inter-state. You can customise GST rates in your dashboard settings.' },
    ],
  },
  {
    title: 'Billing & Payments',
    items: [
      { q: 'How does the Free plan work?', a: 'The Free plan gives you 5 invoices per month, forever. No credit card required. When you hit the limit, upgrade to Pro for unlimited invoices.' },
      { q: 'Can I cancel my subscription anytime?', a: 'Yes! Cancel anytime from your dashboard. Your account remains active until the end of the current billing period, then moves to the Free plan automatically.' },
      { q: 'Do you offer refunds?', a: 'Yes! We offer a 30-day money-back guarantee. If you\'re not satisfied for any reason, email us within 30 days for a full refund, no questions asked.' },
      { q: 'What payment methods do you accept?', a: 'We accept all major credit/debit cards, UPI, net banking, and digital wallets through Razorpay. All payments are secured with industry-standard SSL.' },
    ],
  },
  {
    title: 'Technical Questions',
    items: [
      { q: 'Is my data secure?', a: 'Yes! We use bank-level 256-bit SSL encryption to protect your data. All invoices are stored securely in the cloud. We never share your data with third parties. WhatsApp messages are processed and immediately deleted from our servers.' },
      { q: 'What happens to my invoices if I cancel?', a: 'On the Free plan, invoices are stored for 7 days. On paid plans, invoices are stored forever. If you cancel Pro, older invoices are archived (not deleted). Resubscribing restores all data.' },
      { q: 'Can I export my data?', a: 'Yes! From your dashboard, download all invoices as PDFs or export invoice data as CSV for use in Excel or accounting software.' },
      { q: 'Do you have an API?', a: 'API access is available on the Business plan. This lets you integrate InvoiceEase with your CRM, custom tools, or accounting software. Contact us for API documentation.' },
    ],
  },
];

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`faq-item ${open ? 'open' : ''}`}>
      <button className="faq-q" onClick={() => setOpen(v => !v)}>
        <span>{q}</span>
        <span className="faq-icon">{open ? '−' : '+'}</span>
      </button>
      {open && <div className="faq-ans">{a}</div>}
    </div>
  );
}

export default function FAQ() {
  const [search, setSearch] = useState('');

  const filtered = categories.map(cat => ({
    ...cat,
    items: cat.items.filter(item =>
      item.q.toLowerCase().includes(search.toLowerCase()) ||
      item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  return (
    <div>
      <Navbar />

      <section className="faq-hero">
        <div className="container" style={{ textAlign: 'center' }}>
          <h1 className="gradient-text">Frequently Asked Questions</h1>
          <p>Everything you need to know about InvoiceEase</p>
          <div className="faq-search">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search for answers..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="faq-content">
        <div className="container faq-container">
          {filtered.length === 0 ? (
            <div className="no-results">
              <p>No results found for "<strong>{search}</strong>"</p>
              <button className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>Clear search</button>
            </div>
          ) : (
            filtered.map(cat => (
              <div className="faq-cat" key={cat.title}>
                <h2>{cat.title}</h2>
                <div className="faq-list">
                  {cat.items.map(item => <FAQItem key={item.q} {...item} />)}
                </div>
              </div>
            ))
          )}

          <div className="faq-contact">
            <h3>Still have questions?</h3>
            <p>Our support team is here to help!</p>
            <a href="mailto:support@invoiceease.in" className="btn btn-accent">Contact Support</a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
