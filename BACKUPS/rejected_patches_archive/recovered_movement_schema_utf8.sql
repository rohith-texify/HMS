--
-- PostgreSQL database dump
--

\restrict xAVNrKohuW6WkP0O912dvBVxTUjztktZfh0qd9Ag4uxklQbebsfwNAPbIQ9SPR8

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: attendance_cards; Type: TABLE; Schema: app; Owner: postgres
--

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

ALTER TABLE ONLY app.attendance_cards FORCE ROW LEVEL SECURITY;


ALTER TABLE app.attendance_cards OWNER TO postgres;

--
-- Name: TABLE attendance_cards; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.attendance_cards IS 'QR/barcode attendance cards issued to students. Card history is retained.';


--
-- Name: attendance_records; Type: TABLE; Schema: app; Owner: postgres
--

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

ALTER TABLE ONLY app.attendance_records FORCE ROW LEVEL SECURITY;


ALTER TABLE app.attendance_records OWNER TO postgres;

--
-- Name: TABLE attendance_records; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.attendance_records IS 'Daily hostel attendance record for each student.';


--
-- Name: COLUMN attendance_records.is_corrected; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.attendance_records.is_corrected IS 'Indicates that the original attendance was modified through the correction workflow.';


--
-- Name: entry_exit_records; Type: TABLE; Schema: app; Owner: postgres
--

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

ALTER TABLE ONLY app.entry_exit_records FORCE ROW LEVEL SECURITY;


ALTER TABLE app.entry_exit_records OWNER TO postgres;

--
-- Name: TABLE entry_exit_records; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.entry_exit_records IS 'Every student gate movement scan. This is the single source for gate movement history.';


--
-- Name: COLUMN entry_exit_records.movement_type; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.entry_exit_records.movement_type IS 'ENTRY or EXIT. Every gate scan is retained as an immutable operational history record.';


--
-- Name: record_corrections; Type: TABLE; Schema: app; Owner: postgres
--

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

ALTER TABLE ONLY app.record_corrections FORCE ROW LEVEL SECURITY;


ALTER TABLE app.record_corrections OWNER TO postgres;

--
-- Name: TABLE record_corrections; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON TABLE app.record_corrections IS 'Controlled correction workflow for attendance and movement records.';


--
-- Name: COLUMN record_corrections.old_values; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.record_corrections.old_values IS 'Snapshot of values before correction.';


--
-- Name: COLUMN record_corrections.new_values; Type: COMMENT; Schema: app; Owner: postgres
--

COMMENT ON COLUMN app.record_corrections.new_values IS 'Requested replacement values for the correction.';


--
-- Name: attendance_cards attendance_cards_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_cards
    ADD CONSTRAINT attendance_cards_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: entry_exit_records entry_exit_records_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.entry_exit_records
    ADD CONSTRAINT entry_exit_records_pkey PRIMARY KEY (id);


--
-- Name: record_corrections record_corrections_pkey; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.record_corrections
    ADD CONSTRAINT record_corrections_pkey PRIMARY KEY (id);


--
-- Name: attendance_cards uq_attendance_cards_number; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_cards
    ADD CONSTRAINT uq_attendance_cards_number UNIQUE (college_id, card_number);


--
-- Name: attendance_cards uq_attendance_cards_qr; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_cards
    ADD CONSTRAINT uq_attendance_cards_qr UNIQUE (college_id, qr_value);


--
-- Name: attendance_records uq_attendance_records_student_date; Type: CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_records
    ADD CONSTRAINT uq_attendance_records_student_date UNIQUE (college_id, student_id, attendance_date);


--
-- Name: idx_attendance_cards_college_status; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_attendance_cards_college_status ON app.attendance_cards USING btree (college_id, status);


--
-- Name: idx_attendance_cards_expiry; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_attendance_cards_expiry ON app.attendance_cards USING btree (expiry_at);


--
-- Name: idx_attendance_cards_student; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_attendance_cards_student ON app.attendance_cards USING btree (student_id);


--
-- Name: idx_attendance_records_card; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_attendance_records_card ON app.attendance_records USING btree (card_id);


--
-- Name: idx_attendance_records_college_date; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_attendance_records_college_date ON app.attendance_records USING btree (college_id, attendance_date);


--
-- Name: idx_attendance_records_college_status; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_attendance_records_college_status ON app.attendance_records USING btree (college_id, status);


--
-- Name: idx_attendance_records_recorded_at; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_attendance_records_recorded_at ON app.attendance_records USING btree (student_id, recorded_at);


--
-- Name: idx_attendance_records_status; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_attendance_records_status ON app.attendance_records USING btree (college_id, status);


