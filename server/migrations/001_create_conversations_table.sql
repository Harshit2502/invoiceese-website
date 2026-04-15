-- Conversations table (tracks ongoing WhatsApp chats)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    whatsapp_number VARCHAR(20) NOT NULL,
    state VARCHAR(50) DEFAULT 'idle',
    data JSONB DEFAULT '{}',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, whatsapp_number)
);

-- Invoices table (updated schema with CGST/SGST/IGST split)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    client_gst VARCHAR(15),
    service_description TEXT,
    subtotal DECIMAL(12, 2),
    cgst DECIMAL(12, 2),
    sgst DECIMAL(12, 2),
    igst DECIMAL(12, 2),
    gst_rate DECIMAL(5, 2) DEFAULT 18,
    gst_amount DECIMAL(12, 2),
    total DECIMAL(12, 2) NOT NULL,
    gst_type VARCHAR(20),
    pdf_url TEXT,
    status VARCHAR(20) DEFAULT 'unpaid',
    invoice_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp ON conversations(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);
