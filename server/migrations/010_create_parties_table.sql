-- 010_create_parties_table.sql

-- 1. Create parties table
CREATE TABLE IF NOT EXISTS parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    gst VARCHAR(20),
    address TEXT,
    mobile VARCHAR(20),
    state VARCHAR(100),
    state_code VARCHAR(100),
    type VARCHAR(20), -- 'vendor', 'client', or 'both'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- 2. Trigger function to auto-create contact/party on doc insertion/update
CREATE OR REPLACE FUNCTION auto_create_party_on_document()
RETURNS TRIGGER AS $$
DECLARE
    doc_count INTEGER;
    party_type VARCHAR(20);
BEGIN
    -- Only proceed if party_name is provided and not empty
    IF NEW.party_name IS NULL OR NEW.party_name = '' THEN
        RETURN NEW;
    END IF;

    -- Count how many documents this user has with this party_name
    SELECT COUNT(*) INTO doc_count
    FROM documents
    WHERE user_id = NEW.user_id AND LOWER(party_name) = LOWER(NEW.party_name);

    -- If count is >= 2, upsert into parties table
    IF doc_count >= 2 THEN
        -- Determine type based on doc_type or direction
        IF NEW.direction = 'inbound' THEN
            party_type := 'vendor';
        ELSE
            party_type := 'client';
        END IF;

        INSERT INTO parties (id, user_id, name, gst, address, mobile, state, state_code, type, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            NEW.user_id,
            NEW.party_name,
            NEW.party_gst,
            NEW.party_address,
            NEW.party_mobile,
            NEW.party_state,
            NEW.party_state_code,
            party_type,
            NOW(),
            NOW()
        )
        ON CONFLICT (user_id, name) DO UPDATE SET
            gst = COALESCE(EXCLUDED.gst, parties.gst),
            address = COALESCE(EXCLUDED.address, parties.address),
            mobile = COALESCE(EXCLUDED.mobile, parties.mobile),
            state = COALESCE(EXCLUDED.state, parties.state),
            state_code = COALESCE(EXCLUDED.state_code, parties.state_code),
            type = CASE 
                WHEN parties.type != EXCLUDED.type THEN 'both'
                ELSE parties.type
            END,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS trigger_auto_create_party ON documents;
CREATE TRIGGER trigger_auto_create_party
AFTER INSERT OR UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION auto_create_party_on_document();

-- 4. Backfill existing recurring parties/vendors (count >= 2)
INSERT INTO parties (id, user_id, name, gst, address, mobile, state, state_code, type, created_at, updated_at)
SELECT 
    gen_random_uuid(),
    user_id,
    party_name,
    MAX(party_gst) as gst,
    MAX(party_address) as address,
    MAX(party_mobile) as mobile,
    MAX(party_state) as state,
    MAX(party_state_code) as state_code,
    CASE 
        WHEN MIN(direction) != MAX(direction) THEN 'both'
        WHEN MAX(direction) = 'inbound' THEN 'vendor'
        ELSE 'client'
    END as type,
    NOW(),
    NOW()
FROM documents
WHERE party_name IS NOT NULL AND party_name != ''
GROUP BY user_id, party_name
HAVING COUNT(*) >= 2
ON CONFLICT (user_id, name) DO NOTHING;
