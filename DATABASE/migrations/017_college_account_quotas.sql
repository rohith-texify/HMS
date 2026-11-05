-- ============================================================================
-- Migration 017: College Account Quotas & Provisioning Limits
-- Adds configurable account creation ceilings for College Incharges, Students,
-- Parents, and Campus Security personnel per institutional tenant.
-- ============================================================================

BEGIN;

ALTER TABLE platform.colleges ADD COLUMN IF NOT EXISTS max_incharges INT NOT NULL DEFAULT 5;
ALTER TABLE platform.colleges ADD COLUMN IF NOT EXISTS max_students INT NOT NULL DEFAULT 500;
ALTER TABLE platform.colleges ADD COLUMN IF NOT EXISTS max_parents INT NOT NULL DEFAULT 500;
ALTER TABLE platform.colleges ADD COLUMN IF NOT EXISTS max_security INT NOT NULL DEFAULT 10;

COMMENT ON COLUMN platform.colleges.max_incharges IS 'Maximum number of Hostel In-Charge accounts allowed for this institution.';
COMMENT ON COLUMN platform.colleges.max_students IS 'Maximum number of residential student accounts allowed for this institution.';
COMMENT ON COLUMN platform.colleges.max_parents IS 'Maximum number of registered parent accounts allowed for this institution.';
COMMENT ON COLUMN platform.colleges.max_security IS 'Maximum number of campus security guard accounts allowed for this institution.';

COMMIT;
