-- ============================================================
-- 015_audit_logs_tamper_evidence.sql
-- Module 14: Audit Log / Activity Log Enhancements
-- Adds correlation, result status, export approval requests,
-- hash-chaining for tamper evidence, and separate platform event categorization.
-- ============================================================

-- 1. Enhance platform.audit_logs with Module 14 fields
ALTER TABLE platform.audit_logs
    ADD COLUMN IF NOT EXISTS result_status varchar(50) NOT NULL DEFAULT 'SUCCESS',
    ADD COLUMN IF NOT EXISTS error_code varchar(100),
    ADD COLUMN IF NOT EXISTS ticket_reference varchar(100),
    ADD COLUMN IF NOT EXISTS approval_reference varchar(100),
    ADD COLUMN IF NOT EXISTS current_hash varchar(64),
    ADD COLUMN IF NOT EXISTS previous_hash varchar(64);

-- 2. Audit Export Requests (for controlled bulk exports with approval)
CREATE TABLE IF NOT EXISTS platform.audit_export_requests (
    request_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_user_id   uuid NOT NULL REFERENCES app.users(user_id) ON DELETE CASCADE,
    requester_role      varchar(50) NOT NULL DEFAULT 'SUPER_ADMIN',
    filters             jsonb NOT NULL,
    record_count        int NOT NULL DEFAULT 0,
    status              varchar(50) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, EXPORTED
    reason              text NOT NULL,
    approver_user_id    uuid REFERENCES app.users(user_id) ON DELETE SET NULL,
    approved_at         timestamptz,
    export_url          text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform.audit_export_requests IS
'Controlled bulk export requests for platform audit records with mandatory peer Super Admin approval.';

-- 3. Indexes for high-speed audit searching
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON platform.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_result_status ON platform.audit_logs(result_status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON platform.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ticket ON platform.audit_logs(ticket_reference);
CREATE INDEX IF NOT EXISTS idx_audit_export_requests_status ON platform.audit_export_requests(status);

-- 4. Initial backfill hash for existing audit records to ensure integrity validation baseline
UPDATE platform.audit_logs
SET current_hash = encode(sha256(concat(audit_id::text, module, action, created_at::text)::bytea), 'hex')
WHERE current_hash IS NULL;
