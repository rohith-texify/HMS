-- ============================================================
-- HMS DATABASE
-- Migration: 005_movement.sql
-- Module: Movement
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION app.validate_movement_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
    referenced_college_id uuid;
BEGIN
    IF TG_TABLE_NAME = 'attendance_cards' THEN
        SELECT college_id INTO referenced_college_id FROM app.students WHERE id = NEW.student_id;
        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION 'Student % does not exist', NEW.student_id;
        END IF;
        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION 'Student % and attendance card belong to different colleges', NEW.student_id;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'attendance_records' THEN
        SELECT college_id INTO referenced_college_id FROM app.students WHERE id = NEW.student_id;
        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION 'Student % does not exist', NEW.student_id;
        END IF;
        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION 'Student % and attendance record belong to different colleges', NEW.student_id;
        END IF;
        IF NEW.card_id IS NOT NULL THEN
            SELECT college_id INTO referenced_college_id FROM app.attendance_cards WHERE id = NEW.card_id;
            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION 'Attendance card % does not exist', NEW.card_id;
            END IF;
            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION 'Attendance card % and attendance record belong to different colleges', NEW.card_id;
            END IF;
        END IF;
    END IF;

    IF TG_TABLE_NAME = 'entry_exit_records' THEN
        SELECT college_id INTO referenced_college_id FROM app.students WHERE id = NEW.student_id;
        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION 'Student % does not exist', NEW.student_id;
        END IF;
        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION 'Student % and movement record belong to different colleges', NEW.student_id;
        END IF;
        IF NEW.card_id IS NOT NULL THEN
            SELECT college_id INTO referenced_college_id FROM app.attendance_cards WHERE id = NEW.card_id;
            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION 'Attendance card % does not exist', NEW.card_id;
            END IF;
            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION 'Attendance card % and movement record belong to different colleges', NEW.card_id;
            END IF;
        END IF;
        SELECT college_id INTO referenced_college_id FROM app.gates WHERE id = NEW.gate_id;
        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION 'Gate % does not exist', NEW.gate_id;
        END IF;
        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION 'Gate % and movement record belong to different colleges', NEW.gate_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE TABLE app.attendance_cards (

    id uuid DEFAULT platform.generate_uuid() NOT NULL,

    college_id uuid NOT NULL,

    student_id uuid NOT NULL,

    card_number public.citext NOT NULL,

    qr_value text,

    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,

    issued_at timestamp with time zone DEFAULT now() NOT NULL,

    expiry_at timestamp with time zone,

    replaced_by_card_id uuid,

    created_at timestamp with time zone DEFAULT now() NOT NULL,

    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT chk_attendance_cards_expiry CHECK (((expiry_at IS NULL) OR (expiry_at >= issued_at))),

    CONSTRAINT chk_attendance_cards_status CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'BLOCKED'::character varying, 'LOST'::character varying, 'EXPIRED'::character varying, 'REPLACED'::character varying])::text[])))

);

COMMENT ON TABLE app.attendance_cards IS 'QR/barcode attendance cards issued to students. Card history is retained.';

CREATE TABLE app.attendance_records (

    id uuid DEFAULT platform.generate_uuid() NOT NULL,

    college_id uuid NOT NULL,

    student_id uuid NOT NULL,

    card_id uuid,

    attendance_date date NOT NULL,

    recorded_at timestamp with time zone DEFAULT now() NOT NULL,

    status character varying(20) NOT NULL,

    scan_method character varying(20) DEFAULT 'MANUAL'::character varying NOT NULL,

    recorded_by uuid,

    is_corrected boolean DEFAULT false NOT NULL,

    remarks text,

    created_at timestamp with time zone DEFAULT now() NOT NULL,

    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT chk_attendance_records_scan_method CHECK (((scan_method)::text = ANY ((ARRAY['QR'::character varying, 'BARCODE'::character varying, 'MANUAL'::character varying, 'SYSTEM'::character varying])::text[]))),

    CONSTRAINT chk_attendance_records_status CHECK (((status)::text = ANY ((ARRAY['PRESENT'::character varying, 'ABSENT'::character varying, 'LATE'::character varying, 'ON_LEAVE'::character varying, 'EXCUSED'::character varying, 'HOLIDAY'::character varying])::text[])))

);

COMMENT ON TABLE app.attendance_records IS 'Daily hostel attendance record for each student.';

COMMENT ON COLUMN app.attendance_records.is_corrected IS 'Indicates that the original attendance was modified through the correction workflow.';

CREATE TABLE app.entry_exit_records (

    id uuid DEFAULT platform.generate_uuid() NOT NULL,

    college_id uuid NOT NULL,

    student_id uuid NOT NULL,

    card_id uuid,

    gate_id uuid NOT NULL,

    movement_type character varying(10) NOT NULL,

    recorded_at timestamp with time zone DEFAULT now() NOT NULL,

    verification_method character varying(20) DEFAULT 'MANUAL'::character varying NOT NULL,

    recorded_by uuid,

    remarks text,

    created_at timestamp with time zone DEFAULT now() NOT NULL,

    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT chk_entry_exit_movement_type CHECK (((movement_type)::text = ANY ((ARRAY['ENTRY'::character varying, 'EXIT'::character varying])::text[]))),

    CONSTRAINT chk_entry_exit_verification CHECK (((verification_method)::text = ANY ((ARRAY['MANUAL'::character varying, 'CARD'::character varying, 'QR'::character varying, 'BIOMETRIC'::character varying, 'SYSTEM'::character varying])::text[])))

);

COMMENT ON TABLE app.entry_exit_records IS 'Every student gate movement scan. This is the single source for gate movement history.';

