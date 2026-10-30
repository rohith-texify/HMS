-- ============================================================
-- HMS DATABASE
-- Migration: 009_meals_resources.sql
-- Module: Meals / Mess / Resources / Saved Reports / Files
--
-- Creates:
--   1. meal_menus
--   2. meal_timings
--   3. mess_notices
--   4. food_feedback
--   5. resource_items
--   6. resource_availability
--   7. reports_saved
--   8. files
--
-- Design:
--   - College-owned records carry college_id
--   - Hostel-linked records are tenant validated
--   - History is retained
--   - Status based lifecycle
--   - UTC timestamps
--   - ON DELETE RESTRICT for operational history
-- ============================================================

BEGIN;

-- ============================================================
-- 1. MEAL MENUS
-- ============================================================

CREATE TABLE app.meal_menus (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    hostel_id uuid NOT NULL,

    menu_date date NOT NULL,

    meal_type varchar(20) NOT NULL
        CHECK (
            meal_type IN (
                'BREAKFAST',
                'LUNCH',
                'SNACKS',
                'DINNER'
            )
        ),

    items text NOT NULL,

    status varchar(20) NOT NULL DEFAULT 'PUBLISHED'
        CHECK (
            status IN (
                'DRAFT',
                'PUBLISHED',
                'CANCELLED'
            )
        ),

    created_by uuid NOT NULL,
    updated_by uuid,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_meal_menus_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_meal_menus_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_meal_menus_created_by
        FOREIGN KEY (created_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_meal_menus_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_meal_menu
        UNIQUE (hostel_id, menu_date, meal_type)
);

-- ============================================================
-- 2. MEAL TIMINGS
-- ============================================================

CREATE TABLE app.meal_timings (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    hostel_id uuid NOT NULL,

    meal_type varchar(20) NOT NULL
        CHECK (
            meal_type IN (
                'BREAKFAST',
                'LUNCH',
                'SNACKS',
                'DINNER'
            )
        ),

    start_time time NOT NULL,
    end_time time NOT NULL,

    status varchar(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    created_by uuid NOT NULL,
    updated_by uuid,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_meal_timings_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_meal_timings_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_meal_timings_created_by
        FOREIGN KEY (created_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_meal_timings_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_meal_timing
        UNIQUE (hostel_id, meal_type),

    CONSTRAINT chk_meal_timing_range
        CHECK (end_time > start_time)
);

-- ============================================================
-- 3. MESS NOTICES
-- ============================================================

CREATE TABLE app.mess_notices (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    hostel_id uuid NOT NULL,

    title varchar(255) NOT NULL,
    content text NOT NULL,

    status varchar(20) NOT NULL DEFAULT 'PUBLISHED'
        CHECK (
            status IN (
                'DRAFT',
                'PUBLISHED',
                'EXPIRED',
                'CANCELLED'
            )
        ),

    publish_at timestamptz,
    expires_at timestamptz,

    published_by uuid,
    created_by uuid NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_mess_notices_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_mess_notices_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_mess_notices_published_by
        FOREIGN KEY (published_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_mess_notices_created_by
        FOREIGN KEY (created_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_mess_notice_expiry
        CHECK (
            expires_at IS NULL
            OR publish_at IS NULL
            OR expires_at >= publish_at
        )
);

-- ============================================================
-- 4. FOOD FEEDBACK
-- ============================================================

CREATE TABLE app.food_feedback (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,

    student_id uuid NOT NULL,
    menu_id uuid NOT NULL,

    rating smallint NOT NULL
        CHECK (rating BETWEEN 1 AND 5),

    comment text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_food_feedback_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_food_feedback_student
        FOREIGN KEY (student_id)
        REFERENCES app.students(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_food_feedback_menu
        FOREIGN KEY (menu_id)
        REFERENCES app.meal_menus(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_food_feedback_student_menu
        UNIQUE (student_id, menu_id)
);

-- ============================================================
-- 5. RESOURCE ITEMS
-- ============================================================

CREATE TABLE app.resource_items (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    hostel_id uuid NOT NULL,

    resource_type varchar(50) NOT NULL,

    name varchar(255) NOT NULL,

    description text,

    total_qty numeric(12,2) NOT NULL DEFAULT 0
        CHECK (total_qty >= 0),

    unit varchar(30),

    status varchar(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'MAINTENANCE',
                'DISCONTINUED'
            )
        ),

    created_by uuid NOT NULL,
    updated_by uuid,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_resource_items_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_resource_items_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_resource_items_created_by
        FOREIGN KEY (created_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_resource_items_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT
);

-- ============================================================
-- 6. RESOURCE AVAILABILITY
-- ============================================================

CREATE TABLE app.resource_availability (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,
    resource_id uuid NOT NULL,

    available_qty numeric(12,2) NOT NULL DEFAULT 0
        CHECK (available_qty >= 0),

    status varchar(20) NOT NULL DEFAULT 'AVAILABLE'
        CHECK (
            status IN (
                'AVAILABLE',
                'LOW',
                'OUT_OF_STOCK',
                'UNAVAILABLE'
            )
        ),

    updated_by uuid,

    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_resource_availability_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_resource_availability_resource
        FOREIGN KEY (resource_id)
        REFERENCES app.resource_items(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_resource_availability_updated_by
        FOREIGN KEY (updated_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_resource_availability
        UNIQUE (resource_id)
);

-- ============================================================
-- 7. SAVED REPORTS
-- ============================================================

CREATE TABLE app.reports_saved (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,

    report_type varchar(100) NOT NULL,

    report_name varchar(255) NOT NULL,

    filters jsonb NOT NULL DEFAULT '{}'::jsonb,

    owner_user_id uuid NOT NULL,

    schedule varchar(100),

    is_active boolean NOT NULL DEFAULT true,

    last_generated_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_reports_saved_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_reports_saved_owner
        FOREIGN KEY (owner_user_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT
);

-- ============================================================
-- 8. FILES
-- ============================================================

CREATE TABLE app.files (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid,

    owner_table varchar(100) NOT NULL,
    owner_id uuid NOT NULL,

    file_name varchar(255),
    storage_path text NOT NULL,

    mime_type varchar(150),
    file_size bigint,

    checksum varchar(128),

    uploaded_by uuid NOT NULL,

    status varchar(20) NOT NULL DEFAULT 'ACTIVE'
        CHECK (
            status IN (
                'ACTIVE',
                'ARCHIVED',
                'DELETED'
            )
        ),

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_files_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_files_uploaded_by
        FOREIGN KEY (uploaded_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_files_size
        CHECK (
            file_size IS NULL
            OR file_size >= 0
        )
);

-- ============================================================
-- TENANT CONSISTENCY FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION app.validate_meals_resources_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    related_college_id uuid;
BEGIN

    -- ========================================================
    -- MEAL MENUS
    -- ========================================================

    IF TG_TABLE_NAME = 'meal_menus' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.hostels
        WHERE id = NEW.hostel_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in meal_menus';
        END IF;

    -- ========================================================
    -- MEAL TIMINGS
    -- ========================================================

    ELSIF TG_TABLE_NAME = 'meal_timings' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.hostels
        WHERE id = NEW.hostel_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in meal_timings';
        END IF;

    -- ========================================================
    -- MESS NOTICES
    -- ========================================================

    ELSIF TG_TABLE_NAME = 'mess_notices' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.hostels
        WHERE id = NEW.hostel_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in mess_notices';
        END IF;

    -- ========================================================
    -- FOOD FEEDBACK
    -- ========================================================

    ELSIF TG_TABLE_NAME = 'food_feedback' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.students
        WHERE id = NEW.student_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in food_feedback student';
        END IF;

        SELECT college_id
        INTO related_college_id
        FROM app.meal_menus
        WHERE id = NEW.menu_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in food_feedback menu';
        END IF;

    -- ========================================================
    -- RESOURCE ITEMS
    -- ========================================================

    ELSIF TG_TABLE_NAME = 'resource_items' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.hostels
        WHERE id = NEW.hostel_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in resource_items';
        END IF;

    -- ========================================================
    -- RESOURCE AVAILABILITY
    -- ========================================================

    ELSIF TG_TABLE_NAME = 'resource_availability' THEN

        SELECT college_id
        INTO related_college_id
        FROM app.resource_items
        WHERE id = NEW.resource_id;

        IF related_college_id IS NULL
           OR related_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant mismatch in resource_availability';
        END IF;

    -- ========================================================
    -- SAVED REPORTS
    -- ========================================================

    ELSIF TG_TABLE_NAME = 'reports_saved' THEN

        IF NOT EXISTS (
            SELECT 1
            FROM platform.colleges
            WHERE college_id = NEW.college_id
        ) THEN
            RAISE EXCEPTION
                'Invalid college_id in reports_saved';
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM platform.user_roles ur
            WHERE ur.user_id = NEW.owner_user_id
              AND ur.college_id = NEW.college_id
              AND ur.status = 'ACTIVE'
              AND (ur.expires_at IS NULL OR ur.expires_at > now())
        ) THEN
            RAISE EXCEPTION
                'Report owner % does not hold active membership in college %',
                NEW.owner_user_id, NEW.college_id;
        END IF;

    -- ========================================================
    -- FILES
    -- ========================================================

    ELSIF TG_TABLE_NAME = 'files' THEN

        /*
         * Files may be global/platform-level when college_id
         * is NULL. College-owned files must reference a valid
         * college.
         */
        IF NEW.college_id IS NOT NULL THEN

            IF NOT EXISTS (
                SELECT 1
                FROM platform.colleges
                WHERE college_id = NEW.college_id
            ) THEN
                RAISE EXCEPTION
                    'Invalid college_id in files';
            END IF;

        END IF;

    END IF;

    RETURN NEW;
END;
$$;

-- ============================================================
-- TENANT CONSISTENCY TRIGGERS
-- ============================================================

CREATE TRIGGER trg_validate_meal_menus_tenant
BEFORE INSERT OR UPDATE ON app.meal_menus
FOR EACH ROW
EXECUTE FUNCTION app.validate_meals_resources_tenant_consistency();

CREATE TRIGGER trg_validate_meal_timings_tenant
BEFORE INSERT OR UPDATE ON app.meal_timings
FOR EACH ROW
EXECUTE FUNCTION app.validate_meals_resources_tenant_consistency();

CREATE TRIGGER trg_validate_mess_notices_tenant
BEFORE INSERT OR UPDATE ON app.mess_notices
FOR EACH ROW
EXECUTE FUNCTION app.validate_meals_resources_tenant_consistency();

CREATE TRIGGER trg_validate_food_feedback_tenant
BEFORE INSERT OR UPDATE ON app.food_feedback
FOR EACH ROW
EXECUTE FUNCTION app.validate_meals_resources_tenant_consistency();

CREATE TRIGGER trg_validate_resource_items_tenant
BEFORE INSERT OR UPDATE ON app.resource_items
FOR EACH ROW
EXECUTE FUNCTION app.validate_meals_resources_tenant_consistency();

CREATE TRIGGER trg_validate_resource_availability_tenant
BEFORE INSERT OR UPDATE ON app.resource_availability
FOR EACH ROW
EXECUTE FUNCTION app.validate_meals_resources_tenant_consistency();

CREATE TRIGGER trg_validate_reports_saved_tenant
BEFORE INSERT OR UPDATE ON app.reports_saved
FOR EACH ROW
EXECUTE FUNCTION app.validate_meals_resources_tenant_consistency();

CREATE TRIGGER trg_validate_files_tenant
BEFORE INSERT OR UPDATE ON app.files
FOR EACH ROW
EXECUTE FUNCTION app.validate_meals_resources_tenant_consistency();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_meal_menus_college_date
    ON app.meal_menus (college_id, menu_date);

CREATE INDEX idx_meal_menus_hostel_date
    ON app.meal_menus (hostel_id, menu_date);

CREATE INDEX idx_meal_menus_status
    ON app.meal_menus (college_id, status);

CREATE INDEX idx_meal_timings_hostel
    ON app.meal_timings (hostel_id, meal_type);

CREATE INDEX idx_meal_timings_status
    ON app.meal_timings (college_id, status);

CREATE INDEX idx_mess_notices_college_status
    ON app.mess_notices (college_id, status);

CREATE INDEX idx_mess_notices_hostel
    ON app.mess_notices (hostel_id, created_at DESC);

CREATE INDEX idx_food_feedback_student
    ON app.food_feedback (student_id, created_at DESC);

CREATE INDEX idx_food_feedback_menu
    ON app.food_feedback (menu_id, created_at DESC);

CREATE INDEX idx_food_feedback_rating
    ON app.food_feedback (college_id, rating);

CREATE INDEX idx_resource_items_college
    ON app.resource_items (college_id, status);

CREATE INDEX idx_resource_items_hostel
    ON app.resource_items (hostel_id, status);

CREATE INDEX idx_resource_items_type
    ON app.resource_items (college_id, resource_type);

CREATE INDEX idx_resource_availability_status
    ON app.resource_availability (college_id, status);

CREATE INDEX idx_resource_availability_resource
    ON app.resource_availability (resource_id);

CREATE INDEX idx_reports_saved_owner
    ON app.reports_saved (owner_user_id, is_active);

CREATE INDEX idx_reports_saved_type
    ON app.reports_saved (college_id, report_type);

CREATE INDEX idx_reports_saved_filters
    ON app.reports_saved
    USING GIN (filters);

CREATE INDEX idx_files_owner
    ON app.files (owner_table, owner_id);

CREATE INDEX idx_files_college
    ON app.files (college_id, created_at DESC);

CREATE INDEX idx_files_uploaded_by
    ON app.files (uploaded_by, created_at DESC);

CREATE INDEX idx_files_status
    ON app.files (college_id, status);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE app.meal_menus IS
'Daily hostel meal menus by meal type.';

COMMENT ON TABLE app.meal_timings IS
'Configured meal service timings for hostels.';

COMMENT ON TABLE app.mess_notices IS
'Mess-related notices published to hostel residents.';

COMMENT ON TABLE app.food_feedback IS
'Student feedback and rating for a specific meal menu.';

COMMENT ON TABLE app.resource_items IS
'Resources maintained for individual hostels.';

COMMENT ON TABLE app.resource_availability IS
'Current availability quantity and status of hostel resources.';

COMMENT ON TABLE app.reports_saved IS
'Saved report definitions and optional scheduling configuration.';

COMMENT ON TABLE app.files IS
'Metadata for files stored in external or configured storage.';

COMMENT ON COLUMN app.files.storage_path IS
'Logical storage path or object key; actual file storage is handled outside PostgreSQL.';

COMMENT ON COLUMN app.files.owner_table IS
'Application table containing the business record associated with the file.';

COMMENT ON COLUMN app.files.owner_id IS
'UUID of the business record associated with the file.';

COMMIT;