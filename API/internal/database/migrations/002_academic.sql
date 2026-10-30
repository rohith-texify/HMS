/*
===============================================================================
HMS - ACADEMIC DOMAIN
Migration: 002_academic.sql

Purpose:
    Creates the academic master-data layer used by:
        - Students
        - Hostel allocations
        - Attendance
        - Leave management
        - Reports
        - Academic filtering

Dependencies:
    000_extensions.sql
    001_platform.sql

Tenant Model:
    Every academic record belongs to exactly one college.

Design Principles:
    - UUID primary keys
    - UTC timestamps
    - College/tenant isolation
    - Historical records are retained
    - Status-based deactivation instead of hard deletion
    - Strong foreign-key relationships
    - Business-level uniqueness enforced by constraints
===============================================================================
*/

BEGIN;


-- ============================================================================
-- 1. DEPARTMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.departments (

    department_id       uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,

    code                citext NOT NULL,
    name                text NOT NULL,
    description         text,

    head_user_id        uuid,

    status              text NOT NULL DEFAULT 'ACTIVE',

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_departments_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_departments_head_user
        FOREIGN KEY (head_user_id)
        REFERENCES app.users(user_id)
        ON DELETE SET NULL,

    CONSTRAINT chk_departments_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    CONSTRAINT chk_departments_code_not_empty
        CHECK (
            length(trim(code::text)) > 0
        ),

    CONSTRAINT chk_departments_name_not_empty
        CHECK (
            length(trim(name)) > 0
        ),

    CONSTRAINT uq_departments_college_code
        UNIQUE (college_id, code),

    CONSTRAINT uq_departments_college_name
        UNIQUE (college_id, name)
);


COMMENT ON TABLE app.departments IS
'Academic departments belonging to a college.';

COMMENT ON COLUMN app.departments.department_id IS
'Unique identifier of the academic department.';

COMMENT ON COLUMN app.departments.college_id IS
'Tenant/college that owns the department.';

COMMENT ON COLUMN app.departments.code IS
'Unique department code within a college.';

COMMENT ON COLUMN app.departments.head_user_id IS
'Optional user responsible for heading the department.';


-- ============================================================================
-- 2. PROGRAMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.programs (

    program_id          uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    department_id       uuid NOT NULL,

    code                citext NOT NULL,
    name                text NOT NULL,
    description         text,

    duration_years      numeric(4,2),
    duration_semesters  integer,

    status              text NOT NULL DEFAULT 'ACTIVE',

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_programs_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_programs_department
        FOREIGN KEY (department_id)
        REFERENCES app.departments(department_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_programs_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    CONSTRAINT chk_programs_code_not_empty
        CHECK (
            length(trim(code::text)) > 0
        ),

    CONSTRAINT chk_programs_name_not_empty
        CHECK (
            length(trim(name)) > 0
        ),

    CONSTRAINT chk_programs_duration_years
        CHECK (
            duration_years IS NULL
            OR duration_years > 0
        ),

    CONSTRAINT chk_programs_duration_semesters
        CHECK (
            duration_semesters IS NULL
            OR duration_semesters > 0
        ),

    CONSTRAINT uq_programs_college_code
        UNIQUE (college_id, code),

    CONSTRAINT uq_programs_college_name
        UNIQUE (college_id, name)
);


COMMENT ON TABLE app.programs IS
'Academic programs offered by departments within a college.';

COMMENT ON COLUMN app.programs.program_id IS
'Unique identifier of the academic program.';

COMMENT ON COLUMN app.programs.department_id IS
'Department that owns the academic program.';

COMMENT ON COLUMN app.programs.duration_years IS
'Program duration expressed in academic years.';

COMMENT ON COLUMN app.programs.duration_semesters IS
'Program duration expressed in semesters.';


-- ============================================================================
-- 3. COURSES
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.courses (

    course_id           uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    department_id       uuid NOT NULL,
    program_id          uuid,

    code                citext NOT NULL,
    name                text NOT NULL,
    description         text,

    credits             numeric(5,2),
    semester_number     integer,

    status              text NOT NULL DEFAULT 'ACTIVE',

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_courses_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_courses_department
        FOREIGN KEY (department_id)
        REFERENCES app.departments(department_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_courses_program
        FOREIGN KEY (program_id)
        REFERENCES app.programs(program_id)
        ON DELETE SET NULL,

    CONSTRAINT chk_courses_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    CONSTRAINT chk_courses_code_not_empty
        CHECK (
            length(trim(code::text)) > 0
        ),

    CONSTRAINT chk_courses_name_not_empty
        CHECK (
            length(trim(name)) > 0
        ),

    CONSTRAINT chk_courses_credits
        CHECK (
            credits IS NULL
            OR credits >= 0
        ),

    CONSTRAINT chk_courses_semester_number
        CHECK (
            semester_number IS NULL
            OR semester_number > 0
        ),

    CONSTRAINT uq_courses_college_code
        UNIQUE (college_id, code)
);


COMMENT ON TABLE app.courses IS
'Academic courses/subjects offered by the college.';

COMMENT ON COLUMN app.courses.course_id IS
'Unique identifier of the academic course.';

COMMENT ON COLUMN app.courses.department_id IS
'Department responsible for the course.';

COMMENT ON COLUMN app.courses.program_id IS
'Optional program association when a course is specific to a program.';

COMMENT ON COLUMN app.courses.semester_number IS
'Optional semester number in which the course is normally offered.';


-- ============================================================================
-- 4. ACADEMIC YEARS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.academic_years (

    academic_year_id   uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id         uuid NOT NULL,

    code               citext NOT NULL,
    name               text NOT NULL,

    start_date         date NOT NULL,
    end_date           date NOT NULL,

    status             text NOT NULL DEFAULT 'ACTIVE',
    is_current         boolean NOT NULL DEFAULT false,

    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_academic_years_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_academic_years_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'COMPLETED'
            )
        ),

    CONSTRAINT chk_academic_years_dates
        CHECK (
            end_date > start_date
        ),

    CONSTRAINT chk_academic_years_code_not_empty
        CHECK (
            length(trim(code::text)) > 0
        ),

    CONSTRAINT chk_academic_years_name_not_empty
        CHECK (
            length(trim(name)) > 0
        ),

    CONSTRAINT uq_academic_years_college_code
        UNIQUE (college_id, code)
);


