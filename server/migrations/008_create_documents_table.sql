-- 008_create_documents_table.sql

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Document classification
    doc_type VARCHAR(30) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    parent_document_id UUID REFERENCES documents(id),
    
    -- Numbering (unique per user + doc_type)
    doc_number VARCHAR(50) NOT NULL,
    
    -- Party info
    party_name VARCHAR(255) NOT NULL,
    party_gst VARCHAR(20),
    party_address TEXT,
    party_mobile VARCHAR(20),
    party_state VARCHAR(100),
    party_state_code VARCHAR(100),
    
    -- GST transport fields
    reverse_charge BOOLEAN DEFAULT false,
    transport_mode VARCHAR(100),
    vehicle_number VARCHAR(100),
    date_of_supply DATE,
    place_of_supply VARCHAR(255),
    
    -- Financial
    items JSONB DEFAULT '[]',
    subtotal DECIMAL(12,2),
    gst_rate DECIMAL(5,2) DEFAULT 0,
    gst_amount DECIMAL(12,2) DEFAULT 0,
    cgst DECIMAL(12,2) DEFAULT 0,
    sgst DECIMAL(12,2) DEFAULT 0,
    igst DECIMAL(12,2) DEFAULT 0,
    gst_type VARCHAR(20),
    total DECIMAL(12,2) NOT NULL,
    
    -- Metadata
    service_description TEXT,
    notes TEXT,
    due_date DATE,
    doc_date DATE,
    payment_details JSONB,
    pdf_url TEXT,
    status VARCHAR(20) DEFAULT 'draft',
    template_style VARCHAR(50) DEFAULT 'modern',
    show_watermark BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Unique doc number per user per type
    UNIQUE(user_id, doc_type, doc_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(user_id, doc_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);

-- Migrate existing sales invoices
INSERT INTO documents (
    id, user_id, doc_type, direction, doc_number, party_name, party_gst, party_address, party_mobile, 
    party_state, party_state_code, reverse_charge, transport_mode, vehicle_number, date_of_supply, 
    place_of_supply, items, subtotal, gst_rate, gst_amount, cgst, sgst, igst, gst_type, total, 
    service_description, notes, due_date, doc_date, payment_details, pdf_url, status, created_at, updated_at
)
SELECT 
    id, user_id, 'sales_invoice', 'outbound', invoice_number, client_name, client_gst, client_address, client_mobile, 
    client_state, client_state_code, reverse_charge, transport_mode, vehicle_number, date_of_supply, 
    place_of_supply, items, subtotal, gst_rate, gst_amount, cgst, sgst, igst, gst_type, total, 
    service_description, notes, due_date, invoice_date, payment_details, pdf_url, status, created_at, updated_at
FROM invoices
ON CONFLICT DO NOTHING;

-- Migrate existing purchase invoices
INSERT INTO documents (
    id, user_id, doc_type, direction, doc_number, party_name, party_gst, items, subtotal, 
    gst_amount, total, pdf_url, status, doc_date, created_at, updated_at
)
SELECT 
    id, user_id, 'purchase_invoice', 'inbound', COALESCE(invoice_number, 'PI-' || EXTRACT(EPOCH FROM created_at)::text), 
    supplier_name, supplier_gst, items, subtotal, gst_amount, total, pdf_url, status, invoice_date, created_at, updated_at
FROM purchase_invoices
ON CONFLICT DO NOTHING;
