-- 005_add_inventory_and_purchases.sql

-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100),
    stock_qty INTEGER DEFAULT 0,
    avg_cost DECIMAL(12,2) DEFAULT 0,
    selling_price DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(user_id, name);

-- 2. Create Purchase Invoices Table
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    supplier_name VARCHAR(255) NOT NULL,
    supplier_gst VARCHAR(20),
    invoice_number VARCHAR(100),
    invoice_date DATE,
    total DECIMAL(12,2),
    subtotal DECIMAL(12,2),
    gst_amount DECIMAL(12,2),
    status VARCHAR(50) DEFAULT 'Verified',
    items JSONB DEFAULT '[]'::jsonb,
    pdf_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_user_id ON purchase_invoices(user_id);
