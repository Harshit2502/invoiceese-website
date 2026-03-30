# InvoiceEase - Complete Technical Setup Guide

## Table of Contents
1. [Tech Stack Overview](#tech-stack)
2. [Database Schema](#database-schema)
3. [Backend Structure](#backend-structure)
4. [WhatsApp Integration](#whatsapp-integration)
5. [GPT-4 Invoice Parser](#gpt4-parser)
6. [PDF Generation](#pdf-generation)
7. [Deployment Guide](#deployment)

---

## Tech Stack

```
Frontend Dashboard:
- Next.js 14 (React)
- Tailwind CSS
- Deploy: Vercel (free tier)

Backend:
- Node.js 18+ with Express
- PostgreSQL
- Deploy: Railway.app ($5/month)

APIs & Services:
- WhatsApp Business API (Gupshup/Twilio)
- OpenAI GPT-4 API
- Razorpay Payments

Storage:
- Cloudflare R2 or AWS S3
```

---

## Database Schema

### PostgreSQL Tables

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    whatsapp_number VARCHAR(20) UNIQUE NOT NULL,
    business_name VARCHAR(255) NOT NULL,
    gst_number VARCHAR(15),
    pan_number VARCHAR(10),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    
    -- Bank details
    bank_name VARCHAR(255),
    account_number VARCHAR(50),
    ifsc_code VARCHAR(15),
    upi_id VARCHAR(100),
    
    -- Subscription
    subscription_plan VARCHAR(20) DEFAULT 'free', -- 'free', 'pro', 'business'
    subscription_status VARCHAR(20) DEFAULT 'active',
    subscription_expires_at TIMESTAMP,
    razorpay_customer_id VARCHAR(100),
    
    -- Metadata
    logo_url TEXT,
    invoice_counter INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices table
CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    
    -- Client details
    client_name VARCHAR(255) NOT NULL,
    client_gst_number VARCHAR(15),
    client_address TEXT,
    client_email VARCHAR(255),
    client_phone VARCHAR(20),
    
    -- Invoice details
    invoice_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    items JSONB NOT NULL, -- Array of {description, quantity, rate, amount}
    
    -- Amounts
    subtotal DECIMAL(12, 2) NOT NULL,
    cgst_rate DECIMAL(5, 2) DEFAULT 9.00,
    cgst_amount DECIMAL(12, 2),
    sgst_rate DECIMAL(5, 2) DEFAULT 9.00,
    sgst_amount DECIMAL(12, 2),
    igst_rate DECIMAL(5, 2) DEFAULT 0.00,
    igst_amount DECIMAL(12, 2),
    total_amount DECIMAL(12, 2) NOT NULL,
    
    -- Status
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid', 'paid', 'overdue'
    payment_date DATE,
    
    -- Files
    pdf_url TEXT,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_payment_status ON invoices(payment_status);

-- Subscriptions table (for tracking payment history)
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    razorpay_payment_id VARCHAR(100),
    razorpay_subscription_id VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp messages log (for debugging)
CREATE TABLE whatsapp_messages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    message_type VARCHAR(20), -- 'incoming', 'outgoing'
    message_text TEXT,
    parsed_data JSONB,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Backend Structure

### Project Setup

```bash
# Initialize Node.js project
mkdir invoiceease-backend
cd invoiceease-backend
npm init -y

# Install dependencies
npm install express pg dotenv cors
npm install openai axios pdf-lib @cloudflare/workers-types
npm install razorpay twilio

# Dev dependencies
npm install --save-dev nodemon
```

### Folder Structure

```
invoiceease-backend/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   └── env.js
│   ├── controllers/
│   │   ├── invoiceController.js
│   │   ├── userController.js
│   │   └── webhookController.js
│   ├── services/
│   │   ├── whatsappService.js
│   │   ├── gptService.js
│   │   ├── pdfService.js
│   │   └── paymentService.js
│   ├── models/
│   │   ├── User.js
│   │   └── Invoice.js
│   ├── routes/
│   │   ├── api.js
│   │   └── webhook.js
│   ├── utils/
│   │   ├── validation.js
│   │   └── helpers.js
│   └── app.js
├── templates/
│   └── invoice-template.html
├── .env
├── package.json
└── server.js
```

### Environment Variables (.env)

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/invoiceease

# OpenAI
OPENAI_API_KEY=sk-...

# WhatsApp (Gupshup)
GUPSHUP_API_KEY=your_gupshup_key
GUPSHUP_APP_ID=your_app_id
WHATSAPP_NUMBER=919876543210

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Storage (Cloudflare R2)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=invoiceease-pdfs

# Server
PORT=3000
NODE_ENV=development
```

---

## WhatsApp Integration

### Webhook Handler (src/controllers/webhookController.js)

```javascript
const gptService = require('../services/gptService');
const invoiceController = require('./invoiceController');
const whatsappService = require('../services/whatsappService');

async function handleWhatsAppWebhook(req, res) {
    try {
        const { type, payload } = req.body;
        
        // Verify it's a text message
        if (type !== 'message' || payload.type !== 'text') {
            return res.status(200).send('OK');
        }
        
        const userPhone = payload.sender.phone;
        const messageText = payload.payload.text;
        
        console.log(`Message from ${userPhone}: ${messageText}`);
        
        // Step 1: Parse message using GPT-4
        const parsedData = await gptService.parseInvoiceMessage(messageText);
        
        if (!parsedData.success) {
            await whatsappService.sendMessage(
                userPhone,
                "Sorry, I couldn't understand that. Please send in format:\n\n" +
                "Invoice for [Client Name], ₹[Amount], [Service Description]"
            );
            return res.status(200).send('OK');
        }
        
        // Step 2: Find user by phone number
        const user = await User.findByWhatsApp(userPhone);
        
        if (!user) {
            await whatsappService.sendMessage(
                userPhone,
                "Welcome to InvoiceEase! 👋\n\n" +
                "Please complete your signup at invoiceease.in to start generating invoices."
            );
            return res.status(200).send('OK');
        }
        
        // Step 3: Check subscription limits
        if (user.subscription_plan === 'free') {
            const invoiceCount = await Invoice.countThisMonth(user.id);
            if (invoiceCount >= 5) {
                await whatsappService.sendMessage(
                    userPhone,
                    "You've used all 5 free invoices this month! 🎯\n\n" +
                    "Upgrade to Pro for unlimited invoices:\n" +
                    "invoiceease.in/upgrade"
                );
                return res.status(200).send('OK');
            }
        }
        
        // Step 4: Generate invoice
        const invoice = await invoiceController.createInvoice(user, parsedData);
        
        // Step 5: Send confirmation with PDF
        const message = 
            `✅ Invoice generated!\n\n` +
            `Invoice #${invoice.invoice_number}\n` +
            `Client: ${invoice.client_name}\n` +
            `Amount: ₹${invoice.total_amount.toLocaleString('en-IN')}\n\n` +
            `📄 Downloading PDF...`;
        
        await whatsappService.sendMessage(userPhone, message);
        await whatsappService.sendDocument(userPhone, invoice.pdf_url, `${invoice.invoice_number}.pdf`);
        
        // Update remaining count for free users
        if (user.subscription_plan === 'free') {
            const remaining = 5 - (await Invoice.countThisMonth(user.id));
            await whatsappService.sendMessage(
                userPhone,
                `Invoices left this month: ${remaining}/5`
            );
        }
        
        res.status(200).send('OK');
        
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
}

module.exports = { handleWhatsAppWebhook };
```

---

## GPT-4 Invoice Parser

### GPT Service (src/services/gptService.js)

```javascript
const OpenAI = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

async function parseInvoiceMessage(message) {
    try {
        const systemPrompt = `You are an invoice data extractor. Extract client name, amount, and service description from WhatsApp messages.

The user will send messages in various formats like:
- "Invoice for Acme Corp, ₹50,000, Website Design"
- "Bill Sharma Industries 75000 consulting work"
- "Create invoice for XYZ Ltd, 1.5 lakh, app development"
- "Invoice Raj Enterprises ₹35K social media management"

Also handle Hindi/Hinglish messages:
- "Invoice for Sharma ji, 50 हज़ार, website banane ka"
- "Bill bhejo ABC Company ko, 75000 rupees, consulting ke liye"

Extract and return ONLY a JSON object with these fields:
{
    "client_name": "string",
    "amount": number (in rupees, convert K/lakh/etc to actual number),
    "service_description": "string",
    "success": true
}

If you cannot extract all required fields, return:
{
    "success": false,
    "error": "Reason why parsing failed"
}

Important:
- Convert "50K" to 50000, "1.5L" or "1.5 lakh" to 150000
- Handle both English and Hindi/Hinglish
- Client name should be properly capitalized
- Amount must be a number, not string
- If service description is missing, use "Professional Services"`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            temperature: 0.3,
            max_tokens: 200
        });
        
        const content = response.choices[0].message.content.trim();
        
        // Remove markdown code blocks if present
        const jsonString = content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
        
        const parsedData = JSON.parse(jsonString);
        
        // Validate required fields
        if (parsedData.success && parsedData.client_name && parsedData.amount) {
            return {
                success: true,
                client_name: parsedData.client_name,
                amount: parsedData.amount,
                service_description: parsedData.service_description || 'Professional Services'
            };
        }
        
        return {
            success: false,
            error: parsedData.error || 'Missing required fields'
        };
        
    } catch (error) {
        console.error('GPT parsing error:', error);
        return {
            success: false,
            error: 'Failed to parse message'
        };
    }
}

module.exports = { parseInvoiceMessage };
```

---

## PDF Generation

### PDF Service (src/services/pdfService.js)

```javascript
const PDFDocument = require('pdfkit');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const stream = require('stream');

// Initialize S3/R2 client
const s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

async function generateInvoicePDF(invoice, user) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: 'A4', margin: 50 });
            const chunks = [];
            
            // Collect PDF data
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', async () => {
                const pdfBuffer = Buffer.concat(chunks);
                
                // Upload to R2/S3
                const key = `invoices/${user.id}/${invoice.invoice_number}.pdf`;
                
                await s3Client.send(new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: key,
                    Body: pdfBuffer,
                    ContentType: 'application/pdf'
                }));
                
                const pdfUrl = `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`;
                resolve(pdfUrl);
            });
            
            // Header
            doc.fontSize(24).font('Helvetica-Bold').text('INVOICE', { align: 'right' });
            doc.moveDown(0.5);
            
            // Business details (left)
            doc.fontSize(12).font('Helvetica-Bold').text(user.business_name, 50, 100);
            doc.fontSize(10).font('Helvetica').text(user.address || '', 50, 115);
            doc.text(`GSTIN: ${user.gst_number || 'N/A'}`, 50, 130);
            
            // Invoice details (right)
            doc.fontSize(10).text(`Invoice #: ${invoice.invoice_number}`, 400, 100, { align: 'right' });
            doc.text(`Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-IN')}`, 400, 115, { align: 'right' });
            
            doc.moveDown(3);
            
            // Bill To
            doc.fontSize(10).font('Helvetica-Bold').text('BILL TO:', 50, doc.y);
            doc.font('Helvetica').text(invoice.client_name, 50, doc.y + 5);
            if (invoice.client_address) {
                doc.text(invoice.client_address, 50, doc.y + 5);
            }
            if (invoice.client_gst_number) {
                doc.text(`GSTIN: ${invoice.client_gst_number}`, 50, doc.y + 5);
            }
            
            doc.moveDown(2);
            
            // Items table
            const tableTop = doc.y;
            
            // Table header
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Description', 50, tableTop);
            doc.text('Amount', 450, tableTop, { align: 'right' });
            doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();
            
            // Items
            let y = tableTop + 25;
            doc.font('Helvetica');
            invoice.items.forEach(item => {
                doc.text(item.description, 50, y);
                doc.text(`₹${item.amount.toLocaleString('en-IN')}`, 450, y, { align: 'right', width: 100 });
                y += 20;
            });
            
            doc.moveTo(50, y).lineTo(550, y).stroke();
            
            // Totals
            y += 15;
            doc.text('Subtotal:', 350, y);
            doc.text(`₹${invoice.subtotal.toLocaleString('en-IN')}`, 450, y, { align: 'right' });
            
            y += 20;
            doc.text(`CGST (${invoice.cgst_rate}%):`, 350, y);
            doc.text(`₹${invoice.cgst_amount.toLocaleString('en-IN')}`, 450, y, { align: 'right' });
            
            y += 20;
            doc.text(`SGST (${invoice.sgst_rate}%):`, 350, y);
            doc.text(`₹${invoice.sgst_amount.toLocaleString('en-IN')}`, 450, y, { align: 'right' });
            
            doc.moveTo(350, y + 15).lineTo(550, y + 15).stroke();
            
            y += 25;
            doc.fontSize(12).font('Helvetica-Bold');
            doc.text('Total:', 350, y);
            doc.text(`₹${invoice.total_amount.toLocaleString('en-IN')}`, 450, y, { align: 'right' });
            
            // Payment details
            y += 40;
            doc.fontSize(10).font('Helvetica-Bold').text('PAYMENT DETAILS:', 50, y);
            doc.font('Helvetica');
            doc.text(`Bank: ${user.bank_name || 'N/A'}`, 50, y + 15);
            doc.text(`Account: ${user.account_number || 'N/A'}`, 50, y + 30);
            doc.text(`IFSC: ${user.ifsc_code || 'N/A'}`, 50, y + 45);
            doc.text(`UPI: ${user.upi_id || 'N/A'}`, 50, y + 60);
            
            // Footer
            if (user.subscription_plan === 'free') {
                doc.fontSize(8).fillColor('#999999')
                    .text('Generated by InvoiceEase • Upgrade to remove this line', 50, 750, { align: 'center' });
            }
            
            doc.end();
            
        } catch (error) {
            reject(error);
        }
    });
}