--
-- Name: idx_attendance_records_student_date; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_attendance_records_student_date ON app.attendance_records USING btree (student_id, attendance_date);


--
-- Name: idx_attendance_records_student_recorded; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_attendance_records_student_recorded ON app.attendance_records USING btree (student_id, recorded_at);


--
-- Name: idx_entry_exit_card; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_entry_exit_card ON app.entry_exit_records USING btree (card_id);


--
-- Name: idx_entry_exit_college_recorded; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_entry_exit_college_recorded ON app.entry_exit_records USING btree (college_id, recorded_at);


--
-- Name: idx_entry_exit_college_type; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_entry_exit_college_type ON app.entry_exit_records USING btree (college_id, movement_type);


--
-- Name: idx_entry_exit_gate; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_entry_exit_gate ON app.entry_exit_records USING btree (gate_id);


--
-- Name: idx_entry_exit_gate_recorded; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_entry_exit_gate_recorded ON app.entry_exit_records USING btree (gate_id, recorded_at);


--
-- Name: idx_entry_exit_movement; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_entry_exit_movement ON app.entry_exit_records USING btree (college_id, movement_type);


--
-- Name: idx_entry_exit_student_recorded; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_entry_exit_student_recorded ON app.entry_exit_records USING btree (student_id, recorded_at);


--
-- Name: idx_record_corrections_college_status; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_record_corrections_college_status ON app.record_corrections USING btree (college_id, status);


--
-- Name: idx_record_corrections_record; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_record_corrections_record ON app.record_corrections USING btree (record_type, record_id);


--
-- Name: idx_record_corrections_requested_by; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_record_corrections_requested_by ON app.record_corrections USING btree (requested_by);


--
-- Name: idx_record_corrections_status; Type: INDEX; Schema: app; Owner: postgres
--

CREATE INDEX idx_record_corrections_status ON app.record_corrections USING btree (college_id, status);


--
-- Name: uq_attendance_cards_one_active; Type: INDEX; Schema: app; Owner: postgres
--

CREATE UNIQUE INDEX uq_attendance_cards_one_active ON app.attendance_cards USING btree (student_id) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: attendance_cards trg_validate_attendance_cards_tenant; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_validate_attendance_cards_tenant BEFORE INSERT OR UPDATE ON app.attendance_cards FOR EACH ROW EXECUTE FUNCTION app.validate_movement_tenant_consistency();


--
-- Name: attendance_records trg_validate_attendance_records_tenant; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_validate_attendance_records_tenant BEFORE INSERT OR UPDATE ON app.attendance_records FOR EACH ROW EXECUTE FUNCTION app.validate_movement_tenant_consistency();


--
-- Name: entry_exit_records trg_validate_entry_exit_records_tenant; Type: TRIGGER; Schema: app; Owner: postgres
--

CREATE TRIGGER trg_validate_entry_exit_records_tenant BEFORE INSERT OR UPDATE ON app.entry_exit_records FOR EACH ROW EXECUTE FUNCTION app.validate_movement_tenant_consistency();


--
-- Name: attendance_cards fk_attendance_cards_college; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_cards
    ADD CONSTRAINT fk_attendance_cards_college FOREIGN KEY (college_id) REFERENCES platform.colleges(college_id) ON DELETE RESTRICT;


--
-- Name: attendance_cards fk_attendance_cards_replaced_by; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_cards
    ADD CONSTRAINT fk_attendance_cards_replaced_by FOREIGN KEY (replaced_by_card_id) REFERENCES app.attendance_cards(id) ON DELETE RESTRICT;


--
-- Name: attendance_cards fk_attendance_cards_student; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_cards
    ADD CONSTRAINT fk_attendance_cards_student FOREIGN KEY (student_id) REFERENCES app.students(id) ON DELETE RESTRICT;


--
-- Name: attendance_records fk_attendance_records_card; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_records
    ADD CONSTRAINT fk_attendance_records_card FOREIGN KEY (card_id) REFERENCES app.attendance_cards(id) ON DELETE RESTRICT;


--
-- Name: attendance_records fk_attendance_records_college; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_records
    ADD CONSTRAINT fk_attendance_records_college FOREIGN KEY (college_id) REFERENCES platform.colleges(college_id) ON DELETE RESTRICT;


--
-- Name: attendance_records fk_attendance_records_recorded_by; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_records
    ADD CONSTRAINT fk_attendance_records_recorded_by FOREIGN KEY (recorded_by) REFERENCES app.users(user_id) ON DELETE RESTRICT;


