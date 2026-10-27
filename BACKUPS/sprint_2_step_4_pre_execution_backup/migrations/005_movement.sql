-- ============================================================
-- HMS DATABASE
-- Migration: 005_movement.sql
-- Domain: Attendance & Movement
--
-- Creates:
--   1. attendance_cards
--   2. attendance_records
--   3. entry_exit_records
--   4. record_corrections
--
-- Design:
--   - UUID primary keys
--   - College/tenant isolation
--   - Historical attendance and movement records retained
--   - Corrections are recorded separately
--   - No important operational record is hard deleted
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ATTENDANCE CARDS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.attendance_cards (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    student_id          uuid NOT NULL,

    card_number         citext NOT NULL,
    qr_value            text,

    status              varchar(20) NOT NULL DEFAULT 'ACTIVE',

    issued_at           timestamptz NOT NULL DEFAULT now(),
    expiry_at           timestamptz,

    replaced_by_card_id uuid,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_attendance_cards_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_cards_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_cards_replaced_by
        FOREIGN KEY (replaced_by_card_id)
        REFERENCES app.attendance_cards(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_attendance_cards_number
        UNIQUE (college_id, card_number),

    CONSTRAINT uq_attendance_cards_qr
        UNIQUE (college_id, qr_value),

    CONSTRAINT chk_attendance_cards_status
        CHECK (
            status IN (
                'ACTIVE',
                'BLOCKED',
                'LOST',
                'EXPIRED',
                'REPLACED'
            )
        ),

    CONSTRAINT chk_attendance_cards_expiry
        CHECK (
            expiry_at IS NULL
            OR expiry_at >= issued_at
        )
);

COMMENT ON TABLE app.attendance_cards IS
'QR/barcode attendance cards issued to students. Card history is retained.';


-- ============================================================
-- 2. ATTENDANCE RECORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.attendance_records (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    student_id          uuid NOT NULL,
    card_id             uuid,

    attendance_date     date NOT NULL,
    recorded_at         timestamptz NOT NULL DEFAULT now(),

    status              varchar(20) NOT NULL,

    scan_method         varchar(20) NOT NULL DEFAULT 'MANUAL',

    recorded_by         uuid,

    is_corrected        boolean NOT NULL DEFAULT false,

    remarks             text,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_attendance_records_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_records_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_records_card
        FOREIGN KEY (card_id)
        REFERENCES app.attendance_cards(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_attendance_records_recorded_by
        FOREIGN KEY (recorded_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_attendance_records_status
        CHECK (
            status IN (
                'PRESENT',
                'ABSENT',
                'LATE',
                'ON_LEAVE',
                'EXCUSED',
                'HOLIDAY'
            )
        ),

    CONSTRAINT chk_attendance_records_scan_method
        CHECK (
            scan_method IN (
                'QR',
                'BARCODE',
                'MANUAL',
                'SYSTEM'
            )
        ),

    CONSTRAINT uq_attendance_records_student_date
        UNIQUE (college_id, student_id, attendance_date)
);

COMMENT ON TABLE app.attendance_records IS
'Daily hostel attendance record for each student.';

COMMENT ON COLUMN app.attendance_records.is_corrected IS
'Indicates that the original attendance was modified through the correction workflow.';


-- ============================================================
-- 3. ENTRY / EXIT RECORDS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.entry_exit_records (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,

    student_id          uuid NOT NULL,
    card_id             uuid,
    gate_id             uuid NOT NULL,

    movement_type       varchar(10) NOT NULL,

    recorded_at         timestamptz NOT NULL DEFAULT now(),

    verification_method varchar(20) NOT NULL DEFAULT 'MANUAL',

    recorded_by         uuid,

    remarks             text,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_entry_exit_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_entry_exit_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_entry_exit_card
        FOREIGN KEY (card_id)
        REFERENCES app.attendance_cards(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_entry_exit_gate
        FOREIGN KEY (gate_id)
        REFERENCES app.gates(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_entry_exit_recorded_by
        FOREIGN KEY (recorded_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_entry_exit_movement_type
        CHECK (
            movement_type IN (
                'ENTRY',
                'EXIT'
            )
        ),

    CONSTRAINT chk_entry_exit_verification
        CHECK (
            verification_method IN (
                'MANUAL',
                'CARD',
                'QR',
                'BIOMETRIC',
                'SYSTEM'
            )
        )
);

COMMENT ON TABLE app.entry_exit_records IS
'Every student gate movement scan. This is the single source for gate movement history.';


-- ============================================================
-- 4. RECORD CORRECTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.record_corrections (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,

    record_type         varchar(50) NOT NULL,
    record_id           uuid NOT NULL,

    requested_by        uuid NOT NULL,
    approved_by         uuid,

    correction_reason   text NOT NULL,

    old_values          jsonb NOT NULL,
    new_values          jsonb NOT NULL,

    status              varchar(20) NOT NULL DEFAULT 'PENDING',

    requested_at        timestamptz NOT NULL DEFAULT now(),
    decided_at          timestamptz,

    decision_reason     text,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_record_corrections_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_record_corrections_requested_by
        FOREIGN KEY (requested_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_record_corrections_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_record_corrections_record_type
        CHECK (
            record_type IN (
                'ATTENDANCE',
                'ENTRY_EXIT'
            )
        ),

    CONSTRAINT chk_record_corrections_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_record_corrections_reason
        CHECK (
            length(trim(correction_reason)) > 0
        )
);

COMMENT ON TABLE app.record_corrections IS
'Controlled correction workflow for attendance and movement records.';


-- ============================================================
-- TENANT CONSISTENCY FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION app.validate_movement_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    referenced_college_id uuid;
BEGIN

    -- ========================================================
    -- ATTENDANCE CARD
    -- ========================================================

    IF TG_TABLE_NAME = 'attendance_cards' THEN

        SELECT college_id
        INTO referenced_college_id
        FROM app.students
        WHERE id = NEW.student_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Student % does not exist',
                NEW.student_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Student % and attendance card belong to different colleges',
                NEW.student_id;
        END IF;

    END IF;


    -- ========================================================
    -- ATTENDANCE RECORD
    -- ========================================================

    IF TG_TABLE_NAME = 'attendance_records' THEN

        SELECT college_id
        INTO referenced_college_id
        FROM app.students
        WHERE id = NEW.student_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Student % does not exist',
                NEW.student_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Student % and attendance record belong to different colleges',
                NEW.student_id;
        END IF;


        IF NEW.card_id IS NOT NULL THEN

            SELECT college_id
            INTO referenced_college_id
            FROM app.attendance_cards
            WHERE id = NEW.card_id;

            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION
                    'Attendance card % does not exist',
                    NEW.card_id;
            END IF;

            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Attendance card % and attendance record belong to different colleges',
                    NEW.card_id;
            END IF;

        END IF;

    END IF;


    -- ========================================================
    -- ENTRY / EXIT
    -- ========================================================

    IF TG_TABLE_NAME = 'entry_exit_records' THEN

        SELECT college_id
        INTO referenced_college_id
        FROM app.students
        WHERE id = NEW.student_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Student % does not exist',
                NEW.student_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Student % and movement record belong to different colleges',
                NEW.student_id;
        END IF;


        IF NEW.card_id IS NOT NULL THEN

            SELECT college_id
            INTO referenced_college_id
            FROM app.attendance_cards
            WHERE id = NEW.card_id;

            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION
                    'Attendance card % does not exist',
                    NEW.card_id;
            END IF;

            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Attendance card % and movement record belong to different colleges',
                    NEW.card_id;
            END IF;

        END IF;


        SELECT college_id
        INTO referenced_college_id
        FROM app.gates
        WHERE id = NEW.gate_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Gate % does not exist',
                NEW.gate_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Gate % and movement record belong to different colleges',
                NEW.gate_id;
        END IF;

    END IF;


    RETURN NEW;
END;
$$;


-- ============================================================
-- TENANT CONSISTENCY TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_validate_attendance_cards_tenant
ON app.attendance_cards;

CREATE TRIGGER trg_validate_attendance_cards_tenant
BEFORE INSERT OR UPDATE
ON app.attendance_cards
FOR EACH ROW
EXECUTE FUNCTION app.validate_movement_tenant_consistency();


DROP TRIGGER IF EXISTS trg_validate_attendance_records_tenant
ON app.attendance_records;

CREATE TRIGGER trg_validate_attendance_records_tenant
BEFORE INSERT OR UPDATE
ON app.attendance_records
FOR EACH ROW
EXECUTE FUNCTION app.validate_movement_tenant_consistency();


DROP TRIGGER IF EXISTS trg_validate_entry_exit_records_tenant
ON app.entry_exit_records;

CREATE TRIGGER trg_validate_entry_exit_records_tenant
BEFORE INSERT OR UPDATE
ON app.entry_exit_records
FOR EACH ROW
EXECUTE FUNCTION app.validate_movement_tenant_consistency();


-- ============================================================
-- BUSINESS INDEXES
-- ============================================================

-- Only one active attendance card per student.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_cards_one_active
ON app.attendance_cards (student_id)
WHERE status = 'ACTIVE';


-- ============================================================
-- FOREIGN KEY SUPPORTING INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_attendance_cards_student
ON app.attendance_cards (student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_cards_college_status
ON app.attendance_cards (college_id, status);


CREATE INDEX IF NOT EXISTS idx_attendance_records_student_date
ON app.attendance_records (student_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_records_recorded_at
ON app.attendance_records (student_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_attendance_records_college_status
ON app.attendance_records (college_id, status);

CREATE INDEX IF NOT EXISTS idx_attendance_records_card
ON app.attendance_records (card_id);


CREATE INDEX IF NOT EXISTS idx_entry_exit_student_recorded
ON app.entry_exit_records (student_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_entry_exit_gate_recorded
ON app.entry_exit_records (gate_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_entry_exit_college_type
ON app.entry_exit_records (college_id, movement_type);

CREATE INDEX IF NOT EXISTS idx_entry_exit_card
ON app.entry_exit_records (card_id);


CREATE INDEX IF NOT EXISTS idx_record_corrections_record
ON app.record_corrections (record_type, record_id);

CREATE INDEX IF NOT EXISTS idx_record_corrections_status
ON app.record_corrections (college_id, status);

CREATE INDEX IF NOT EXISTS idx_record_corrections_requested_by
ON app.record_corrections (requested_by);


-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON COLUMN app.entry_exit_records.movement_type IS
'ENTRY or EXIT. Every gate scan is retained as an immutable operational history record.';

COMMENT ON COLUMN app.record_corrections.old_values IS
'Snapshot of values before correction.';

COMMENT ON COLUMN app.record_corrections.new_values IS
'Requested replacement values for the correction.';


-- ============================================================
-- COMMIT
-- ============================================================

COMMIT;