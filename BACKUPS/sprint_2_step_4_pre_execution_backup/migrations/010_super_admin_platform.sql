BEGIN;

-- ============================================================
-- 010_super_admin_platform.sql
-- Super Admin / Platform-Level Enhancements
-- ============================================================
-- Purpose:
--   Extend platform tables for:
--   - College lifecycle management
--   - Module entitlement history
--   - Approval workflow enhancements
--   - Audit severity / correlation
--   - Support access tracking
--
-- Important:
--   This migration does NOT create new business tables.
--   It only extends the existing platform schema.
-- ============================================================


-- ============================================================
-- 1. COLLEGE LIFECYCLE FIELDS
-- ============================================================

ALTER TABLE platform.colleges
    ADD COLUMN IF NOT EXISTS timezone
        text NOT NULL DEFAULT 'UTC';

ALTER TABLE platform.colleges
    ADD COLUMN IF NOT EXISTS activated_at
        timestamptz;

ALTER TABLE platform.colleges
    ADD COLUMN IF NOT EXISTS suspended_at
        timestamptz;

ALTER TABLE platform.colleges
    ADD COLUMN IF NOT EXISTS deactivated_at
        timestamptz;

ALTER TABLE platform.colleges
    ADD COLUMN IF NOT EXISTS archived_at
        timestamptz;

ALTER TABLE platform.colleges
    ADD COLUMN IF NOT EXISTS lifecycle_reason
        text;


-- ============================================================
-- 2. COLLEGE MODULE ENTITLEMENT HISTORY
-- ============================================================

ALTER TABLE platform.college_modules
    ADD COLUMN IF NOT EXISTS effective_from
        timestamptz;

ALTER TABLE platform.college_modules
    ADD COLUMN IF NOT EXISTS effective_to
        timestamptz;

ALTER TABLE platform.college_modules
    ADD COLUMN IF NOT EXISTS change_reason
        text;

ALTER TABLE platform.college_modules
    ADD COLUMN IF NOT EXISTS changed_by
        uuid;


-- ============================================================
-- changed_by FOREIGN KEY
-- ============================================================
-- Safe to rerun.
-- This prevents:
--   ERROR: constraint "fk_college_modules_changed_by"
--   already exists
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_college_modules_changed_by'
          AND conrelid = 'platform.college_modules'::regclass
    ) THEN

        ALTER TABLE platform.college_modules
            ADD CONSTRAINT fk_college_modules_changed_by
            FOREIGN KEY (changed_by)
            REFERENCES app.users(user_id)
            ON DELETE RESTRICT;

    END IF;
END
$$;


-- ============================================================
-- 3. ENTITLEMENT TEMPLATE VERSIONING
-- ============================================================

ALTER TABLE platform.entitlement_templates
    ADD COLUMN IF NOT EXISTS version
        integer NOT NULL DEFAULT 1;

ALTER TABLE platform.entitlement_templates
    ADD COLUMN IF NOT EXISTS is_active
        boolean NOT NULL DEFAULT true;

ALTER TABLE platform.entitlement_templates
    ADD COLUMN IF NOT EXISTS description
        text;


-- ============================================================
-- 4. APPROVAL REQUEST ENHANCEMENTS
-- ============================================================

ALTER TABLE platform.approval_requests
    ADD COLUMN IF NOT EXISTS reason
        text;

ALTER TABLE platform.approval_requests
    ADD COLUMN IF NOT EXISTS snapshot
        jsonb;

ALTER TABLE platform.approval_requests
    ADD COLUMN IF NOT EXISTS expires_at
        timestamptz;

ALTER TABLE platform.approval_requests
    ADD COLUMN IF NOT EXISTS executed_at
        timestamptz;


-- ============================================================
-- 5. APPROVAL STEP ENHANCEMENTS
-- ============================================================

ALTER TABLE platform.approval_steps
    ADD COLUMN IF NOT EXISTS decision_reason
        text;


-- ============================================================
-- 6. AUDIT LOG ENHANCEMENTS
-- ============================================================

ALTER TABLE platform.audit_logs
    ADD COLUMN IF NOT EXISTS reason
        text;

ALTER TABLE platform.audit_logs
    ADD COLUMN IF NOT EXISTS correlation_id
        uuid;

ALTER TABLE platform.audit_logs
    ADD COLUMN IF NOT EXISTS severity
        text NOT NULL DEFAULT 'INFO';


-- ============================================================
-- AUDIT SEVERITY VALIDATION
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_audit_logs_severity'
          AND conrelid = 'platform.audit_logs'::regclass
    ) THEN

        ALTER TABLE platform.audit_logs
            ADD CONSTRAINT chk_audit_logs_severity
            CHECK (
                severity IN (
                    'DEBUG',
                    'INFO',
                    'WARNING',
                    'ERROR',
                    'CRITICAL'
                )
            );

    END IF;