--
-- Name: attendance_records fk_attendance_records_student; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.attendance_records
    ADD CONSTRAINT fk_attendance_records_student FOREIGN KEY (student_id) REFERENCES app.students(id) ON DELETE RESTRICT;


--
-- Name: entry_exit_records fk_entry_exit_card; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.entry_exit_records
    ADD CONSTRAINT fk_entry_exit_card FOREIGN KEY (card_id) REFERENCES app.attendance_cards(id) ON DELETE RESTRICT;


--
-- Name: entry_exit_records fk_entry_exit_college; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.entry_exit_records
    ADD CONSTRAINT fk_entry_exit_college FOREIGN KEY (college_id) REFERENCES platform.colleges(college_id) ON DELETE RESTRICT;


--
-- Name: entry_exit_records fk_entry_exit_gate; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.entry_exit_records
    ADD CONSTRAINT fk_entry_exit_gate FOREIGN KEY (gate_id) REFERENCES app.gates(id) ON DELETE RESTRICT;


--
-- Name: entry_exit_records fk_entry_exit_recorded_by; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.entry_exit_records
    ADD CONSTRAINT fk_entry_exit_recorded_by FOREIGN KEY (recorded_by) REFERENCES app.users(user_id) ON DELETE RESTRICT;


--
-- Name: entry_exit_records fk_entry_exit_student; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.entry_exit_records
    ADD CONSTRAINT fk_entry_exit_student FOREIGN KEY (student_id) REFERENCES app.students(id) ON DELETE RESTRICT;


--
-- Name: record_corrections fk_record_corrections_approved_by; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.record_corrections
    ADD CONSTRAINT fk_record_corrections_approved_by FOREIGN KEY (approved_by) REFERENCES app.users(user_id) ON DELETE RESTRICT;


--
-- Name: record_corrections fk_record_corrections_college; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.record_corrections
    ADD CONSTRAINT fk_record_corrections_college FOREIGN KEY (college_id) REFERENCES platform.colleges(college_id) ON DELETE RESTRICT;


--
-- Name: record_corrections fk_record_corrections_requested_by; Type: FK CONSTRAINT; Schema: app; Owner: postgres
--

ALTER TABLE ONLY app.record_corrections
    ADD CONSTRAINT fk_record_corrections_requested_by FOREIGN KEY (requested_by) REFERENCES app.users(user_id) ON DELETE RESTRICT;


--
-- Name: attendance_cards; Type: ROW SECURITY; Schema: app; Owner: postgres
--

ALTER TABLE app.attendance_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_records; Type: ROW SECURITY; Schema: app; Owner: postgres
--

ALTER TABLE app.attendance_records ENABLE ROW LEVEL SECURITY;

--
-- Name: entry_exit_records; Type: ROW SECURITY; Schema: app; Owner: postgres
--

ALTER TABLE app.entry_exit_records ENABLE ROW LEVEL SECURITY;

--
-- Name: record_corrections; Type: ROW SECURITY; Schema: app; Owner: postgres
--

ALTER TABLE app.record_corrections ENABLE ROW LEVEL SECURITY;

--
-- Name: attendance_cards tenant_isolation_attendance_cards; Type: POLICY; Schema: app; Owner: postgres
--

CREATE POLICY tenant_isolation_attendance_cards ON app.attendance_cards AS RESTRICTIVE USING ((college_id = app.current_tenant_id())) WITH CHECK ((college_id = app.current_tenant_id()));


--
-- Name: attendance_records tenant_isolation_attendance_records; Type: POLICY; Schema: app; Owner: postgres
--

CREATE POLICY tenant_isolation_attendance_records ON app.attendance_records AS RESTRICTIVE USING ((college_id = app.current_tenant_id())) WITH CHECK ((college_id = app.current_tenant_id()));


--
-- Name: entry_exit_records tenant_isolation_entry_exit_records; Type: POLICY; Schema: app; Owner: postgres
--

CREATE POLICY tenant_isolation_entry_exit_records ON app.entry_exit_records AS RESTRICTIVE USING ((college_id = app.current_tenant_id())) WITH CHECK ((college_id = app.current_tenant_id()));


--
-- Name: record_corrections tenant_isolation_record_corrections; Type: POLICY; Schema: app; Owner: postgres
--

CREATE POLICY tenant_isolation_record_corrections ON app.record_corrections AS RESTRICTIVE USING ((college_id = app.current_tenant_id())) WITH CHECK ((college_id = app.current_tenant_id()));


--
-- PostgreSQL database dump complete
--

\unrestrict xAVNrKohuW6WkP0O912dvBVxTUjztktZfh0qd9Ag4uxklQbebsfwNAPbIQ9SPR8

