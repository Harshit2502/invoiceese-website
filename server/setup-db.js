#!/usr/bin/env node

/**
 * Database Setup Script for InvoiceEase
 * 
 * Usage:
 *   node setup-db.js
 * 
 * Prerequisites:
 *   1. PostgreSQL installed and running
 *   2. psql available in PATH
 *   3. Database user credentials in .env or as defaults
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

require('dotenv').config();

const DB_USER = process.env.DB_USER || 'postgres';
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 5432;
const DB_NAME = process.env.DB_NAME || 'invoiceease';
const DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';

const setupDatabase = async () => {
  try {
    console.log('🚀 Starting InvoiceEase Database Setup...\n');

    // Step 1: Create database
    console.log('📦 Creating database...');
    const createDbCmd = `psql -U ${DB_USER} -h ${DB_HOST} -p ${DB_PORT} -tc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || psql -U ${DB_USER} -h ${DB_HOST} -p ${DB_PORT} -c "CREATE DATABASE ${DB_NAME};"`;
    
    try {
      await execAsync(createDbCmd, { 
        env: { ...process.env, PGPASSWORD: DB_PASSWORD } 
      });
      console.log('✅ Database created or already exists\n');
    } catch (err) {
      console.log('⚠️ Database creation check (may be safe to ignore)\n');
    }

    // Step 2: Run migrations
    console.log('📝 Running migrations...');
    const migrationPath = path.join(__dirname, 'migrations', '001_create_conversations_table.sql');
    const schema = fs.readFileSync(migrationPath, 'utf8');

    const migrationCmd = `psql -U ${DB_USER} -h ${DB_HOST} -p ${DB_PORT} -d ${DB_NAME} -f "${migrationPath}"`;
    
    try {
      await execAsync(migrationCmd, { 
        env: { ...process.env, PGPASSWORD: DB_PASSWORD } 
      });
      console.log('✅ Migrations applied successfully\n');
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('⚠️ Tables already exist\n');
      } else {
        throw err;
      }
    }

    console.log('✨ Database setup complete!\n');
    console.log('📋 Connection details:');
    console.log(`   Host: ${DB_HOST}`);
    console.log(`   Port: ${DB_PORT}`);
    console.log(`   Database: ${DB_NAME}`);
    console.log(`   User: ${DB_USER}\n`);

    console.log('🚀 You can now start the server with: npm start');

  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Make sure PostgreSQL is running');
    console.error('   2. Check .env file for correct DB credentials');
    console.error('   3. Try running: psql -U postgres -h localhost to test connection');
    process.exit(1);
  }
};

// Run setup
setupDatabase();
