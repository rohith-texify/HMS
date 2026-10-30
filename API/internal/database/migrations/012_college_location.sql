-- ============================================================
-- 012_college_location.sql
-- Add granular administrative location codes to platform.colleges
-- ============================================================

ALTER TABLE platform.colleges
    ADD COLUMN IF NOT EXISTS location_type    VARCHAR(20) DEFAULT 'URBAN',
    ADD COLUMN IF NOT EXISTS state_code      VARCHAR(10),
    ADD COLUMN IF NOT EXISTS district_code   VARCHAR(20),
    ADD COLUMN IF NOT EXISTS subdistrict_code VARCHAR(20),
    ADD COLUMN IF NOT EXISTS block_code      VARCHAR(20),
    ADD COLUMN IF NOT EXISTS city_code       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS ward_code       VARCHAR(20),
    ADD COLUMN IF NOT EXISTS village_code    VARCHAR(20),
    ADD COLUMN IF NOT EXISTS campus_locality TEXT;

-- Indexes for location lookup on colleges
CREATE INDEX IF NOT EXISTS idx_colleges_district_code ON platform.colleges(district_code);
CREATE INDEX IF NOT EXISTS idx_colleges_city_code ON platform.colleges(city_code);
