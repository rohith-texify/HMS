-- ============================================================
-- 013_default_ist_timezone.sql
-- Standardize entire platform to Indian Standard Time (IST - Asia/Kolkata)
-- ============================================================

ALTER TABLE platform.colleges 
    ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata';

UPDATE platform.colleges 
SET timezone = 'Asia/Kolkata' 
WHERE timezone = 'UTC' OR timezone IS NULL OR timezone = '';