COMMENT ON COLUMN app.entry_exit_records.movement_type IS 'ENTRY or EXIT. Every gate scan is retained as an immutable operational history record.';

CREATE TABLE app.record_corrections (

    id uuid DEFAULT platform.generate_uuid() NOT NULL,

    college_id uuid NOT NULL,

    record_type character varying(50) NOT NULL,

    record_id uuid NOT NULL,

    requested_by uuid NOT NULL,

    approved_by uuid,

    correction_reason text NOT NULL,

    old_values jsonb NOT NULL,

    new_values jsonb NOT NULL,

    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,

    requested_at timestamp with time zone DEFAULT now() NOT NULL,

    decided_at timestamp with time zone,

    decision_reason text,

    created_at timestamp with time zone DEFAULT now() NOT NULL,

    updated_at timestamp with time zone DEFAULT now() NOT NULL,

    CONSTRAINT chk_record_corrections_reason CHECK ((length(TRIM(BOTH FROM correction_reason)) > 0)),

    CONSTRAINT chk_record_corrections_record_type CHECK (((record_type)::text = ANY ((ARRAY['ATTENDANCE'::character varying, 'ENTRY_EXIT'::character varying])::text[]))),

    CONSTRAINT chk_record_corrections_status CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying])::text[])))

);

COMMENT ON TABLE app.record_corrections IS 'Controlled correction workflow for attendance and movement records.';

COMMENT ON COLUMN app.record_corrections.old_values IS 'Snapshot of values before correction.';

COMMENT ON COLUMN app.record_corrections.new_values IS 'Requested replacement values for the correction.';

ALTER TABLE ONLY app.attendance_cards

    ADD CONSTRAINT attendance_cards_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.attendance_records

    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.entry_exit_records

    ADD CONSTRAINT entry_exit_records_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.record_corrections

    ADD CONSTRAINT record_corrections_pkey PRIMARY KEY (id);

ALTER TABLE ONLY app.attendance_cards

    ADD CONSTRAINT uq_attendance_cards_number UNIQUE (college_id, card_number);

ALTER TABLE ONLY app.attendance_cards

    ADD CONSTRAINT uq_attendance_cards_qr UNIQUE (college_id, qr_value);

ALTER TABLE ONLY app.attendance_records

    ADD CONSTRAINT uq_attendance_records_student_date UNIQUE (college_id, student_id, attendance_date);

CREATE UNIQUE INDEX uq_attendance_cards_one_active ON app.attendance_cards USING btree (student_id) WHERE ((status)::text = 'ACTIVE'::text);

CREATE TRIGGER trg_validate_attendance_cards_tenant BEFORE INSERT OR UPDATE ON app.attendance_cards FOR EACH ROW EXECUTE FUNCTION app.validate_movement_tenant_consistency();

CREATE TRIGGER trg_validate_attendance_records_tenant BEFORE INSERT OR UPDATE ON app.attendance_records FOR EACH ROW EXECUTE FUNCTION app.validate_movement_tenant_consistency();

CREATE TRIGGER trg_validate_entry_exit_records_tenant BEFORE INSERT OR UPDATE ON app.entry_exit_records FOR EACH ROW EXECUTE FUNCTION app.validate_movement_tenant_consistency();

ALTER TABLE ONLY app.attendance_cards

    ADD CONSTRAINT fk_attendance_cards_college FOREIGN KEY (college_id) REFERENCES platform.colleges(college_id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.attendance_cards

    ADD CONSTRAINT fk_attendance_cards_replaced_by FOREIGN KEY (replaced_by_card_id) REFERENCES app.attendance_cards(id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.attendance_cards

    ADD CONSTRAINT fk_attendance_cards_student FOREIGN KEY (student_id) REFERENCES app.students(id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.attendance_records

    ADD CONSTRAINT fk_attendance_records_card FOREIGN KEY (card_id) REFERENCES app.attendance_cards(id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.attendance_records

    ADD CONSTRAINT fk_attendance_records_college FOREIGN KEY (college_id) REFERENCES platform.colleges(college_id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.attendance_records

    ADD CONSTRAINT fk_attendance_records_recorded_by FOREIGN KEY (recorded_by) REFERENCES app.users(user_id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.attendance_records

    ADD CONSTRAINT fk_attendance_records_student FOREIGN KEY (student_id) REFERENCES app.students(id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.entry_exit_records

    ADD CONSTRAINT fk_entry_exit_card FOREIGN KEY (card_id) REFERENCES app.attendance_cards(id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.entry_exit_records

    ADD CONSTRAINT fk_entry_exit_college FOREIGN KEY (college_id) REFERENCES platform.colleges(college_id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.entry_exit_records

    ADD CONSTRAINT fk_entry_exit_gate FOREIGN KEY (gate_id) REFERENCES app.gates(id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.entry_exit_records

    ADD CONSTRAINT fk_entry_exit_recorded_by FOREIGN KEY (recorded_by) REFERENCES app.users(user_id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.entry_exit_records

    ADD CONSTRAINT fk_entry_exit_student FOREIGN KEY (student_id) REFERENCES app.students(id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.record_corrections

    ADD CONSTRAINT fk_record_corrections_approved_by FOREIGN KEY (approved_by) REFERENCES app.users(user_id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.record_corrections

    ADD CONSTRAINT fk_record_corrections_college FOREIGN KEY (college_id) REFERENCES platform.colleges(college_id) ON DELETE RESTRICT;

ALTER TABLE ONLY app.record_corrections

    ADD CONSTRAINT fk_record_corrections_requested_by FOREIGN KEY (requested_by) REFERENCES app.users(user_id) ON DELETE RESTRICT;

COMMIT;