COMMENT ON TABLE app.academic_years IS
'Academic years maintained independently for each college.';

COMMENT ON COLUMN app.academic_years.academic_year_id IS
'Unique identifier of the academic year.';

COMMENT ON COLUMN app.academic_years.is_current IS
'Indicates the academic year currently used by the college.';


-- ============================================================================
-- 5. SEMESTERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.semesters (

    semester_id         uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    academic_year_id    uuid NOT NULL,

    code                citext NOT NULL,
    name                text NOT NULL,

    semester_number     integer NOT NULL,

    start_date          date,
    end_date            date,

    status              text NOT NULL DEFAULT 'ACTIVE',

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_semesters_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_semesters_academic_year
        FOREIGN KEY (academic_year_id)
        REFERENCES app.academic_years(academic_year_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_semesters_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'COMPLETED'
            )
        ),

    CONSTRAINT chk_semesters_number
        CHECK (
            semester_number > 0
        ),

    CONSTRAINT chk_semesters_dates
        CHECK (
            start_date IS NULL
            OR end_date IS NULL
            OR end_date > start_date
        ),

    CONSTRAINT chk_semesters_code_not_empty
        CHECK (
            length(trim(code::text)) > 0
        ),

    CONSTRAINT chk_semesters_name_not_empty
        CHECK (
            length(trim(name)) > 0
        ),

    CONSTRAINT uq_semesters_academic_year_number
        UNIQUE (academic_year_id, semester_number),

    CONSTRAINT uq_semesters_academic_year_code
        UNIQUE (academic_year_id, code)
);


COMMENT ON TABLE app.semesters IS
'Semesters belonging to a specific academic year.';

COMMENT ON COLUMN app.semesters.semester_id IS
'Unique identifier of the semester.';

COMMENT ON COLUMN app.semesters.semester_number IS
'Sequential semester number within the academic year.';


