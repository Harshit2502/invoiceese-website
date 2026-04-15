#!/usr/bin/env node

/**
 * Data Migration Script
 * Migrates data from in-memory database to PostgreSQL
 * 
 * Usage: node scripts/migrate-data.js
 */

require('dotenv').config({ path: './server/.env' });
const db = require('./server/db');
const pgDb = require('./server/db-postgres');

async function migrateData() {
  try {
    console.log('🔄 Starting data migration...\n');

    // Initialize PostgreSQL database
    console.log('📦 Initializing PostgreSQL...');
    await pgDb.initializeDatabase();
    console.log('✅ PostgreSQL initialized\n');

    // Migrate users
    console.log('👥 Migrating users...');
    for (const user of db.users) {
      try {
        await pgDb.createUser({
          id: user.id,
          email: user.email,
          whatsapp: user.whatsapp,
          passwordHash: user.passwordHash,
          businessName: user.businessName,
          gstNumber: user.gstNumber || '',
          panNumber: user.panNumber || '',
          address: user.address || '',
          city: user.city || '',
          pincode: user.pincode || '',
          bankName: user.bankName || '',
          accountNumber: user.accountNumber || '',
          ifscCode: user.ifscCode || '',
          upiId: user.upiId || '',
        });
        console.log(`  ✓ Migrated user: ${user.email}`);
      } catch (err) {
        console.error(`  ✗ Failed to migrate user ${user.email}:`, err.message);
      }
    }
    console.log(`✅ Migrated ${db.users.length} users\n`);

    // Migrate invoices
    console.log('📄 Migrating invoices...');
    for (const invoice of db.invoices) {
      try {
        await pgDb.createInvoice({
          id: invoice.id,
          userId: invoice.userId,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName,
          clientGst: invoice.clientGst || '',
          service: invoice.service,
          amount: invoice.amount,
          gstRate: invoice.gstRate || 18,
          gstAmount: invoice.gstAmount || 0,
          totalAmount: invoice.totalAmount || invoice.amount,
          status: invoice.status || 'unpaid',
          date: invoice.date,
        });
        console.log(`  ✓ Migrated invoice: ${invoice.invoiceNumber}`);
      } catch (err) {
        console.error(`  ✗ Failed to migrate invoice ${invoice.invoiceNumber}:`, err.message);
      }
    }
    console.log(`✅ Migrated ${db.invoices.length} invoices\n`);

    console.log('🎉 Migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Update .env: Set USE_POSTGRES=true');
    console.log('2. Verify data in PostgreSQL: psql -U postgres invoiceease');
    console.log('3. Restart the server');
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrateData();