END
$$;


-- ============================================================
-- 7. SUPPORT ACCESS ENHANCEMENTS
-- ============================================================

ALTER TABLE platform.support_access_grants
    ADD COLUMN IF NOT EXISTS ticket_reference
        text;

ALTER TABLE platform.support_access_grants
    ADD COLUMN IF NOT EXISTS approved_at
        timestamptz;

ALTER TABLE platform.support_access_grants
    ADD COLUMN IF NOT EXISTS revoked_at
        timestamptz;


-- ============================================================
-- 8. COLLEGE LIFECYCLE VALIDATION
-- ============================================================

CREATE OR REPLACE FUNCTION platform.validate_college_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

    -- Activated timestamp cannot be after suspension.
    IF NEW.activated_at IS NOT NULL
       AND NEW.suspended_at IS NOT NULL
       AND NEW.activated_at > NEW.suspended_at THEN

        RAISE EXCEPTION
            'College activated_at cannot be later than suspended_at';

    END IF;


    -- Suspension cannot occur after deactivation.
    IF NEW.suspended_at IS NOT NULL
       AND NEW.deactivated_at IS NOT NULL
       AND NEW.suspended_at > NEW.deactivated_at THEN

        RAISE EXCEPTION
            'College suspended_at cannot be later than deactivated_at';

    END IF;


    -- Deactivation cannot occur after archival.
    IF NEW.deactivated_at IS NOT NULL
       AND NEW.archived_at IS NOT NULL
       AND NEW.deactivated_at > NEW.archived_at THEN

        RAISE EXCEPTION
            'College deactivated_at cannot be later than archived_at';

    END IF;


    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_validate_college_lifecycle
ON platform.colleges;

CREATE TRIGGER trg_validate_college_lifecycle
BEFORE INSERT OR UPDATE
ON platform.colleges
FOR EACH ROW
EXECUTE FUNCTION platform.validate_college_lifecycle();


-- ============================================================
-- 9. MODULE EFFECTIVE DATE VALIDATION
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_college_modules_effective_dates'
          AND conrelid = 'platform.college_modules'::regclass
    ) THEN

        ALTER TABLE platform.college_modules
            ADD CONSTRAINT chk_college_modules_effective_dates
            CHECK (
                effective_to IS NULL
                OR effective_from IS NULL
                OR effective_to >= effective_from
            );

    END IF;
END
$$;


-- ============================================================
-- 10. APPROVAL REQUEST EXPIRY VALIDATION
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_approval_requests_expiry'
          AND conrelid = 'platform.approval_requests'::regclass
    ) THEN

       ALTER TABLE platform.approval_requests
ADD CONSTRAINT chk_approval_requests_expiry
CHECK (
    expires_at IS NULL
    OR expires_at >= created_at
);

    END IF;
END
$$;


-- ============================================================
-- 11. APPROVAL SEGREGATION FUNCTION
-- ============================================================
-- Requester and approver must not be the same user.
-- ============================================================

CREATE OR REPLACE FUNCTION platform.validate_approval_segregation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    requester_id uuid;
BEGIN

    SELECT requested_by
    INTO requester_id
    FROM platform.approval_requests
    WHERE request_id = NEW.request_id;

    IF requester_id IS NOT NULL
       AND NEW.approver_user_id = requester_id THEN

        RAISE EXCEPTION
            'Maker-checker violation: requester cannot approve their own request';

    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_validate_approval_segregation
ON platform.approval_steps;

CREATE TRIGGER trg_validate_approval_segregation
BEFORE INSERT OR UPDATE
ON platform.approval_steps
FOR EACH ROW
EXECUTE FUNCTION platform.validate_approval_segregation();


-- ============================================================
-- 12. PREVENT AUDIT LOG MUTATION
-- ============================================================
-- Audit records are immutable after creation.
-- ============================================================

CREATE OR REPLACE FUNCTION platform.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

    RAISE EXCEPTION
        'Audit logs are immutable and cannot be updated or deleted';

END;
$$;


DROP TRIGGER IF EXISTS trg_prevent_audit_log_update
ON platform.audit_logs;

CREATE TRIGGER trg_prevent_audit_log_update
BEFORE UPDATE
ON platform.audit_logs
FOR EACH ROW
EXECUTE FUNCTION platform.prevent_audit_log_mutation();


DROP TRIGGER IF EXISTS trg_prevent_audit_log_delete
ON platform.audit_logs;

