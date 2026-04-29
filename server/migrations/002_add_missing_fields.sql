-- Add missing fields for users
ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS template_style VARCHAR(50) DEFAULT 'modern';
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_watermark BOOLEAN DEFAULT true;

-- Add missing fields for invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_details JSONB;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
