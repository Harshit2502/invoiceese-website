# PostgreSQL Integration - Setup Summary

Date: April 2, 2026

## ✅ What's Been Implemented

### 1. **Database Schema**
   - **Users Table** (`000_create_users_table.sql`)
     - UUID primary key, indexed by email and WhatsApp
     - Stores business info, tax IDs, and plan details
   
   - **Conversations Table** (`001_create_conversations_table.sql`)
     - Tracks WhatsApp chat state and context
     - JSONB data field for flexible conversation data
   
   - **Invoices Table** (in same migration)
     - Full invoice records with GST breakdown
     - Indexed by user_id and status for fast queries

### 2. **Database Module** (`db-postgres.js`)
   Complete PostgreSQL implementation with:
   - **User functions**: createUser, getUserByEmail, getUserById, getUserByWhatsApp, updateUser
   - **Invoice functions**: createInvoice, getInvoiceById, getUserInvoices, updateInvoiceStatus, deleteInvoice
   - **Conversation functions**: getConversation, createConversation, updateConversationState, updateConversationData
   - Connection pooling via pg library
   - Automatic migration runner

### 3. **Configuration Files**
   - `.env` - Updated with `USE_POSTGRES=false` (default: in-memory)
   - `.env.example` - Template for all database variables
   - `POSTGRES_SETUP.md` - Complete PostgreSQL setup guide

### 4. **Migration Tool**
   - `scripts/migrate-data.js` - Migrates existing in-memory data to PostgreSQL

## 📋 Quick Start Guide

### Option A: Continue with In-Memory Database (Current)
```bash
# Already configured - nothing to do!
# .env has USE_POSTGRES=false
npm run dev
```

### Option B: Switch to PostgreSQL

#### Step 1: Install PostgreSQL
- [Windows](https://www.postgresql.org/download/windows/)
- [macOS](https://www.postgresql.org/download/macosx/)
- [Linux](https://www.postgresql.org/download/linux/)

#### Step 2: Create Database
```bash
# Create database
createdb invoiceease

# Or using psql
psql -U postgres -c "CREATE DATABASE invoiceease;"
```

#### Step 3: Update .env
```bash
cd server
# Edit .env and set:
USE_POSTGRES=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=invoiceease
DB_USER=postgres
DB_PASSWORD=your_password
```

#### Step 4: Start Server
```bash
npm start
# Server will automatically run migrations and initialize schema
```

#### Step 5: Migrate Data (Optional)
If you have existing in-memory data:
```bash
node scripts/migrate-data.js
```

## 🔄 Database Flow

```
User Request
    ↓
Server Routes (auth.js, invoices.js, etc.)
    ↓
Check: USE_POSTGRES env variable
    ├─ true  → db-postgres.js → PostgreSQL
    └─ false → db.js → In-memory array
    ↓
Response
```

## 📊 Data Structure

### Users
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "whatsapp": "+919999999999",
  "passwordHash": "bcrypt_hash",
  "businessName": "My Business",
  "gstNumber": "22ABCDE1234F1Z5",
  "plan": "free|pro",
  "invoicesThisMonth": 5
}
```

### Invoices
```json
{
  "id": "uuid",
  "userId": "uuid",
  "invoiceNumber": "INV-001",
  "clientName": "Client Name",
  "amount": 10000,
  "gstRate": 18,
  "gstAmount": 1800,
  "totalAmount": 11800,
  "status": "unpaid|paid|overdue",
  "pdfUrl": "http://localhost:5000/api/pdf/...",
  "date": "2026-04-02"
}
```

## 🔒 Connection Pooling

- Automatically configured in db-postgres.js
- Default: 20 connections
- Supports SSL connections for production

## 🚀 Deployment Ready

The setup supports:
- ✅ Local development (in-memory or PostgreSQL)
- ✅ Production deployment (PostgreSQL with env vars)
- ✅ Automatic schema initialization
- ✅ Data migration utilities
- ✅ Connection pooling for scalability

## 📝 Next Steps

1. **Test both modes**:
   ```bash
   # Test with in-memory
   npm run dev
   
   # Test with PostgreSQL
   # Set USE_POSTGRES=true in .env
   npm run dev
   ```

2. **Create more users and invoices** through the web interface

3. **Review the migration guide**: `POSTGRES_SETUP.md`

4. **Deploy to production** with proper PostgreSQL setup

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| `error: connect ECONNREFUSED 127.0.0.1:5432` | PostgreSQL not running - start it and verify port |
| `error: database "invoiceease" does not exist` | Create database: `createdb invoiceease` |
| `error: invalid length of user name` | Check DB_USER in .env - should be "postgres" |
| `UNIQUE constraint "users_email_key" violated` | Clear old data or use migration script |

## 📚 Files Modified/Created

```
.
├── server/
│   ├── db-postgres.js              [UPDATED] Complete PostgreSQL implementation
│   ├── .env                        [UPDATED] Added PostgreSQL config
│   ├── .env.example                [UPDATED] Example config
│   └── migrations/
│       ├── 000_create_users_table.sql        [NEW]
│       └── 001_create_conversations_table.sql [UPDATED]
├── scripts/
│   └── migrate-data.js             [NEW] Data migration utility
└── POSTGRES_SETUP.md               [NEW] Detailed setup guide
```

## ✨ Key Features

- ✅ Hybrid database support (in-memory + PostgreSQL)
- ✅ Automatic schema initialization
- ✅ Data migration tools
- ✅ Connection pooling
- ✅ UUID support for better distribution
- ✅ JSONB for flexible conversation data
- ✅ Proper indexing for performance
- ✅ CORS-enabled APIs

---

**Ready to start?** Choose your path:
1. **Continue with in-memory** (no setup needed) → npm run dev
2. **Switch to PostgreSQL** → Follow POSTGRES_SETUP.md