CREATE TRIGGER trg_prevent_audit_log_delete
BEFORE DELETE
ON platform.audit_logs
FOR EACH ROW
EXECUTE FUNCTION platform.prevent_audit_log_mutation();


-- ============================================================
-- 13. SUPPORT ACCESS DATE VALIDATION
-- ============================================================

CREATE OR REPLACE FUNCTION platform.validate_support_access_dates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN

    IF NEW.revoked_at IS NOT NULL
       AND NEW.approved_at IS NOT NULL
       AND NEW.revoked_at < NEW.approved_at THEN

        RAISE EXCEPTION
            'Support access revoked_at cannot be earlier than approved_at';

    END IF;

    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS trg_validate_support_access_dates
ON platform.support_access_grants;

CREATE TRIGGER trg_validate_support_access_dates
BEFORE INSERT OR UPDATE
ON platform.support_access_grants
FOR EACH ROW
EXECUTE FUNCTION platform.validate_support_access_dates();


-- ============================================================
-- 14. SUPPORTING INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_colleges_lifecycle
ON platform.colleges (
    status
);

CREATE INDEX IF NOT EXISTS idx_college_modules_effective_dates
ON platform.college_modules (
    college_id,
    effective_from,
    effective_to
);

CREATE INDEX IF NOT EXISTS idx_college_modules_changed_by
ON platform.college_modules (
    changed_by
);

CREATE INDEX IF NOT EXISTS idx_entitlement_templates_active
ON platform.entitlement_templates (
    is_active
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_expires
ON platform.approval_requests (
    expires_at
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_executed
ON platform.approval_requests (
    executed_at
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation
ON platform.audit_logs (
    correlation_id
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity
ON platform.audit_logs (
    severity
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON platform.audit_logs (
    created_at
);

CREATE INDEX IF NOT EXISTS idx_support_access_ticket
ON platform.support_access_grants (
    ticket_reference
);


-- ============================================================
-- 15. COMMENTS
-- ============================================================

COMMENT ON COLUMN platform.colleges.timezone IS
'Primary IANA timezone used for college-local scheduling and display.';

COMMENT ON COLUMN platform.colleges.activated_at IS
'Timestamp when the college became operational.';

COMMENT ON COLUMN platform.colleges.suspended_at IS
'Timestamp when the college was suspended.';

COMMENT ON COLUMN platform.colleges.deactivated_at IS
'Timestamp when the college was deactivated.';

COMMENT ON COLUMN platform.colleges.archived_at IS
'Timestamp when the college was archived.';

COMMENT ON COLUMN platform.colleges.lifecycle_reason IS
'Human-readable reason for the latest lifecycle transition.';


COMMENT ON COLUMN platform.college_modules.effective_from IS
'Timestamp from which the module entitlement becomes effective.';

COMMENT ON COLUMN platform.college_modules.effective_to IS
'Timestamp after which the module entitlement is no longer effective.';

COMMENT ON COLUMN platform.college_modules.change_reason IS
'Reason for changing the college module entitlement.';

COMMENT ON COLUMN platform.college_modules.changed_by IS
'User responsible for the module entitlement change.';


COMMENT ON COLUMN platform.entitlement_templates.version IS
'Version number of the entitlement template.';

COMMENT ON COLUMN platform.entitlement_templates.is_active IS
'Whether this entitlement template version is currently active.';


COMMENT ON COLUMN platform.approval_requests.reason IS
'Reason supplied by the requester for the approval request.';

COMMENT ON COLUMN platform.approval_requests.snapshot IS
'JSON snapshot of important request state at approval creation time.';

COMMENT ON COLUMN platform.approval_requests.expires_at IS
'Timestamp after which the approval request is no longer actionable.';

COMMENT ON COLUMN platform.approval_requests.executed_at IS
'Timestamp when the approved action was actually executed.';


COMMENT ON COLUMN platform.approval_steps.decision_reason IS
'Reason supplied by the approver for the approval decision.';


COMMENT ON COLUMN platform.audit_logs.reason IS
'Reason or business explanation associated with the audited action.';

COMMENT ON COLUMN platform.audit_logs.correlation_id IS
'Correlation identifier used to trace related operations across the system.';

COMMENT ON COLUMN platform.audit_logs.severity IS
'Severity level of the audit event.';


COMMENT ON COLUMN platform.support_access_grants.ticket_reference IS
'Support ticket or service request reference associated with temporary access.';

COMMENT ON COLUMN platform.support_access_grants.approved_at IS
'Timestamp when support access was approved.';

COMMENT ON COLUMN platform.support_access_grants.revoked_at IS
'Timestamp when support access was revoked.';


-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

COMMIT;