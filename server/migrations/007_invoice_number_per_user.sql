-- Make invoice_number unique per user instead of globally unique
-- This allows User A and User B to both have INV-001

-- Drop the old global unique constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;

-- Create a composite unique constraint (user_id + invoice_number)
ALTER TABLE invoices ADD CONSTRAINT invoices_user_invoice_number_unique UNIQUE (user_id, invoice_number);
