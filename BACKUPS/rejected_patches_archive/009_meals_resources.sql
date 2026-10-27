BEGIN;

-- ============================================================
-- HMS DATABASE
-- Migration: 009_meals_resources.sql (RECOVERED PATCH)
-- Module: Meals / Mess
-- ============================================================

CREATE TABLE app.meal_timings (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),
    college_id uuid NOT NULL REFERENCES platform.colleges(college_id) ON DELETE RESTRICT,
    hostel_id uuid NOT NULL REFERENCES app.hostels(id) ON DELETE RESTRICT,
    meal_type text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    status text NOT NULL DEFAULT 'ACTIVE',
    created_by uuid NOT NULL REFERENCES app.users(user_id) ON DELETE RESTRICT,
    updated_by uuid REFERENCES app.users(user_id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_meal_timings_type CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER')),
    CONSTRAINT chk_meal_timings_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE app.meal_menus (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),
    college_id uuid NOT NULL REFERENCES platform.colleges(college_id) ON DELETE RESTRICT,
    hostel_id uuid NOT NULL REFERENCES app.hostels(id) ON DELETE RESTRICT,
    menu_date date NOT NULL,
    meal_type text NOT NULL,
    items text NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT',
    created_by uuid NOT NULL REFERENCES app.users(user_id) ON DELETE RESTRICT,
    updated_by uuid REFERENCES app.users(user_id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_meal_menus_type CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER')),
    CONSTRAINT chk_meal_menus_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED')),
    CONSTRAINT uq_meal_menus_date_type UNIQUE (hostel_id, menu_date, meal_type)
);

CREATE TABLE app.mess_notices (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),
    college_id uuid NOT NULL REFERENCES platform.colleges(college_id) ON DELETE RESTRICT,
    hostel_id uuid NOT NULL REFERENCES app.hostels(id) ON DELETE RESTRICT,
    title text NOT NULL,
    content text NOT NULL,
    status text NOT NULL DEFAULT 'DRAFT',
    publish_at timestamptz,
    expires_at timestamptz,
    published_by uuid REFERENCES app.users(user_id) ON DELETE RESTRICT,
    created_by uuid NOT NULL REFERENCES app.users(user_id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_mess_notices_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'EXPIRED', 'CANCELLED'))
);

CREATE TABLE app.food_feedback (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),
    college_id uuid NOT NULL REFERENCES platform.colleges(college_id) ON DELETE RESTRICT,
    student_id uuid NOT NULL REFERENCES app.students(id) ON DELETE RESTRICT,
    menu_id uuid NOT NULL REFERENCES app.meal_menus(id) ON DELETE RESTRICT,
    rating smallint NOT NULL,
    comment text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_food_feedback_rating CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT uq_food_feedback_student_menu UNIQUE (student_id, menu_id)
);


-- ============================================================
-- RESOURCES RECONSTRUCTION
-- ============================================================

CREATE TABLE app.resource_items (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),
    college_id uuid NOT NULL REFERENCES platform.colleges(college_id) ON DELETE RESTRICT,
    hostel_id uuid REFERENCES app.hostels(id) ON DELETE RESTRICT,
    resource_type text NOT NULL,
    name text NOT NULL,
    description text,
    total_qty integer NOT NULL DEFAULT 0,
    unit text NOT NULL,
    status text NOT NULL DEFAULT 'ACTIVE',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_resource_items_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE app.resource_availability (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),
    college_id uuid NOT NULL REFERENCES platform.colleges(college_id) ON DELETE RESTRICT,
    resource_id uuid NOT NULL REFERENCES app.resource_items(id) ON DELETE RESTRICT,
    available_qty integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'AVAILABLE',
    updated_by uuid REFERENCES app.users(user_id) ON DELETE RESTRICT,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_resource_availability_resource UNIQUE (resource_id),
    CONSTRAINT chk_resource_availability_status CHECK (status IN ('AVAILABLE', 'LOW', 'OUT_OF_STOCK'))
);


-- ============================================================
-- REPORTS RECONSTRUCTION (NEW DESIGN)
-- ============================================================

CREATE TABLE app.reports_saved (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),
    college_id uuid NOT NULL REFERENCES platform.colleges(college_id) ON DELETE RESTRICT,
    owner_user_id uuid NOT NULL REFERENCES app.users(user_id) ON DELETE RESTRICT,
    name text NOT NULL,
    description text,
    report_type text NOT NULL,
    filters jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- FILES RECONSTRUCTION (NEW DESIGN)
-- ============================================================

CREATE TABLE app.files (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),
    college_id uuid NOT NULL REFERENCES platform.colleges(college_id) ON DELETE RESTRICT,
    owner_table text NOT NULL,
    owner_id uuid NOT NULL,
    uploaded_by uuid NOT NULL REFERENCES app.users(user_id) ON DELETE RESTRICT,
    storage_provider text NOT NULL DEFAULT 'LOCAL',
    storage_path text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    size_bytes bigint NOT NULL,
    status text NOT NULL DEFAULT 'PENDING',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_files_status CHECK (status IN ('PENDING', 'UPLOADED', 'SCANNED', 'DELETED', 'ERROR')),
    CONSTRAINT chk_files_size CHECK (size_bytes >= 0)
);

COMMIT;
