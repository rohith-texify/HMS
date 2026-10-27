BEGIN;

-- ============================================================
-- HMS - 004 PEOPLE
-- ============================================================
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
--   app.bed_allocations
--
-- IMPORTANT ACTUAL PRIMARY KEYS
--
-- platform.colleges       -> college_id
-- app.users               -> user_id
-- app.departments         -> department_id
-- app.programs            -> program_id
-- app.courses             -> course_id
-- app.academic_years      -> academic_year_id
-- app.semesters           -> semester_id
-- app.batches             -> batch_id
-- app.hostels             -> id
-- app.gates               -> id
-- app.bed_allocations     -> id
--
-- ============================================================


-- ============================================================
-- 1. STUDENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.students (
    id UUID PRIMARY KEY
        DEFAULT platform.generate_uuid(),

    college_id UUID NOT NULL,

    user_id UUID,

    admission_number VARCHAR(100) NOT NULL,
    registration_number VARCHAR(100),
    roll_number VARCHAR(100),

    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100),

    date_of_birth DATE,

    gender VARCHAR(30),

    blood_group VARCHAR(10),

    phone VARCHAR(30),
    email CITEXT,

    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),

    department_id UUID,
    program_id UUID,
    course_id UUID,
    batch_id UUID,

    academic_year_id UUID,
    semester_id UUID,

    admission_date DATE,

    student_status VARCHAR(30) NOT NULL
        DEFAULT 'ACTIVE',

    hostel_status VARCHAR(30) NOT NULL
        DEFAULT 'NOT_ALLOCATED',

    metadata JSONB NOT NULL
        DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_students_college_admission
        UNIQUE (
            college_id,
            admission_number
        ),

    CONSTRAINT uq_students_college_registration
        UNIQUE (
            college_id,
            registration_number
        ),

    CONSTRAINT uq_students_college_roll
        UNIQUE (
            college_id,
            roll_number
        ),

    CONSTRAINT chk_students_status
        CHECK (
            student_status IN (
                'ACTIVE',
                'INACTIVE',
                'SUSPENDED',
                'GRADUATED',
                'TRANSFERRED',
                'DROPPED'
            )
        ),

    CONSTRAINT chk_students_hostel_status
        CHECK (
            hostel_status IN (
                'NOT_ALLOCATED',
                'ALLOCATED',
                'VACATED',
                'BLOCKED'
            )
        ),

    CONSTRAINT fk_students_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_students_user
        FOREIGN KEY (user_id)
        REFERENCES app.users(user_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_students_department
        FOREIGN KEY (department_id)
        REFERENCES app.departments(department_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_students_program
        FOREIGN KEY (program_id)
        REFERENCES app.programs(program_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_students_course
        FOREIGN KEY (course_id)
        REFERENCES app.courses(course_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_students_batch
        FOREIGN KEY (batch_id)
        REFERENCES app.batches(batch_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_students_academic_year
        FOREIGN KEY (academic_year_id)
        REFERENCES app.academic_years(academic_year_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_students_semester
        FOREIGN KEY (semester_id)
        REFERENCES app.semesters(semester_id)
        ON DELETE SET NULL

);


-- ============================================================
-- 2. PARENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.parents (
    id UUID PRIMARY KEY
        DEFAULT platform.generate_uuid(),

    college_id UUID NOT NULL,

    user_id UUID,

    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100),

    relationship VARCHAR(50),

    phone VARCHAR(30),
    alternate_phone VARCHAR(30),

    email CITEXT,

    occupation VARCHAR(150),

    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_parents_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_parents_user
        FOREIGN KEY (user_id)
        REFERENCES app.users(user_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 3. STUDENT - PARENT RELATIONSHIP
-- ============================================================

CREATE TABLE IF NOT EXISTS app.student_parents (
    id UUID PRIMARY KEY
        DEFAULT platform.generate_uuid(),

    college_id UUID NOT NULL,

    student_id UUID NOT NULL,
    parent_id UUID NOT NULL,

    relationship VARCHAR(50),

    is_primary BOOLEAN NOT NULL
        DEFAULT FALSE,

    can_receive_notifications BOOLEAN NOT NULL
        DEFAULT TRUE,

    can_pickup_student BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_student_parents_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_student_parents_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_student_parents_parent
        FOREIGN KEY (parent_id)
        REFERENCES app.parents(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_student_parent
        UNIQUE (
            student_id,
            parent_id
        )
);


-- ============================================================
-- 4. EMERGENCY CONTACTS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.emergency_contacts (
    id UUID PRIMARY KEY
        DEFAULT platform.generate_uuid(),

    college_id UUID NOT NULL,

    student_id UUID NOT NULL,

    contact_name VARCHAR(150) NOT NULL,

    relationship VARCHAR(100),

    phone VARCHAR(30) NOT NULL,
    alternate_phone VARCHAR(30),

    email CITEXT,

    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),

    is_primary BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_emergency_contacts_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_emergency_contacts_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE CASCADE
);


-- ============================================================
-- 5. STAFF PROFILES
-- ============================================================

CREATE TABLE IF NOT EXISTS app.staff_profiles (
    id UUID PRIMARY KEY
        DEFAULT platform.generate_uuid(),

    college_id UUID NOT NULL,

    user_id UUID NOT NULL,

    employee_number VARCHAR(100),

    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(100),

    designation VARCHAR(150),

    department_id UUID,

    phone VARCHAR(30),
    alternate_phone VARCHAR(30),

    email CITEXT,

    joining_date DATE,

    employment_status VARCHAR(30) NOT NULL
        DEFAULT 'ACTIVE',

    metadata JSONB NOT NULL
        DEFAULT '{}'::JSONB,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_staff_college_employee
        UNIQUE (
            college_id,
            employee_number
        ),

    CONSTRAINT uq_staff_college_user
        UNIQUE (
            college_id,
            user_id
        ),

    CONSTRAINT chk_staff_employment_status
        CHECK (
            employment_status IN (
                'ACTIVE',
                'INACTIVE',
                'SUSPENDED',
                'RESIGNED',
                'TERMINATED',
                'RETIRED'
            )
        ),

    CONSTRAINT fk_staff_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_staff_user
        FOREIGN KEY (user_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_staff_department
        FOREIGN KEY (department_id)
        REFERENCES app.departments(department_id)
        ON DELETE SET NULL
);


-- ============================================================
-- 6. HOSTEL INCHARGES
-- ============================================================

CREATE TABLE IF NOT EXISTS app.incharge_hostels (
    id UUID PRIMARY KEY
        DEFAULT platform.generate_uuid(),

    college_id UUID NOT NULL,

    staff_id UUID NOT NULL,
    hostel_id UUID NOT NULL,

    assigned_from DATE NOT NULL
        DEFAULT CURRENT_DATE,

    assigned_until DATE,

    is_primary BOOLEAN NOT NULL
        DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_incharge_hostel_dates
        CHECK (
            assigned_until IS NULL
            OR assigned_until >= assigned_from
        ),

    CONSTRAINT fk_incharge_hostels_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_incharge_hostels_staff
        FOREIGN KEY (staff_id)
        REFERENCES app.staff_profiles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_incharge_hostels_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE CASCADE
);


-- ============================================================
-- 7. SECURITY ASSIGNMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS app.security_assignments (
    id UUID PRIMARY KEY
        DEFAULT platform.generate_uuid(),

    college_id UUID NOT NULL,

    staff_id UUID NOT NULL,
    gate_id UUID NOT NULL,

    shift_name VARCHAR(100),

    shift_start TIME,
    shift_end TIME,

    assigned_from DATE NOT NULL
        DEFAULT CURRENT_DATE,

    assigned_until DATE,

    is_active BOOLEAN NOT NULL
        DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_security_assignment_dates
        CHECK (
            assigned_until IS NULL
            OR assigned_until >= assigned_from
        ),

    CONSTRAINT fk_security_assignments_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_security_assignments_staff
        FOREIGN KEY (staff_id)
        REFERENCES app.staff_profiles(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_security_assignments_gate
        FOREIGN KEY (gate_id)
        REFERENCES app.gates(id)
        ON DELETE CASCADE
);


-- ============================================================
-- 8. EXTEND BED ALLOCATIONS
-- ============================================================

ALTER TABLE app.bed_allocations
    ADD COLUMN IF NOT EXISTS student_id UUID;


ALTER TABLE app.bed_allocations
    DROP CONSTRAINT IF EXISTS fk_bed_allocations_student;


ALTER TABLE app.bed_allocations
    ADD CONSTRAINT fk_bed_allocations_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE SET NULL;


-- ============================================================
-- 9. PEOPLE TENANT CONSISTENCY FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION app.validate_people_tenant_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    referenced_college UUID;
BEGIN

    -- ========================================================
    -- STUDENTS
    -- ========================================================

    IF TG_TABLE_NAME = 'students' THEN

        IF NEW.department_id IS NOT NULL THEN

            SELECT college_id
            INTO referenced_college
            FROM app.departments
            WHERE department_id = NEW.department_id;

            IF referenced_college IS NOT NULL
               AND referenced_college <> NEW.college_id THEN

                RAISE EXCEPTION
                    'Student department belongs to another college';

            END IF;

        END IF;


        IF NEW.program_id IS NOT NULL THEN

            SELECT college_id
            INTO referenced_college
            FROM app.programs
            WHERE program_id = NEW.program_id;

            IF referenced_college IS NOT NULL
               AND referenced_college <> NEW.college_id THEN

                RAISE EXCEPTION
                    'Student program belongs to another college';

            END IF;

        END IF;


        IF NEW.course_id IS NOT NULL THEN

            SELECT college_id
            INTO referenced_college
            FROM app.courses
            WHERE course_id = NEW.course_id;

            IF referenced_college IS NOT NULL
               AND referenced_college <> NEW.college_id THEN

                RAISE EXCEPTION
                    'Student course belongs to another college';

            END IF;

        END IF;


        IF NEW.batch_id IS NOT NULL THEN

            SELECT college_id
            INTO referenced_college
            FROM app.batches
            WHERE batch_id = NEW.batch_id;

            IF referenced_college IS NOT NULL
               AND referenced_college <> NEW.college_id THEN

                RAISE EXCEPTION
                    'Student batch belongs to another college';

            END IF;

        END IF;


        IF NEW.academic_year_id IS NOT NULL THEN

            SELECT college_id
            INTO referenced_college
            FROM app.academic_years
            WHERE academic_year_id = NEW.academic_year_id;

            IF referenced_college IS NOT NULL
               AND referenced_college <> NEW.college_id THEN

                RAISE EXCEPTION
                    'Student academic year belongs to another college';

            END IF;

        END IF;


        IF NEW.semester_id IS NOT NULL THEN

            SELECT college_id
            INTO referenced_college
            FROM app.semesters
            WHERE semester_id = NEW.semester_id;

            IF referenced_college IS NOT NULL
               AND referenced_college <> NEW.college_id THEN

                RAISE EXCEPTION
                    'Student semester belongs to another college';

            END IF;

        END IF;

    END IF;


    -- ========================================================
    -- STUDENT PARENTS
    -- ========================================================

    IF TG_TABLE_NAME = 'student_parents' THEN

        SELECT college_id
        INTO referenced_college
        FROM app.students
        WHERE id = NEW.student_id;

        IF referenced_college IS NOT NULL
           AND referenced_college <> NEW.college_id THEN

            RAISE EXCEPTION
                'Student belongs to another college';

        END IF;


        SELECT college_id
        INTO referenced_college
        FROM app.parents
        WHERE id = NEW.parent_id;

        IF referenced_college IS NOT NULL
           AND referenced_college <> NEW.college_id THEN

            RAISE EXCEPTION
                'Parent belongs to another college';

        END IF;

    END IF;


    -- ========================================================
    -- EMERGENCY CONTACTS
    -- ========================================================

    IF TG_TABLE_NAME = 'emergency_contacts' THEN

        SELECT college_id
        INTO referenced_college
        FROM app.students
        WHERE id = NEW.student_id;

        IF referenced_college IS NOT NULL
           AND referenced_college <> NEW.college_id THEN

            RAISE EXCEPTION
                'Emergency contact student belongs to another college';

        END IF;

    END IF;


    -- ========================================================
    -- STAFF
    -- ========================================================

    IF TG_TABLE_NAME = 'staff_profiles' THEN

        IF NEW.department_id IS NOT NULL THEN

            SELECT college_id
            INTO referenced_college
            FROM app.departments
            WHERE department_id = NEW.department_id;

            IF referenced_college IS NOT NULL
               AND referenced_college <> NEW.college_id THEN

                RAISE EXCEPTION
                    'Staff department belongs to another college';

            END IF;

        END IF;

    END IF;


    -- ========================================================
    -- HOSTEL INCHARGE
    -- ========================================================

    IF TG_TABLE_NAME = 'incharge_hostels' THEN

        SELECT college_id
        INTO referenced_college
        FROM app.staff_profiles
        WHERE id = NEW.staff_id;

        IF referenced_college IS NOT NULL
           AND referenced_college <> NEW.college_id THEN

            RAISE EXCEPTION
                'Staff member belongs to another college';

        END IF;


        SELECT college_id
        INTO referenced_college
        FROM app.hostels
        WHERE id = NEW.hostel_id;

        IF referenced_college IS NOT NULL
           AND referenced_college <> NEW.college_id THEN

            RAISE EXCEPTION
                'Hostel belongs to another college';

        END IF;

    END IF;


    -- ========================================================
    -- SECURITY ASSIGNMENTS
    -- ========================================================

    IF TG_TABLE_NAME = 'security_assignments' THEN

        SELECT college_id
        INTO referenced_college
        FROM app.staff_profiles
        WHERE id = NEW.staff_id;

        IF referenced_college IS NOT NULL
           AND referenced_college <> NEW.college_id THEN

            RAISE EXCEPTION
                'Security staff member belongs to another college';

        END IF;


        SELECT college_id
        INTO referenced_college
        FROM app.gates
        WHERE id = NEW.gate_id;

        IF referenced_college IS NOT NULL
           AND referenced_college <> NEW.college_id THEN

            RAISE EXCEPTION
                'Gate belongs to another college';

        END IF;

    END IF;


    RETURN NEW;

END;
$$;


-- ============================================================
-- 10. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS trg_students_tenant_consistency
ON app.students;

CREATE TRIGGER trg_students_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.students
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


DROP TRIGGER IF EXISTS trg_student_parents_tenant_consistency
ON app.student_parents;

CREATE TRIGGER trg_student_parents_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.student_parents
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


DROP TRIGGER IF EXISTS trg_emergency_contacts_tenant_consistency
ON app.emergency_contacts;

CREATE TRIGGER trg_emergency_contacts_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.emergency_contacts
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


DROP TRIGGER IF EXISTS trg_staff_profiles_tenant_consistency
ON app.staff_profiles;

CREATE TRIGGER trg_staff_profiles_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.staff_profiles
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


DROP TRIGGER IF EXISTS trg_incharge_hostels_tenant_consistency
ON app.incharge_hostels;

CREATE TRIGGER trg_incharge_hostels_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.incharge_hostels
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


DROP TRIGGER IF EXISTS trg_security_assignments_tenant_consistency
ON app.security_assignments;

CREATE TRIGGER trg_security_assignments_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.security_assignments
FOR EACH ROW
EXECUTE FUNCTION app.validate_people_tenant_consistency();


-- ============================================================
-- 11. UNIQUE INDEXES
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS ux_students_primary_parent
ON app.student_parents(student_id)
WHERE is_primary = TRUE;


CREATE UNIQUE INDEX IF NOT EXISTS ux_emergency_contacts_primary
ON app.emergency_contacts(student_id)
WHERE is_primary = TRUE;


CREATE UNIQUE INDEX IF NOT EXISTS ux_incharge_hostels_primary
ON app.incharge_hostels(hostel_id)
WHERE is_primary = TRUE
  AND assigned_until IS NULL;


-- ============================================================
-- 12. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_students_college
ON app.students(college_id);

CREATE INDEX IF NOT EXISTS idx_students_user
ON app.students(user_id);

CREATE INDEX IF NOT EXISTS idx_students_department
ON app.students(department_id);

CREATE INDEX IF NOT EXISTS idx_students_program
ON app.students(program_id);

CREATE INDEX IF NOT EXISTS idx_students_course
ON app.students(course_id);

CREATE INDEX IF NOT EXISTS idx_students_batch
ON app.students(batch_id);

CREATE INDEX IF NOT EXISTS idx_students_academic_year
ON app.students(academic_year_id);

CREATE INDEX IF NOT EXISTS idx_students_semester
ON app.students(semester_id);


CREATE INDEX IF NOT EXISTS idx_parents_college
ON app.parents(college_id);

CREATE INDEX IF NOT EXISTS idx_parents_user
ON app.parents(user_id);


CREATE INDEX IF NOT EXISTS idx_student_parents_college
ON app.student_parents(college_id);

CREATE INDEX IF NOT EXISTS idx_student_parents_student
ON app.student_parents(student_id);

CREATE INDEX IF NOT EXISTS idx_student_parents_parent
ON app.student_parents(parent_id);


CREATE INDEX IF NOT EXISTS idx_emergency_contacts_college
ON app.emergency_contacts(college_id);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_student
ON app.emergency_contacts(student_id);


CREATE INDEX IF NOT EXISTS idx_staff_profiles_college
ON app.staff_profiles(college_id);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_user
ON app.staff_profiles(user_id);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_department
ON app.staff_profiles(department_id);


CREATE INDEX IF NOT EXISTS idx_incharge_hostels_college
ON app.incharge_hostels(college_id);

CREATE INDEX IF NOT EXISTS idx_incharge_hostels_staff
ON app.incharge_hostels(staff_id);

CREATE INDEX IF NOT EXISTS idx_incharge_hostels_hostel
ON app.incharge_hostels(hostel_id);


CREATE INDEX IF NOT EXISTS idx_security_assignments_college
ON app.security_assignments(college_id);

CREATE INDEX IF NOT EXISTS idx_security_assignments_staff
ON app.security_assignments(staff_id);

CREATE INDEX IF NOT EXISTS idx_security_assignments_gate
ON app.security_assignments(gate_id);


CREATE INDEX IF NOT EXISTS idx_bed_allocations_student
ON app.bed_allocations(student_id);


-- ============================================================
-- 13. SUCCESS
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================';
    RAISE NOTICE '004_people.sql COMPLETED SUCCESSFULLY';
    RAISE NOTICE '============================================================';
END $$;


COMMIT;