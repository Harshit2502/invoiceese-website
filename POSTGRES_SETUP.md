# PostgreSQL Setup Guide for InvoiceEase

## Overview
This guide will help you set up PostgreSQL as the database for InvoiceEase. The system is currently configured to use an in-memory database by default, but you can switch to PostgreSQL for data persistence.

## Prerequisites
- PostgreSQL 12+ installed on your system
- `psql` command-line tool (included with PostgreSQL)
- Node.js and npm (already set up)

## Installation Steps

### 1. Install PostgreSQL

#### Windows
- Download from [postgresql.org](https://www.postgresql.org/download/windows/)
- Run the installer
- Remember the password you set for the `postgres` user
- Default port is 5432

#### macOS
```bash
brew install postgresql
brew services start postgresql
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create the InvoiceEase Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE invoiceease;

# Create user (optional - for security)
CREATE USER invoiceease_user WITH PASSWORD 'secure_password_here';
ALTER ROLE invoiceease_user SET client_encoding TO 'utf8';
ALTER ROLE invoiceease_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE invoiceease_user SET default_transaction_deferrable TO on;
ALTER ROLE invoiceease_user SET default_transaction_deferrable TO on;
ALTER ROLE invoiceease_user SET timezone TO 'UTC';

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE invoiceease TO invoiceease_user;
```

Or simply use the default `postgres` user (for development only).

### 3. Configure Environment Variables

Edit `.env` file in the `server/` directory:

```env
# Switch to PostgreSQL
USE_POSTGRES=true

# Database connection (update with your credentials)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoiceease
DB_USER=postgres          # or invoiceease_user if you created one
DB_PASSWORD=postgres      # your PostgreSQL password
```

### 4. Start the Server

The migrations will run automatically on server startup:

```bash
cd server
npm start
```

You should see output like:
```
✅ Migration 000_create_users_table.sql executed
✅ Migration 001_create_conversations_table.sql executed
✅ Database schema initialized
🚀 InvoiceEase server running on http://localhost:5000
```

### 5. Verify the Setup

Connect to PostgreSQL and check the tables:

```bash
psql -U postgres invoiceease

# List tables
\dt

# You should see:
# - users
# - conversations
# - invoices
```

## Switching Between Databases

### Use In-Memory (Development/Testing)
```env
USE_POSTGRES=false
```

### Use PostgreSQL (Production)
```env
USE_POSTGRES=true
DB_HOST=your-db-host
DB_USER=your-db-user
DB_PASSWORD=your-db-password
```

## Database Schema

### Users Table
- `id` (UUID): Primary key
- `email`: User email (unique)
- `whatsapp`: WhatsApp number (unique)
- `password_hash`: Hashed password
- `business_name`: Business name
- `gst_number`, `pan_number`: Tax identifiers
- `bank_name`, `account_number`, `ifsc_code`, `upi_id`: Payment details
- `plan`: Subscription plan (free/pro)
- `invoices_this_month`: Count for free plan limit
- `created_at`, `updated_at`: Timestamps

### Invoices Table
- `id` (UUID): Primary key
- `user_id` (UUID): Reference to users
- `invoice_number`: Unique invoice number
- `client_name`, `client_gst`: Client details
- `service_description`: Service provided
- `subtotal`, `cgst`, `sgst`, `igst`, `total`: Amount breakdown
- `gst_rate`: Applied GST rate
- `pdf_url`: Link to generated PDF
- `status`: unpaid/paid/overdue
- `invoice_date`: Date of invoice
- `created_at`, `updated_at`: Timestamps

### Conversations Table
- `id` (UUID): Primary key
- `user_id` (UUID): Reference to users
- `whatsapp_number`: WhatsApp chat identifier
- `state`: Conversation state (idle/waiting_for_name/etc)
- `data` (JSONB): Conversation data
- `started_at`, `updated_at`: Timestamps

## Troubleshooting

### Connection Refused
```
error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solution**: Ensure PostgreSQL is running
```bash
# Windows
# Start PostgreSQL service from Services.msc

# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql
```

### Password Authentication Failed
```
error: password authentication failed for user "postgres"
```
**Solution**: Check your password in .env file and reset if needed
```bash
psql -U postgres -c "ALTER ROLE postgres WITH PASSWORD 'new_password';"
```

### Database Already Exists
```
ERROR: database "invoiceease" already exists
```
**Solution**: Either drop the old database or use a different name
```bash
psql -U postgres -c "DROP DATABASE invoiceease;"
```

## Migration Data from In-Memory

If you have existing invoices in the in-memory database:

1. Export data from in-memory (JSON export feature)
2. Create import script to load into PostgreSQL
3. Run import script

See `scripts/migrate-data.js` for the migration utility.

## Performance Tips

1. Enable connection pooling (already configured)
2. Create indexes (automatically created by migrations)
3. Monitor query performance with `EXPLAIN ANALYZE`
4. Set up automated backups

## Next Steps

- [Deploy to Production](./DEPLOYMENT.md)
- [WhatsApp Integration](./WHATSAPP_SETUP.md)
- [Monitoring & Logging](./MONITORING.md)

## Support

For issues or questions:
1. Check PostgreSQL logs: `/var/log/postgresql/`
2. Test connection: `psql -U postgres -h localhost invoiceease`
3. Review schema: `\d+ table_name` in psql
