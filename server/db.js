// In-memory data store (replace with MongoDB/PostgreSQL in production)
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const db = {
  users: [],
  invoices: [],
};

// Seed a demo user
(async () => {
  const hash = await bcrypt.hash('password123', 10);
  db.users.push({
    id: 'demo-user-1',
    email: 'harshit@example.com',
    whatsapp: '917666522600',
    passwordHash: hash,
    businessName: 'Harshit Designs',
    gstNumber: '27ABCDE1234F1Z5',
    panNumber: 'ABCDE1234F',
    address: '123, Andheri West',
    city: 'Mumbai',
    pincode: '400053',
    bankName: 'HDFC Bank',
    accountNumber: '1234567890',
    ifscCode: 'HDFC0001234',
    upiId: 'harshit@paytm',
    plan: 'pro',
    invoicesThisMonth: 2,
    logoUrl: '',
    templateStyle: 'modern',
    showWatermark: false,
    hasCustomLogo: false,
    createdAt: new Date().toISOString(),
  });

  // Seed demo invoices
  const demoInvoices = [
    { id: uuidv4(), userId: 'demo-user-1', invoiceNumber: 'INV-012', clientName: 'Acme Corporation', date: '2026-03-25', amount: 50000, status: 'paid', service: 'Website Design' },
    { id: uuidv4(), userId: 'demo-user-1', invoiceNumber: 'INV-011', clientName: 'TechStart India', date: '2026-03-20', amount: 35000, status: 'unpaid', service: 'SEO Services' },
    { id: uuidv4(), userId: 'demo-user-1', invoiceNumber: 'INV-010', clientName: 'Sharma Consulting', date: '2026-03-15', amount: 75000, status: 'paid', service: 'Brand Identity' },
    { id: uuidv4(), userId: 'demo-user-1', invoiceNumber: 'INV-009', clientName: 'Digital Solutions Ltd', date: '2026-03-10', amount: 45000, status: 'overdue', service: 'App Development' },
    { id: uuidv4(), userId: 'demo-user-1', invoiceNumber: 'INV-008', clientName: 'Mumbai Marketing Co', date: '2026-03-05', amount: 60000, status: 'paid', service: 'Content Writing' },
  ];
  db.invoices.push(...demoInvoices);
})();

module.exports = db;
