-- Add state and state code for businesses
ALTER TABLE users ADD COLUMN IF NOT EXISTS state VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS state_code VARCHAR(10);

-- Add GST fields for invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reverse_charge BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS transport_mode VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vehicle_number VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS date_of_supply DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_state VARCHAR(100);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS client_state_code VARCHAR(10);
