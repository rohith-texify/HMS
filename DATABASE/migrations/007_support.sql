-- ============================================================
-- HMS DATABASE
-- Migration: 007_support.sql
-- Module: Support / Complaints / SOS / Security Incidents
--
-- PURPOSE
--   Creates:
--     1. complaints
--     2. complaint_updates
--     3. sos_alerts
--     4. security_incidents
--     5. incident_updates
--
-- DESIGN RULES
--   - UUID primary keys
--   - Every college-owned record carries college_id
--   - History is retained
--   - Status-based lifecycle
--   - UTC timestamps
--   - ON DELETE RESTRICT for historical records
--   - Tenant consistency enforced with triggers
-- ============================================================

BEGIN;

-- ============================================================
-- 1. COMPLAINTS
-- ============================================================

CREATE TABLE app.complaints (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    student_id uuid,

    complaint_number varchar(50) NOT NULL,

    category varchar(50) NOT NULL
        CHECK (
            category IN (
                'HOSTEL',
                'ROOM',
                'FOOD',
                'WATER',
                'ELECTRICITY',
                'CLEANLINESS',
                'MAINTENANCE',
                'SECURITY',
                'ACADEMIC',
                'TRANSPORT',
                'FACILITY',
                'STAFF',
                'OTHER'
            )
        ),

    title varchar(255) NOT NULL,
    description text NOT NULL,

    priority varchar(20) NOT NULL DEFAULT 'NORMAL'
        CHECK (
            priority IN (
                'LOW',
                'NORMAL',
                'HIGH',
                'URGENT'
            )
        ),

    status varchar(30) NOT NULL DEFAULT 'OPEN'
        CHECK (
            status IN (
                'DRAFT',
                'OPEN',
                'ASSIGNED',
                'IN_PROGRESS',
                'RESOLVED',
                'CLOSED',
                'REJECTED',
                'CANCELLED',
                'REOPENED'
            )
        ),

    assigned_to uuid,

    resolution text,
    resolved_at timestamptz,
    closed_at timestamptz,

    created_by uuid NOT NULL,
    updated_by uuid,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_complaints_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_complaints_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_complaints_assigned_to
        FOREIGN KEY (assigned_to)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_complaints_created_by
        FOREIGN KEY (created_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_complaints_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_complaint_number
        UNIQUE (college_id, complaint_number)
);

-- ============================================================
-- 2. COMPLAINT UPDATES
-- ============================================================

CREATE TABLE app.complaint_updates (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    complaint_id uuid NOT NULL,

    update_type varchar(30) NOT NULL
        CHECK (
            update_type IN (
                'COMMENT',
                'STATUS_CHANGE',
                'ASSIGNMENT',
                'RESOLUTION',
                'REOPENED',
                'SYSTEM'
            )
        ),

    previous_status varchar(30),
    new_status varchar(30),

    message text NOT NULL,

    updated_by uuid,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_complaint_updates_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_complaint_updates_complaint
        FOREIGN KEY (complaint_id)
        REFERENCES app.complaints(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_complaint_updates_user
        FOREIGN KEY (updated_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT
);

-- ============================================================
-- 3. SOS ALERTS
-- ============================================================

CREATE TABLE app.sos_alerts (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    student_id uuid NOT NULL,

    alert_number varchar(50) NOT NULL,

    alert_type varchar(40) NOT NULL
        CHECK (
            alert_type IN (
                'EMERGENCY',
                'MEDICAL',
                'SECURITY',
                'FIRE',
                'ACCIDENT',
                'THREAT',
                'OTHER'
            )
        ),

    message text,

    latitude numeric(10, 7),
    longitude numeric(10, 7),

    location_description text,

    status varchar(25) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'ACKNOWLEDGED',
                'RESPONDING',
                'RESOLVED',
                'CANCELLED',
                'FALSE_ALARM'
            )
        ),

    triggered_at timestamptz NOT NULL DEFAULT now(),

    acknowledged_by uuid,
    acknowledged_at timestamptz,

    resolved_by uuid,
    resolved_at timestamptz,

    resolution_notes text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_sos_alerts_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sos_alerts_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sos_alerts_acknowledged_by
        FOREIGN KEY (acknowledged_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sos_alerts_resolved_by
        FOREIGN KEY (resolved_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_sos_alert_number
        UNIQUE (college_id, alert_number),

    CONSTRAINT chk_sos_latitude
        CHECK (
            latitude IS NULL
            OR latitude BETWEEN -90 AND 90
        ),

    CONSTRAINT chk_sos_longitude
        CHECK (
            longitude IS NULL
            OR longitude BETWEEN -180 AND 180
        )
);

-- ============================================================
-- 4. SECURITY INCIDENTS
-- ============================================================

CREATE TABLE app.security_incidents (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,

    incident_number varchar(50) NOT NULL,

    incident_type varchar(50) NOT NULL
        CHECK (
            incident_type IN (
                'THEFT',
                'FIGHT',
                'UNAUTHORIZED_ENTRY',
                'PROPERTY_DAMAGE',
                'HARASSMENT',
                'SAFETY',
                'FIRE',
                'MEDICAL',
                'MISSING_PERSON',
                'VISITOR',
                'GATE',
                'OTHER'
            )
        ),

    severity varchar(20) NOT NULL DEFAULT 'MEDIUM'
        CHECK (
            severity IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    title varchar(255) NOT NULL,
    description text NOT NULL,

    location_description text,

    hostel_id uuid,
    block_id uuid,
    room_id uuid,
    gate_id uuid,

    reported_by uuid,

    status varchar(25) NOT NULL DEFAULT 'OPEN'
        CHECK (
            status IN (
                'OPEN',
                'INVESTIGATING',
                'ACTION_REQUIRED',
                'RESOLVED',
                'CLOSED',
                'FALSE_REPORT'
            )
        ),

    occurred_at timestamptz,
    reported_at timestamptz NOT NULL DEFAULT now(),

    assigned_to uuid,

    resolution text,
    resolved_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_security_incidents_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_security_incidents_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_security_incidents_block
        FOREIGN KEY (block_id)
        REFERENCES app.blocks(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_security_incidents_room
        FOREIGN KEY (room_id)
        REFERENCES app.rooms(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_security_incidents_gate
        FOREIGN KEY (gate_id)
        REFERENCES app.gates(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_security_incidents_reported_by
        FOREIGN KEY (reported_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_security_incidents_assigned_to
        FOREIGN KEY (assigned_to)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_security_incident_number
        UNIQUE (college_id, incident_number)
);

-- ============================================================
-- 5. INCIDENT UPDATES
-- ============================================================

CREATE TABLE app.incident_updates (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    incident_id uuid NOT NULL,

    update_type varchar(30) NOT NULL
        CHECK (
            update_type IN (
                'COMMENT',
                'STATUS_CHANGE',
                'ASSIGNMENT',
                'INVESTIGATION',
                'EVIDENCE',
                'RESOLUTION',
                'SYSTEM'
            )
        ),

    previous_status varchar(25),
    new_status varchar(25),

    message text NOT NULL,

    updated_by uuid,

    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_incident_updates_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_incident_updates_incident
        FOREIGN KEY (incident_id)
        REFERENCES app.security_incidents(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_incident_updates_user
        FOREIGN KEY (updated_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT
);

-- ============================================================
-- TENANT CONSISTENCY FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION app.validate_support_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    related_college_id uuid;
BEGIN

    IF TG_TABLE_NAME = 'complaints' THEN

        IF NEW.student_id IS NOT NULL THEN

            SELECT college_id
            INTO related_college_id
            FROM app.students
            WHERE id = NEW.student_id;

            IF related_college_id IS NULL
               OR related_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Tenant mismatch in complaints';
            END IF;

        END IF;

    ELSIF TG_TABLE_NAME = 'complaint_updates' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.complaints
        WHERE id = NEW.complaint_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in complaint_updates';
        END IF;

    ELSIF TG_TABLE_NAME = 'sos_alerts' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.students
        WHERE id = NEW.student_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in sos_alerts';
        END IF;

    ELSIF TG_TABLE_NAME = 'security_incidents' THEN

        IF NEW.hostel_id IS NOT NULL THEN

            SELECT college_id
            INTO related_college_id
            FROM app.hostels
            WHERE id = NEW.hostel_id;

            IF related_college_id IS NULL
               OR related_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Tenant mismatch in security_incidents hostel';
            END IF;

        END IF;

        IF NEW.block_id IS NOT NULL THEN

            SELECT college_id
            INTO related_college_id
            FROM app.blocks
            WHERE id = NEW.block_id;

            IF related_college_id IS NULL
               OR related_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Tenant mismatch in security_incidents block';
            END IF;

        END IF;

        IF NEW.room_id IS NOT NULL THEN

            SELECT college_id
            INTO related_college_id
            FROM app.rooms
            WHERE id = NEW.room_id;

            IF related_college_id IS NULL
               OR related_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Tenant mismatch in security_incidents room';
            END IF;

        END IF;

        IF NEW.gate_id IS NOT NULL THEN

            SELECT college_id
            INTO related_college_id
            FROM app.gates
            WHERE id = NEW.gate_id;

            IF related_college_id IS NULL
               OR related_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Tenant mismatch in security_incidents gate';
            END IF;

        END IF;

    ELSIF TG_TABLE_NAME = 'incident_updates' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.security_incidents
        WHERE id = NEW.incident_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in incident_updates';
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

-- ============================================================
-- TENANT CONSISTENCY TRIGGERS
-- ============================================================

CREATE TRIGGER trg_validate_complaints_tenant
BEFORE INSERT OR UPDATE ON app.complaints
FOR EACH ROW
EXECUTE FUNCTION app.validate_support_tenant_consistency();

CREATE TRIGGER trg_validate_complaint_updates_tenant
BEFORE INSERT OR UPDATE ON app.complaint_updates
FOR EACH ROW
EXECUTE FUNCTION app.validate_support_tenant_consistency();

CREATE TRIGGER trg_validate_sos_alerts_tenant
BEFORE INSERT OR UPDATE ON app.sos_alerts
FOR EACH ROW
EXECUTE FUNCTION app.validate_support_tenant_consistency();

CREATE TRIGGER trg_validate_security_incidents_tenant
BEFORE INSERT OR UPDATE ON app.security_incidents
FOR EACH ROW
EXECUTE FUNCTION app.validate_support_tenant_consistency();

CREATE TRIGGER trg_validate_incident_updates_tenant
BEFORE INSERT OR UPDATE ON app.incident_updates
FOR EACH ROW
EXECUTE FUNCTION app.validate_support_tenant_consistency();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_complaints_college_status
    ON app.complaints (college_id, status);

CREATE INDEX idx_complaints_student
    ON app.complaints (student_id, created_at DESC);

CREATE INDEX idx_complaints_assigned_to
    ON app.complaints (assigned_to, status);

CREATE INDEX idx_complaints_priority
    ON app.complaints (college_id, priority, status);

CREATE INDEX idx_complaint_updates_complaint
    ON app.complaint_updates (complaint_id, created_at DESC);

CREATE INDEX idx_sos_alerts_college_status
    ON app.sos_alerts (college_id, status);

CREATE INDEX idx_sos_alerts_student
    ON app.sos_alerts (student_id, triggered_at DESC);

CREATE INDEX idx_sos_alerts_active
    ON app.sos_alerts (college_id, triggered_at DESC)
    WHERE status IN (
        'ACTIVE',
        'ACKNOWLEDGED',
        'RESPONDING'
    );

CREATE INDEX idx_security_incidents_college_status
    ON app.security_incidents (college_id, status);

CREATE INDEX idx_security_incidents_severity
    ON app.security_incidents (college_id, severity, status);

CREATE INDEX idx_security_incidents_hostel
    ON app.security_incidents (hostel_id, occurred_at DESC);

CREATE INDEX idx_security_incidents_gate
    ON app.security_incidents (gate_id, occurred_at DESC);

CREATE INDEX idx_security_incidents_assigned_to
    ON app.security_incidents (assigned_to, status);

CREATE INDEX idx_incident_updates_incident
    ON app.incident_updates (incident_id, created_at DESC);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE app.complaints IS
'Student and operational complaints with lifecycle and assignment tracking.';

COMMENT ON TABLE app.complaint_updates IS
'Immutable-style chronological updates associated with complaints.';

COMMENT ON TABLE app.sos_alerts IS
'Emergency SOS alerts raised by students or operational systems.';

COMMENT ON TABLE app.security_incidents IS
'Security and safety incidents reported within the college.';

COMMENT ON TABLE app.incident_updates IS
'Chronological investigation and resolution updates for security incidents.';

COMMIT;