module.exports = { generateInvoicePDF };
```

---

## Deployment Guide

### 1. Deploy Database (Railway PostgreSQL)

```bash
# Create Railway account at railway.app
# Create new project -> Add PostgreSQL
# Copy DATABASE_URL from variables
```

### 2. Deploy Backend (Railway)

```bash
# Push code to GitHub
git init
git add .
git commit -m "Initial commit"
git push

# In Railway:
# New Project -> Deploy from GitHub
# Select your repo
# Add environment variables from .env
# Deploy
```

### 3. Deploy Frontend Dashboard (Vercel)

```bash
# In your Next.js project
vercel login
vercel --prod
```

### 4. Setup WhatsApp Business API

```bash
# Sign up at gupshup.io
# Create WhatsApp Business App
# Get API credentials
# Set webhook URL: https://your-backend.railway.app/webhook/whatsapp
```

---

## Next Steps

1. **Test locally first:**
   ```bash
   npm run dev
   # Test with curl/Postman
   ```

2. **Setup database:**
   ```bash
   psql $DATABASE_URL < schema.sql
   ```

3. **Test GPT-4 parser:**
   ```bash
   node test-gpt-parser.js
   ```

4. **Deploy and go live!**

---

## Cost Breakdown

```
Monthly costs (100 users):
- Railway hosting: $5
- PostgreSQL: $0 (included)
- Cloudflare R2: $0 (10GB free)
- GPT-4 API: ~$30-40
- WhatsApp API: ~$20-30
- Razorpay: 2% of revenue

Total: ~$60-80/month
Revenue (20 paid users): $80 (₹199 × 20 = ₹3,980)
Break even: 20 paying customers
```

---

**You're ready to build! Start with setting up the database, then backend, then WhatsApp integration. Test each part before moving to the next.**