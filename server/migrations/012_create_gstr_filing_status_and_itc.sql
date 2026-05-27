-- 012_create_gstr_filing_status_and_itc.sql

-- 1. Add itc_eligibility column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS itc_eligibility VARCHAR(50) DEFAULT 'inputs';

-- 2. Add itc_eligibility column to invoices table (legacy)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS itc_eligibility VARCHAR(50) DEFAULT 'inputs';

-- 3. Create gstr_filing_status table
CREATE TABLE IF NOT EXISTS gstr_filing_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    filing_month VARCHAR(7) NOT NULL, -- e.g., '2026-04'
    arn VARCHAR(50),
    filed_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'filed',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, filing_month)
);

-- 4. Create index for performance
CREATE INDEX IF NOT EXISTS idx_gstr_filing_status_user_id ON gstr_filing_status(user_id);
