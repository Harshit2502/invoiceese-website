-- 009_add_hsn_code_to_products.sql
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(50);
