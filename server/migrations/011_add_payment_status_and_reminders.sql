-- 011_add_payment_status_and_reminders.sql

-- 1. Create custom enum types if not exists
DO $$ BEGIN
    CREATE TYPE invoice_doc_type AS ENUM ('invoice', 'quotation', 'proforma');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE quote_status_type AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'converted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Alter users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_due_days INTEGER DEFAULT 30;
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_remind_on_days INTEGER[] DEFAULT '{1, 3, 7, 14}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS default_reminder_channels VARCHAR(20)[] DEFAULT '{"email"}';

-- 3. Alter invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS doc_type VARCHAR(30) DEFAULT 'invoice';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quote_status VARCHAR(30);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS converted_invoice_id UUID;

-- 4. Alter documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS quote_status VARCHAR(30);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS converted_invoice_id UUID;

-- 5. Create payment_reminders table
CREATE TABLE IF NOT EXISTS payment_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    remind_on_days INTEGER[] DEFAULT '{1, 3, 7, 14}',
    channels VARCHAR(20)[] DEFAULT '{"email"}',
    last_sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(invoice_id)
);

-- 6. Create reminder_logs table
CREATE TABLE IF NOT EXISTS reminder_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    sent_to VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'success',
    error_message TEXT,
    sent_at TIMESTAMP DEFAULT NOW()
);

-- 7. Create indexes
CREATE INDEX IF NOT EXISTS idx_payment_reminders_invoice_id ON payment_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_invoice_id ON reminder_logs(invoice_id);
