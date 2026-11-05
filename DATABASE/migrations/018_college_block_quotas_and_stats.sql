-- ============================================================================
-- Migration 018: College Block Quotas and Composite Indexes
-- Adds configurable max_blocks ceiling per institutional tenant and composite
-- indexes for high-concurrency active quota lookups and college monitoring.
-- ============================================================================

BEGIN;

ALTER TABLE platform.colleges ADD COLUMN IF NOT EXISTS max_blocks INT NOT NULL DEFAULT 5;

COMMENT ON COLUMN platform.colleges.max_blocks IS 'Maximum number of physical hostel blocks permitted for this institution.';

CREATE INDEX IF NOT EXISTS idx_blocks_college_status ON app.blocks (college_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_college_status ON app.complaints (college_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_events_college_time ON platform.login_events (college_id, event_at DESC);

COMMIT;