-- ============================================================================
-- 6. BATCHES
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.batches (

    batch_id            uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    program_id          uuid NOT NULL,
    academic_year_id    uuid NOT NULL,

    code                citext NOT NULL,
    name                text NOT NULL,

    admission_year      integer,
    graduation_year     integer,

    start_date          date,
    end_date            date,

    status              text NOT NULL DEFAULT 'ACTIVE',

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_batches_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_batches_program
        FOREIGN KEY (program_id)
        REFERENCES app.programs(program_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_batches_academic_year
        FOREIGN KEY (academic_year_id)
        REFERENCES app.academic_years(academic_year_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_batches_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'COMPLETED'
            )
        ),

    CONSTRAINT chk_batches_code_not_empty
        CHECK (
            length(trim(code::text)) > 0
        ),

    CONSTRAINT chk_batches_name_not_empty
        CHECK (
            length(trim(name)) > 0
        ),

    CONSTRAINT chk_batches_admission_year
        CHECK (
            admission_year IS NULL
            OR admission_year BETWEEN 1900 AND 2200
        ),

    CONSTRAINT chk_batches_graduation_year
        CHECK (
            graduation_year IS NULL
            OR graduation_year BETWEEN 1900 AND 2200
        ),

    CONSTRAINT chk_batches_year_range
        CHECK (
            admission_year IS NULL
            OR graduation_year IS NULL
            OR graduation_year >= admission_year
        ),

    CONSTRAINT chk_batches_dates
        CHECK (
            start_date IS NULL
            OR end_date IS NULL
            OR end_date > start_date
        ),

    CONSTRAINT uq_batches_college_code
        UNIQUE (college_id, code)
);


COMMENT ON TABLE app.batches IS
'Student cohorts/batches associated with academic programs and years.';

COMMENT ON COLUMN app.batches.batch_id IS
'Unique identifier of the student batch.';

COMMENT ON COLUMN app.batches.program_id IS
'Academic program associated with the batch.';

COMMENT ON COLUMN app.batches.academic_year_id IS
'Academic year under which the batch is associated.';

COMMENT ON COLUMN app.batches.admission_year IS
'Calendar year in which the batch was admitted.';

COMMENT ON COLUMN app.batches.graduation_year IS
'Expected or actual calendar year of graduation.';


-- ============================================================================
-- 7. CROSS-TENANT CONSISTENCY FUNCTION
-- ============================================================================
-- Foreign keys guarantee that referenced records exist.
--
-- These triggers additionally guarantee that related academic records belong
-- to the SAME college/tenant.
-- ============================================================================

CREATE OR REPLACE FUNCTION app.validate_academic_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    referenced_college_id uuid;
BEGIN

    --------------------------------------------------------------------------
    -- PROGRAM -> DEPARTMENT
    --------------------------------------------------------------------------

    IF TG_TABLE_NAME = 'programs' THEN

        SELECT d.college_id
        INTO referenced_college_id
        FROM app.departments d
        WHERE d.department_id = NEW.department_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Department % does not exist',
                NEW.department_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant violation: program % and department % belong to different colleges',
                NEW.program_id,
                NEW.department_id;
        END IF;

    END IF;


    --------------------------------------------------------------------------
    -- COURSE -> DEPARTMENT / PROGRAM
    --------------------------------------------------------------------------

    IF TG_TABLE_NAME = 'courses' THEN

        SELECT d.college_id
        INTO referenced_college_id
        FROM app.departments d
        WHERE d.department_id = NEW.department_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Department % does not exist',
                NEW.department_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant violation: course % and department % belong to different colleges',
                NEW.course_id,
                NEW.department_id;
        END IF;


        IF NEW.program_id IS NOT NULL THEN

            SELECT p.college_id
            INTO referenced_college_id
            FROM app.programs p
            WHERE p.program_id = NEW.program_id;

            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION
                    'Program % does not exist',
                    NEW.program_id;
            END IF;

            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Tenant violation: course % and program % belong to different colleges',
                    NEW.course_id,
                    NEW.program_id;
            END IF;

        END IF;

    END IF;


    --------------------------------------------------------------------------
    -- SEMESTER -> ACADEMIC YEAR
    --------------------------------------------------------------------------

    IF TG_TABLE_NAME = 'semesters' THEN

        SELECT ay.college_id
        INTO referenced_college_id
        FROM app.academic_years ay
        WHERE ay.academic_year_id = NEW.academic_year_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Academic year % does not exist',
                NEW.academic_year_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant violation: semester % and academic year % belong to different colleges',
                NEW.semester_id,
                NEW.academic_year_id;
        END IF;

    END IF;


    --------------------------------------------------------------------------
    -- BATCH -> PROGRAM / ACADEMIC YEAR
    --------------------------------------------------------------------------

    IF TG_TABLE_NAME = 'batches' THEN

        SELECT p.college_id
        INTO referenced_college_id
        FROM app.programs p
        WHERE p.program_id = NEW.program_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Program % does not exist',
                NEW.program_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant violation: batch % and program % belong to different colleges',
                NEW.batch_id,
                NEW.program_id;
        END IF;


        SELECT ay.college_id
        INTO referenced_college_id
        FROM app.academic_years ay
        WHERE ay.academic_year_id = NEW.academic_year_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Academic year % does not exist',
                NEW.academic_year_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant violation: batch % and academic year % belong to different colleges',
                NEW.batch_id,
                NEW.academic_year_id;
        END IF;

    END IF;


    RETURN NEW;

