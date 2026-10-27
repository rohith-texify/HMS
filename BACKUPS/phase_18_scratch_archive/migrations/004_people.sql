-- ============================================================
-- HMS DATABASE
-- Migration: 004_people.sql
-- Domain: People
--
-- Creates:
--   1. students
--   2. parents
--   3. student_parents
--   4. emergency_contacts
--   5. staff_profiles
--   6. incharge_hostels
--   7. security_assignments
--
-- Extends:
--   8. bed_allocations -> student_id
--
-- Design rules:
--   - UUID primary keys
--   - College/tenant isolation through college_id
--   - Login identity remains in app.users
--   - Student/parent/staff data lives in profile tables
--   - Historical records are retained
--   - Important records are deactivated instead of deleted
-- ============================================================

BEGIN;

-- ============================================================
-- 1. STUDENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.students (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    user_id             uuid,

    admission_number    citext NOT NULL,
    registration_number citext,

    roll_number         varchar(100),

    first_name          varchar(100) NOT NULL,
    middle_name         varchar(100),
    last_name           varchar(100),

    date_of_birth       date,
    gender              varchar(30),

    phone               varchar(30),
    email               citext,

    photo_url           text,

    department_id       uuid,
    program_id          uuid,
    course_id           uuid,
    batch_id            uuid,
    academic_year_id    uuid,
    semester_id         uuid,

    admission_date      date,
    expected_graduation_date date,

    hostel_status       varchar(20) NOT NULL DEFAULT 'OUTSIDE',
    status              varchar(20) NOT NULL DEFAULT 'ACTIVE',

    address_line1       text,
    address_line2       text,
    city                varchar(100),
    state               varchar(100),
    postal_code         varchar(20),
    country             varchar(100),

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_students_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_students_user
        FOREIGN KEY (user_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_students_department
        FOREIGN KEY (department_id)
        REFERENCES app.departments(department_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_students_program
        FOREIGN KEY (program_id)
        REFERENCES app.programs(program_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_students_course
        FOREIGN KEY (course_id)
        REFERENCES app.courses(course_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_students_batch
        FOREIGN KEY (batch_id)
        REFERENCES app.batches(batch_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_students_academic_year
        FOREIGN KEY (academic_year_id)
        REFERENCES app.academic_years(academic_year_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_students_semester
        FOREIGN KEY (semester_id)
        REFERENCES app.semesters(semester_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_students_college_admission
        UNIQUE (college_id, admission_number),

    CONSTRAINT uq_students_college_registration
        UNIQUE (college_id, registration_number),

    CONSTRAINT uq_students_college_roll
        UNIQUE (college_id, roll_number),

    CONSTRAINT uq_students_college_user
        UNIQUE (college_id, user_id),

    CONSTRAINT chk_students_hostel_status
        CHECK (
            hostel_status IN (
                'INSIDE',
                'OUTSIDE',
                'ON_LEAVE'
            )
        ),

    CONSTRAINT chk_students_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'GRADUATED',
                'SUSPENDED',
                'TRANSFERRED',
                'WITHDRAWN'
            )
        ),

    CONSTRAINT chk_students_dates
        CHECK (
            expected_graduation_date IS NULL
            OR admission_date IS NULL
            OR expected_graduation_date >= admission_date
        )
);

COMMENT ON TABLE app.students IS
'Student profile and academic identity. Login credentials remain in app.users.';

COMMENT ON COLUMN app.students.admission_number IS
'College-scoped student admission identifier.';

COMMENT ON COLUMN app.students.hostel_status IS
'Current student hostel movement state: INSIDE, OUTSIDE or ON_LEAVE.';


-- ============================================================
-- 2. PARENTS / GUARDIANS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.parents (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    user_id             uuid,

    first_name          varchar(100) NOT NULL,
    middle_name         varchar(100),
    last_name           varchar(100),

    phone               varchar(30) NOT NULL,
    alternate_phone     varchar(30),

    email               citext,

    address_line1       text,
    address_line2       text,
    city                varchar(100),
    state               varchar(100),
    postal_code         varchar(20),
    country             varchar(100),

    status              varchar(20) NOT NULL DEFAULT 'ACTIVE',

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_parents_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_parents_user
        FOREIGN KEY (user_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_parents_college_user
        UNIQUE (college_id, user_id),

    CONSTRAINT chk_parents_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        )
);

COMMENT ON TABLE app.parents IS
'Parent or guardian profile. A parent may be linked to multiple students.';


-- ============================================================
-- 3. STUDENT <-> PARENT RELATIONSHIP
-- ============================================================

CREATE TABLE IF NOT EXISTS app.student_parents (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,

    student_id          uuid NOT NULL,
    parent_id           uuid NOT NULL,

    relationship        varchar(50) NOT NULL,

    is_primary          boolean NOT NULL DEFAULT false,
    can_approve_leave   boolean NOT NULL DEFAULT false,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_student_parents_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_student_parents_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_student_parents_parent
        FOREIGN KEY (parent_id)
        REFERENCES app.parents(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_student_parents_relationship
        UNIQUE (student_id, parent_id, relationship),

    CONSTRAINT chk_student_parents_relationship
        CHECK (
            length(trim(relationship)) > 0
        )
);

COMMENT ON TABLE app.student_parents IS
'Links students with their parents or guardians. Supports primary guardian and leave approval capability.';


-- ============================================================
-- 4. EMERGENCY CONTACTS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.emergency_contacts (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    student_id          uuid NOT NULL,

    name                varchar(200) NOT NULL,
    relationship        varchar(50) NOT NULL,
    phone               varchar(30) NOT NULL,
    alternate_phone     varchar(30),

    priority            integer NOT NULL DEFAULT 1,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_emergency_contacts_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_emergency_contacts_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_emergency_contacts_priority
        CHECK (priority > 0)
);

COMMENT ON TABLE app.emergency_contacts IS
'Emergency contact numbers maintained separately from parent/guardian records.';


-- ============================================================
-- 5. STAFF PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS app.staff_profiles (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    user_id             uuid NOT NULL,

    staff_type          varchar(30) NOT NULL,
    employee_code       citext NOT NULL,

    first_name          varchar(100),
    middle_name         varchar(100),
    last_name           varchar(100),

    phone               varchar(30),

    designation         varchar(150),

    joining_date        date,
    leaving_date        date,

    status              varchar(20) NOT NULL DEFAULT 'ACTIVE',

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_staff_profiles_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_staff_profiles_user
        FOREIGN KEY (user_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_staff_profiles_employee_code
        UNIQUE (college_id, employee_code),

    CONSTRAINT uq_staff_profiles_user
        UNIQUE (college_id, user_id),

    CONSTRAINT chk_staff_profiles_type
        CHECK (
            staff_type IN (
                'INCHARGE',
                'SECURITY',
                'STAFF',
                'ADMIN'
            )
        ),

    CONSTRAINT chk_staff_profiles_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'SUSPENDED',
                'LEFT'
            )
        ),

    CONSTRAINT chk_staff_profiles_dates
        CHECK (
            leaving_date IS NULL
            OR joining_date IS NULL
            OR leaving_date >= joining_date
        )
);

COMMENT ON TABLE app.staff_profiles IS
'College staff profile for hostel incharges, security and other operational staff.';


-- ============================================================
-- 6. INCHARGE <-> HOSTEL ASSIGNMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.incharge_hostels (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,

    staff_id            uuid NOT NULL,
    hostel_id           uuid NOT NULL,

    from_date           date NOT NULL,
    to_date             date,

    is_primary          boolean NOT NULL DEFAULT false,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_incharge_hostels_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_incharge_hostels_staff
        FOREIGN KEY (staff_id)
        REFERENCES app.staff_profiles(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_incharge_hostels_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_incharge_hostels_dates
        CHECK (
            to_date IS NULL
            OR to_date >= from_date
        )
);

COMMENT ON TABLE app.incharge_hostels IS
'Historical assignment of hostel incharges to hostels.';


-- ============================================================
-- 7. SECURITY ASSIGNMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.security_assignments (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,

    staff_id            uuid NOT NULL,
    gate_id             uuid NOT NULL,

    shift               varchar(50) NOT NULL,

    from_date           date NOT NULL,
    to_date             date,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_security_assignments_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_security_assignments_staff
        FOREIGN KEY (staff_id)
        REFERENCES app.staff_profiles(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_security_assignments_gate
        FOREIGN KEY (gate_id)
        REFERENCES app.gates(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_security_assignments_dates
        CHECK (
            to_date IS NULL
            OR to_date >= from_date
        )
);

COMMENT ON TABLE app.security_assignments IS
'Historical assignment of security staff to hostel gates and shifts.';


-- ============================================================
-- 8. EXTEND BED ALLOCATIONS WITH STUDENT
-- ============================================================

ALTER TABLE app.bed_allocations
    ADD COLUMN IF NOT EXISTS student_id uuid;

ALTER TABLE app.bed_allocations
    DROP CONSTRAINT IF EXISTS fk_bed_allocations_student;

ALTER TABLE app.bed_allocations
    ADD CONSTRAINT fk_bed_allocations_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT;


-- ============================================================
-- TENANT CONSISTENCY VALIDATION
--
-- Prevents cross-college relationships such as:
--   College A student -> College B parent
--   College A student -> College B staff
--   College A staff  -> College B hostel
-- ============================================================

CREATE OR REPLACE FUNCTION app.validate_people_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    referenced_college_id uuid;
BEGIN

    -- --------------------------------------------------------
    -- STUDENTS
    -- --------------------------------------------------------
    IF TG_TABLE_NAME = 'students' THEN

        IF NEW.department_id IS NOT NULL THEN
            SELECT college_id
            INTO referenced_college_id
            FROM app.departments
            WHERE id = NEW.department_id;

            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION
                    'Department % does not exist',
                    NEW.department_id;
            END IF;

            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Student % and department % belong to different colleges',
                    NEW.id,
                    NEW.department_id;
            END IF;
        END IF;

        IF NEW.program_id IS NOT NULL THEN
            SELECT college_id
            INTO referenced_college_id
            FROM app.programs
            WHERE id = NEW.program_id;

            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION
                    'Program % does not exist',
                    NEW.program_id;
            END IF;

            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Student % and program % belong to different colleges',
                    NEW.id,
                    NEW.program_id;
            END IF;
        END IF;

        IF NEW.course_id IS NOT NULL THEN
            SELECT college_id
            INTO referenced_college_id
            FROM app.courses
            WHERE id = NEW.course_id;

            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION
                    'Course % does not exist',
                    NEW.course_id;
            END IF;

            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Student % and course % belong to different colleges',
                    NEW.id,
                    NEW.course_id;
            END IF;
        END IF;

        IF NEW.batch_id IS NOT NULL THEN
            SELECT college_id
            INTO referenced_college_id
            FROM app.batches
            WHERE id = NEW.batch_id;

            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION
                    'Batch % does not exist',
                    NEW.batch_id;
            END IF;

            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Student % and batch % belong to different colleges',
                    NEW.id,
                    NEW.batch_id;
            END IF;
        END IF;

        IF NEW.academic_year_id IS NOT NULL THEN
            SELECT college_id
            INTO referenced_college_id
            FROM app.academic_years
            WHERE id = NEW.academic_year_id;

            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION
                    'Academic year % does not exist',
                    NEW.academic_year_id;
            END IF;

            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Student % and academic year % belong to different colleges',
                    NEW.id,
                    NEW.academic_year_id;
            END IF;
        END IF;

        IF NEW.semester_id IS NOT NULL THEN
            SELECT college_id
            INTO referenced_college_id
            FROM app.semesters
            WHERE id = NEW.semester_id;

            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION
                    'Semester % does not exist',
                    NEW.semester_id;
            END IF;

            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Student % and semester % belong to different colleges',
                    NEW.id,
                    NEW.semester_id;
            END IF;
        END IF;

    END IF;


    -- --------------------------------------------------------
    -- STUDENT / PARENT RELATIONSHIP
    -- --------------------------------------------------------
    IF TG_TABLE_NAME = 'student_parents' THEN

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
                'Student % and relationship record belong to different colleges',
                NEW.student_id;
        END IF;

        SELECT college_id
        INTO referenced_college_id
        FROM app.parents
        WHERE id = NEW.parent_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Parent % does not exist',
                NEW.parent_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Parent % and relationship record belong to different colleges',
                NEW.parent_id;
        END IF;

    END IF;


    -- --------------------------------------------------------
    -- EMERGENCY CONTACT
    -- --------------------------------------------------------
    IF TG_TABLE_NAME = 'emergency_contacts' THEN

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
                'Student % and emergency contact belong to different colleges',
                NEW.student_id;
        END IF;

    END IF;


    -- --------------------------------------------------------
    -- STAFF PROFILE
    -- --------------------------------------------------------
    IF TG_TABLE_NAME = 'staff_profiles' THEN

        IF NEW.user_id IS NOT NULL THEN
            -- User itself is global/platform identity.
            -- Tenant membership is controlled through user_roles.
            NULL;
        END IF;

    END IF;


    -- --------------------------------------------------------
    -- INCHARGE -> HOSTEL
    -- --------------------------------------------------------
    IF TG_TABLE_NAME = 'incharge_hostels' THEN

        SELECT college_id
        INTO referenced_college_id
        FROM app.staff_profiles
        WHERE id = NEW.staff_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Staff profile % does not exist',
                NEW.staff_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Staff % and assignment belong to different colleges',
                NEW.staff_id;
        END IF;

        SELECT college_id
        INTO referenced_college_id
        FROM app.hostels
        WHERE id = NEW.hostel_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Hostel % does not exist',
                NEW.hostel_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Hostel % and assignment belong to different colleges',
                NEW.hostel_id;
        END IF;

    END IF;


    -- --------------------------------------------------------
    -- SECURITY -> GATE
    -- --------------------------------------------------------
    IF TG_TABLE_NAME = 'security_assignments' THEN

        SELECT college_id
        INTO referenced_college_id
        FROM app.staff_profiles
        WHERE id = NEW.staff_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Staff profile % does not exist',
                NEW.staff_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Staff % and security assignment belong to different colleges',
                NEW.staff_id;
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
                'Gate % and security assignment belong to different colleges',
                NEW.gate_id;
        END IF;

    END IF;


    -- --------------------------------------------------------
    -- BED ALLOCATION -> STUDENT
    -- --------------------------------------------------------
    IF TG_TABLE_NAME = 'bed_allocations' THEN

        IF NEW.student_id IS NOT NULL THEN

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
                    'Student % and bed allocation belong to different colleges',
                    NEW.student_id;
            END IF;

        END IF;

    END IF;


    RETURN NEW;
END;
$$;


-- ============================================================
-- TENANT CONSISTENCY TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_validate_students_tenant
ON app.students;

CREATE TRIGGER trg_validate_students_tenant
BEFORE INSERT OR UPDATE
ON app.students
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


DROP TRIGGER IF EXISTS trg_validate_student_parents_tenant
ON app.student_parents;

CREATE TRIGGER trg_validate_student_parents_tenant
BEFORE INSERT OR UPDATE
ON app.student_parents
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


DROP TRIGGER IF EXISTS trg_validate_emergency_contacts_tenant
ON app.emergency_contacts;

CREATE TRIGGER trg_validate_emergency_contacts_tenant
BEFORE INSERT OR UPDATE
ON app.emergency_contacts
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


DROP TRIGGER IF EXISTS trg_validate_incharge_hostels_tenant
ON app.incharge_hostels;

CREATE TRIGGER trg_validate_incharge_hostels_tenant
BEFORE INSERT OR UPDATE
ON app.incharge_hostels
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


DROP TRIGGER IF EXISTS trg_validate_security_assignments_tenant
ON app.security_assignments;

CREATE TRIGGER trg_validate_security_assignments_tenant
BEFORE INSERT OR UPDATE
ON app.security_assignments
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


DROP TRIGGER IF EXISTS trg_validate_bed_allocations_people_tenant
ON app.bed_allocations;

CREATE TRIGGER trg_validate_bed_allocations_people_tenant
BEFORE INSERT OR UPDATE
ON app.bed_allocations
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


-- ============================================================
-- BUSINESS RULE INDEXES
-- ============================================================

-- Only one primary parent per student.
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_parents_one_primary
ON app.student_parents (student_id)
WHERE is_primary = true;


-- Emergency contact priority must be unique per student.
CREATE UNIQUE INDEX IF NOT EXISTS uq_emergency_contact_priority
ON app.emergency_contacts (student_id, priority);


-- A student can have only one active bed allocation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bed_allocations_one_active_student
ON app.bed_allocations (student_id)
WHERE status = 'ACTIVE'
  AND student_id IS NOT NULL;


-- A bed can have only one active allocation.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bed_allocations_one_active_bed
ON app.bed_allocations (bed_id)
WHERE status = 'ACTIVE';


-- Only one primary incharge assignment for a hostel.
CREATE UNIQUE INDEX IF NOT EXISTS uq_incharge_hostels_one_primary
ON app.incharge_hostels (hostel_id)
WHERE is_primary = true
  AND to_date IS NULL;


-- ============================================================
-- FOREIGN KEY SUPPORTING INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_students_college
ON app.students (college_id);

CREATE INDEX IF NOT EXISTS idx_students_user
ON app.students (user_id);

CREATE INDEX IF NOT EXISTS idx_students_department
ON app.students (department_id);

CREATE INDEX IF NOT EXISTS idx_students_program
ON app.students (program_id);

CREATE INDEX IF NOT EXISTS idx_students_batch
ON app.students (batch_id);

CREATE INDEX IF NOT EXISTS idx_students_status
ON app.students (college_id, status);

CREATE INDEX IF NOT EXISTS idx_parents_college
ON app.parents (college_id);

CREATE INDEX IF NOT EXISTS idx_parents_user
ON app.parents (user_id);

CREATE INDEX IF NOT EXISTS idx_student_parents_student
ON app.student_parents (student_id);

CREATE INDEX IF NOT EXISTS idx_student_parents_parent
ON app.student_parents (parent_id);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_student
ON app.emergency_contacts (student_id);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_college
ON app.staff_profiles (college_id);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_user
ON app.staff_profiles (user_id);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_status
ON app.staff_profiles (college_id, status);

CREATE INDEX IF NOT EXISTS idx_incharge_hostels_staff
ON app.incharge_hostels (staff_id);

CREATE INDEX IF NOT EXISTS idx_incharge_hostels_hostel
ON app.incharge_hostels (hostel_id);

CREATE INDEX IF NOT EXISTS idx_security_assignments_staff
ON app.security_assignments (staff_id);

CREATE INDEX IF NOT EXISTS idx_security_assignments_gate
ON app.security_assignments (gate_id);

CREATE INDEX IF NOT EXISTS idx_bed_allocations_student
ON app.bed_allocations (student_id);


-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE app.staff_profiles IS
'Operational staff profiles linked to app.users. Supports INCHARGE, SECURITY, STAFF and ADMIN staff types.';

COMMENT ON TABLE app.incharge_hostels IS
'Historical hostel responsibility assignments for hostel incharges.';

COMMENT ON TABLE app.security_assignments IS
'Historical gate and shift assignments for security staff.';

COMMENT ON COLUMN app.bed_allocations.student_id IS
'Student currently or historically associated with this bed allocation.';


-- ============================================================
-- COMMIT
-- ============================================================

COMMIT;