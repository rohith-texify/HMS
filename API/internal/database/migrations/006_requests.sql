-- ============================================================
-- HMS DATABASE
-- Migration: 006_requests.sql
-- Module: Requests / Leave / Gate Pass / Visitors / Parcels
--
-- PURPOSE
--   Creates the complete student request workflow:
--     1. Leave requests
--     2. Leave approvals
--     3. Leave verification
--     4. Gate passes
--     5. Gate-pass verification
--     6. Visitor requests
--     7. Visitors
--     8. Visitor visits
--     9. Parcels
--
-- DESIGN RULES
--   - UUID primary keys
--   - Every college-owned record carries college_id
--   - History is retained
--   - Operational records use status fields
--   - Foreign keys use ON DELETE RESTRICT
--   - UTC timestamps
--   - Tenant consistency enforced with triggers
-- ============================================================

BEGIN;

-- ============================================================
-- 1. LEAVE REQUESTS
-- ============================================================

CREATE TABLE app.leave_requests (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    student_id uuid NOT NULL,

    leave_type varchar(30) NOT NULL
        CHECK (
            leave_type IN (
                'DAY_LEAVE',
                'OVERNIGHT',
                'WEEKEND',
                'EMERGENCY',
                'MEDICAL',
                'OTHER'
            )
        ),

    reason text NOT NULL,

    from_date date NOT NULL,
    to_date date NOT NULL,

    from_time time,
    to_time time,

    destination text,
    contact_phone varchar(30),

    status varchar(30) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'DRAFT',
                'PENDING',
                'APPROVED',
                'REJECTED',
                'CANCELLED',
                'COMPLETED',
                'EXPIRED'
            )
        ),

    requested_at timestamptz NOT NULL DEFAULT now(),
    approved_at timestamptz,
    rejected_at timestamptz,
    cancelled_at timestamptz,
    completed_at timestamptz,

    created_by uuid NOT NULL,
    updated_by uuid,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_leave_requests_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_leave_requests_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_leave_requests_created_by
        FOREIGN KEY (created_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_leave_requests_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_leave_requests_date_range
        CHECK (to_date >= from_date)
);

-- ============================================================
-- 2. LEAVE APPROVALS
-- ============================================================