END;
$$;


COMMENT ON FUNCTION app.validate_academic_tenant_consistency() IS
'Ensures related academic records always belong to the same college tenant.';


-- ============================================================================
-- 8. TENANT CONSISTENCY TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_programs_tenant_consistency
ON app.programs;

CREATE TRIGGER trg_programs_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.programs
FOR EACH ROW
EXECUTE FUNCTION app.validate_academic_tenant_consistency();


DROP TRIGGER IF EXISTS trg_courses_tenant_consistency
ON app.courses;

CREATE TRIGGER trg_courses_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.courses
FOR EACH ROW
EXECUTE FUNCTION app.validate_academic_tenant_consistency();


DROP TRIGGER IF EXISTS trg_semesters_tenant_consistency
ON app.semesters;

CREATE TRIGGER trg_semesters_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.semesters
FOR EACH ROW
EXECUTE FUNCTION app.validate_academic_tenant_consistency();


DROP TRIGGER IF EXISTS trg_batches_tenant_consistency
ON app.batches;

CREATE TRIGGER trg_batches_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.batches
FOR EACH ROW
EXECUTE FUNCTION app.validate_academic_tenant_consistency();


-- ============================================================================
-- 9. CURRENT ACADEMIC YEAR SAFETY
-- ============================================================================
-- A college can have only one current academic year.

CREATE UNIQUE INDEX IF NOT EXISTS uq_academic_years_one_current_per_college
ON app.academic_years (college_id)
WHERE is_current = TRUE;


-- ============================================================================
-- 10. INDEXES
-- ============================================================================
-- Foreign-key and common filtering indexes are created here so the academic
-- layer is performant before the global index migration runs.

CREATE INDEX IF NOT EXISTS idx_departments_college
ON app.departments (college_id);

CREATE INDEX IF NOT EXISTS idx_departments_head_user
ON app.departments (head_user_id);

CREATE INDEX IF NOT EXISTS idx_programs_college
ON app.programs (college_id);

CREATE INDEX IF NOT EXISTS idx_programs_department
ON app.programs (department_id);

CREATE INDEX IF NOT EXISTS idx_courses_college
ON app.courses (college_id);

CREATE INDEX IF NOT EXISTS idx_courses_department
ON app.courses (department_id);

CREATE INDEX IF NOT EXISTS idx_courses_program
ON app.courses (program_id);

CREATE INDEX IF NOT EXISTS idx_academic_years_college
ON app.academic_years (college_id);

CREATE INDEX IF NOT EXISTS idx_academic_years_current
ON app.academic_years (college_id)
WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_semesters_college
ON app.semesters (college_id);

CREATE INDEX IF NOT EXISTS idx_semesters_academic_year
ON app.semesters (academic_year_id);

CREATE INDEX IF NOT EXISTS idx_batches_college
ON app.batches (college_id);

CREATE INDEX IF NOT EXISTS idx_batches_program
ON app.batches (program_id);

CREATE INDEX IF NOT EXISTS idx_batches_academic_year
ON app.batches (academic_year_id);


-- ============================================================================
-- 11. DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE app.departments IS
'Academic departments belonging to a college.';

COMMENT ON TABLE app.programs IS
'Academic programs offered by departments within a college.';

COMMENT ON TABLE app.courses IS
'Academic courses or subjects offered by the college.';

COMMENT ON TABLE app.academic_years IS
'Academic years maintained independently for each college.';

COMMENT ON TABLE app.semesters IS
'Semesters belonging to academic years.';

COMMENT ON TABLE app.batches IS
'Student cohorts associated with academic programs and academic years.';


-- ============================================================================
-- COMMIT
-- ============================================================================

COMMIT;


/*
===============================================================================
END OF 002_academic.sql
===============================================================================
*/




