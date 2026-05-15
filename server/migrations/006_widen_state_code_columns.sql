-- Widen state_code columns to prevent "value too long" errors
-- State codes are typically 2-digit numbers but users may enter state names by mistake
ALTER TABLE users ALTER COLUMN state_code TYPE VARCHAR(100);
ALTER TABLE invoices ALTER COLUMN client_state_code TYPE VARCHAR(100);