CREATE TABLE app.leave_approvals (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    leave_request_id uuid NOT NULL,

    approval_level integer NOT NULL
        CHECK (approval_level > 0),

    approver_user_id uuid NOT NULL,

    decision varchar(20) NOT NULL DEFAULT 'PENDING'
        CHECK (
            decision IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            )
        ),

    remarks text,

    decided_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_leave_approvals_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_leave_approvals_request
        FOREIGN KEY (leave_request_id)
        REFERENCES app.leave_requests(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_leave_approvals_approver
        FOREIGN KEY (approver_user_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_leave_approval_level
        UNIQUE (leave_request_id, approval_level)
);

-- ============================================================
-- 3. LEAVE VERIFICATION LOGS
-- ============================================================

CREATE TABLE app.leave_verification_logs (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    leave_request_id uuid NOT NULL,

    verification_type varchar(30) NOT NULL
        CHECK (
            verification_type IN (
                'SECURITY',
                'WARDEN',
                'INCHARGE',
                'ADMIN',
                'SYSTEM'
            )
        ),

    verified_by uuid,
    verification_status varchar(20) NOT NULL
        CHECK (
            verification_status IN (
                'PENDING',
                'VERIFIED',
                'REJECTED'
            )
        ),

    remarks text,

    verified_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_leave_verification_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_leave_verification_request
        FOREIGN KEY (leave_request_id)
        REFERENCES app.leave_requests(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_leave_verification_user
        FOREIGN KEY (verified_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT
);

-- ============================================================
-- 4. GATE PASSES
-- ============================================================

CREATE TABLE app.gate_passes (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    student_id uuid NOT NULL,

    leave_request_id uuid,

    pass_number varchar(50) NOT NULL,

    valid_from timestamptz NOT NULL,
    valid_until timestamptz NOT NULL,

    status varchar(25) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'DRAFT',
                'ACTIVE',
                'USED',
                'EXPIRED',
                'CANCELLED',
                'REVOKED'
            )
        ),

    qr_value text,

    issued_by uuid NOT NULL,
    issued_at timestamptz NOT NULL DEFAULT now(),

    cancelled_by uuid,
    cancelled_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_gate_passes_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_gate_passes_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_gate_passes_leave_request
        FOREIGN KEY (leave_request_id)
        REFERENCES app.leave_requests(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_gate_passes_issued_by
        FOREIGN KEY (issued_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_gate_passes_cancelled_by
        FOREIGN KEY (cancelled_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_gate_pass_number
        UNIQUE (college_id, pass_number),

    CONSTRAINT chk_gate_pass_validity
        CHECK (valid_until > valid_from)
);

-- ============================================================
-- 5. GATE PASS VERIFICATIONS
-- ============================================================

CREATE TABLE app.gate_pass_verifications (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    gate_pass_id uuid NOT NULL,
    gate_id uuid NOT NULL,

    verification_type varchar(25) NOT NULL
        CHECK (
            verification_type IN (
                'QR',
                'MANUAL',
                'CARD',
                'SYSTEM'
            )
        ),

    verification_status varchar(20) NOT NULL
        CHECK (
            verification_status IN (
                'VALID',
                'INVALID',
                'EXPIRED',
                'REVOKED',
                'ALREADY_USED'
            )
        ),

    verified_by uuid,

    verified_at timestamptz NOT NULL DEFAULT now(),

    remarks text,

    CONSTRAINT fk_gate_pass_verifications_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_gate_pass_verifications_pass
        FOREIGN KEY (gate_pass_id)
        REFERENCES app.gate_passes(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_gate_pass_verifications_gate
        FOREIGN KEY (gate_id)
        REFERENCES app.gates(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_gate_pass_verifications_user
        FOREIGN KEY (verified_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT
);

-- ============================================================
-- 6. VISITOR REQUESTS
-- ============================================================

CREATE TABLE app.visitor_requests (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    student_id uuid NOT NULL,

    visitor_name varchar(200) NOT NULL,
    visitor_phone varchar(30),
    visitor_email varchar(320),

    relationship varchar(100),

    purpose text NOT NULL,

    requested_visit_date date NOT NULL,
    requested_from_time time,
    requested_to_time time,

    status varchar(25) NOT NULL DEFAULT 'PENDING'
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'CANCELLED',
                'COMPLETED',
                'EXPIRED'
            )
        ),

    requested_by uuid NOT NULL,

    approved_by uuid,
    approved_at timestamptz,

    remarks text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_visitor_requests_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_visitor_requests_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_visitor_requests_requested_by
        FOREIGN KEY (requested_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_visitor_requests_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_visitor_request_time
        CHECK (
            requested_to_time IS NULL
            OR requested_from_time IS NULL
            OR requested_to_time > requested_from_time
        )
);

-- ============================================================
-- 7. VISITORS
-- ============================================================

CREATE TABLE app.visitors (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,

    full_name varchar(200) NOT NULL,
    phone varchar(30),
    email varchar(320),

    identity_type varchar(30),
    identity_number varchar(100),

    address text,

    status varchar(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'BLOCKED',
                'INACTIVE'
            )
        ),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_visitors_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT
);

-- ============================================================
-- 8. VISITOR VISITS
-- ============================================================

CREATE TABLE app.visitor_visits (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,

    visitor_id uuid NOT NULL,
    visitor_request_id uuid,

    student_id uuid NOT NULL,
    gate_id uuid,

    purpose text,

    check_in_at timestamptz,
    check_out_at timestamptz,

    status varchar(25) NOT NULL DEFAULT 'EXPECTED'
        CHECK (
            status IN (
                'EXPECTED',
                'CHECKED_IN',
                'CHECKED_OUT',
                'CANCELLED',
                'DENIED',
                'EXPIRED'
            )
        ),

    verified_by uuid,

    remarks text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_visitor_visits_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_visitor_visits_visitor
        FOREIGN KEY (visitor_id)
        REFERENCES app.visitors(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_visitor_visits_request
        FOREIGN KEY (visitor_request_id)
        REFERENCES app.visitor_requests(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_visitor_visits_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_visitor_visits_gate
        FOREIGN KEY (gate_id)
        REFERENCES app.gates(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_visitor_visits_verified_by
        FOREIGN KEY (verified_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_visitor_checkout
        CHECK (
            check_out_at IS NULL
            OR check_in_at IS NULL
            OR check_out_at >= check_in_at
        )
);

-- ============================================================
-- 9. PARCELS
-- ============================================================

CREATE TABLE app.parcels (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    student_id uuid NOT NULL,

    tracking_number varchar(150),
    sender_name varchar(200),
    sender_phone varchar(30),

    courier_name varchar(150),

    received_at timestamptz NOT NULL DEFAULT now(),

    collected_at timestamptz,
    collected_by uuid,

    status varchar(25) NOT NULL DEFAULT 'RECEIVED'
        CHECK (
            status IN (
                'RECEIVED',
                'NOTIFIED',
                'READY_FOR_COLLECTION',
                'COLLECTED',
                'RETURNED',
                'LOST'
            )
        ),

    description text,
    remarks text,

    created_by uuid NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_parcels_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_parcels_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_parcels_collected_by
        FOREIGN KEY (collected_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_parcels_created_by
        FOREIGN KEY (created_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT
);

-- ============================================================
-- TENANT CONSISTENCY VALIDATION
-- ============================================================

CREATE OR REPLACE FUNCTION app.validate_requests_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    related_college_id uuid;
BEGIN

    IF TG_TABLE_NAME = 'leave_requests' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.students
        WHERE id = NEW.student_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in leave_requests';
        END IF;

    ELSIF TG_TABLE_NAME = 'leave_approvals' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.leave_requests
        WHERE id = NEW.leave_request_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in leave_approvals';
        END IF;

    ELSIF TG_TABLE_NAME = 'leave_verification_logs' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.leave_requests
        WHERE id = NEW.leave_request_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in leave_verification_logs';
        END IF;

    ELSIF TG_TABLE_NAME = 'gate_passes' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.students
        WHERE id = NEW.student_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in gate_passes';
        END IF;

    ELSIF TG_TABLE_NAME = 'gate_pass_verifications' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.gate_passes
        WHERE id = NEW.gate_pass_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in gate_pass_verifications';
        END IF;

    ELSIF TG_TABLE_NAME = 'visitor_requests' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.students
        WHERE id = NEW.student_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in visitor_requests';
        END IF;

    ELSIF TG_TABLE_NAME = 'visitors' THEN

        NULL;

    ELSIF TG_TABLE_NAME = 'visitor_visits' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.visitors
        WHERE id = NEW.visitor_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in visitor_visits';
        END IF;

    ELSIF TG_TABLE_NAME = 'parcels' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.students
        WHERE id = NEW.student_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in parcels';
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

-- ============================================================
-- TENANT CONSISTENCY TRIGGERS
-- ============================================================

CREATE TRIGGER trg_validate_leave_requests_tenant
BEFORE INSERT OR UPDATE ON app.leave_requests
FOR EACH ROW
EXECUTE FUNCTION app.validate_requests_tenant_consistency();

CREATE TRIGGER trg_validate_leave_approvals_tenant
BEFORE INSERT OR UPDATE ON app.leave_approvals
FOR EACH ROW
EXECUTE FUNCTION app.validate_requests_tenant_consistency();

CREATE TRIGGER trg_validate_leave_verification_tenant
BEFORE INSERT OR UPDATE ON app.leave_verification_logs
FOR EACH ROW
EXECUTE FUNCTION app.validate_requests_tenant_consistency();

CREATE TRIGGER trg_validate_gate_passes_tenant
BEFORE INSERT OR UPDATE ON app.gate_passes
FOR EACH ROW
EXECUTE FUNCTION app.validate_requests_tenant_consistency();

CREATE TRIGGER trg_validate_gate_pass_verifications_tenant
BEFORE INSERT OR UPDATE ON app.gate_pass_verifications
FOR EACH ROW
EXECUTE FUNCTION app.validate_requests_tenant_consistency();

CREATE TRIGGER trg_validate_visitor_requests_tenant
BEFORE INSERT OR UPDATE ON app.visitor_requests
FOR EACH ROW
EXECUTE FUNCTION app.validate_requests_tenant_consistency();

CREATE TRIGGER trg_validate_visitor_visits_tenant
BEFORE INSERT OR UPDATE ON app.visitor_visits
FOR EACH ROW
EXECUTE FUNCTION app.validate_requests_tenant_consistency();

CREATE TRIGGER trg_validate_parcels_tenant
BEFORE INSERT OR UPDATE ON app.parcels
FOR EACH ROW
EXECUTE FUNCTION app.validate_requests_tenant_consistency();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_leave_requests_college_status
    ON app.leave_requests (college_id, status);

CREATE INDEX idx_leave_requests_student
    ON app.leave_requests (student_id, requested_at DESC);

CREATE INDEX idx_leave_approvals_request
    ON app.leave_approvals (leave_request_id, approval_level);

CREATE INDEX idx_leave_approvals_pending
    ON app.leave_approvals (college_id, decision);

CREATE INDEX idx_leave_verification_request
    ON app.leave_verification_logs (leave_request_id, created_at DESC);

CREATE INDEX idx_gate_passes_student_status
    ON app.gate_passes (student_id, status);

CREATE INDEX idx_gate_passes_validity
    ON app.gate_passes (college_id, valid_from, valid_until);

CREATE INDEX idx_gate_pass_verifications_pass
    ON app.gate_pass_verifications (gate_pass_id, verified_at DESC);

CREATE INDEX idx_visitor_requests_college_status
    ON app.visitor_requests (college_id, status);

CREATE INDEX idx_visitor_requests_student
    ON app.visitor_requests (student_id, requested_visit_date);

CREATE INDEX idx_visitors_college
    ON app.visitors (college_id, full_name);

CREATE INDEX idx_visitor_visits_student
    ON app.visitor_visits (student_id, created_at DESC);

CREATE INDEX idx_visitor_visits_status
    ON app.visitor_visits (college_id, status);

CREATE INDEX idx_parcels_student_status
    ON app.parcels (student_id, status);

CREATE INDEX idx_parcels_college_status
    ON app.parcels (college_id, status);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE app.leave_requests IS
'Student leave requests and their lifecycle.';

COMMENT ON TABLE app.leave_approvals IS
'Approval decisions associated with leave requests.';

COMMENT ON TABLE app.leave_verification_logs IS
'Operational verification history for leave requests.';

COMMENT ON TABLE app.gate_passes IS
'Issued gate passes associated with student movement/leave.';

COMMENT ON TABLE app.gate_pass_verifications IS
'Gate-level verification history for gate passes.';

COMMENT ON TABLE app.visitor_requests IS
'Student visitor requests before an actual visit occurs.';

COMMENT ON TABLE app.visitors IS
'Visitor master records for the college.';

COMMENT ON TABLE app.visitor_visits IS
'Actual visitor entry and exit activity.';

COMMENT ON TABLE app.parcels IS
'Parcel records received for students.';

COMMIT;