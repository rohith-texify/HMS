/*
===============================================================================
HMS - HOSTEL DOMAIN
Migration: 003_hostel.sql
===============================================================================
Purpose:
    Creates the complete physical hostel structure and allocation foundation.

Hierarchy:
    College
      └── Hostel
          └── Block
              └── Floor
                  └── Room
                      └── Bed

Tables:
    hostels
    blocks
    floors
    rooms
    beds
    bed_allocations
    room_maintenance
    gates

Dependencies:
    000_extensions.sql
    001_platform.sql
    002_academic.sql
===============================================================================
*/

BEGIN;


-- ============================================================================
-- 1. HOSTELS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.hostels (
    id              uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id      uuid NOT NULL,

    code            citext NOT NULL,
    name            text NOT NULL,

    category        text NOT NULL,

    description     text,
    address         text,

    total_capacity  integer NOT NULL DEFAULT 0,

    status          text NOT NULL DEFAULT 'ACTIVE',

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_hostels_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_hostels_category
        CHECK (
            category IN (
                'BOYS',
                'GIRLS',
                'MIXED',
                'OTHER'
            )
        ),

    CONSTRAINT chk_hostels_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'MAINTENANCE'
            )
        ),

    CONSTRAINT chk_hostels_capacity
        CHECK (total_capacity >= 0),

    CONSTRAINT chk_hostels_code_not_empty
        CHECK (length(trim(code::text)) > 0),

    CONSTRAINT chk_hostels_name_not_empty
        CHECK (length(trim(name)) > 0),

    CONSTRAINT uq_hostels_college_code
        UNIQUE (college_id, code),

    CONSTRAINT uq_hostels_college_name
        UNIQUE (college_id, name)
);

COMMENT ON TABLE app.hostels IS
'Top-level hostel entities belonging to a college.';

COMMENT ON COLUMN app.hostels.category IS
'Hostel category such as BOYS, GIRLS, MIXED, or OTHER.';

COMMENT ON COLUMN app.hostels.total_capacity IS
'Configured total bed capacity of the hostel.';


-- ============================================================================
-- 2. BLOCKS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.blocks (
    id              uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id      uuid NOT NULL,
    hostel_id       uuid NOT NULL,

    code            citext NOT NULL,
    name            text NOT NULL,

    description     text,

    total_capacity  integer NOT NULL DEFAULT 0,

    status          text NOT NULL DEFAULT 'ACTIVE',

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_blocks_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_blocks_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_blocks_capacity
        CHECK (total_capacity >= 0),

    CONSTRAINT chk_blocks_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'MAINTENANCE'
            )
        ),

    CONSTRAINT chk_blocks_code_not_empty
        CHECK (length(trim(code::text)) > 0),

    CONSTRAINT chk_blocks_name_not_empty
        CHECK (length(trim(name)) > 0),

    CONSTRAINT uq_blocks_hostel_code
        UNIQUE (hostel_id, code),

    CONSTRAINT uq_blocks_hostel_name
        UNIQUE (hostel_id, name),

    CONSTRAINT uq_blocks_college_id_id
        UNIQUE (college_id, id)
);

COMMENT ON TABLE app.blocks IS
'Physical hostel block/building level under a hostel.';


-- ============================================================================
-- 3. FLOORS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.floors (
    id              uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id      uuid NOT NULL,
    hostel_id       uuid NOT NULL,
    block_id        uuid NOT NULL,

    code            citext NOT NULL,
    name            text NOT NULL,

    floor_number    integer NOT NULL,

    description     text,

    total_capacity  integer NOT NULL DEFAULT 0,

    status          text NOT NULL DEFAULT 'ACTIVE',

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_floors_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_floors_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_floors_block
        FOREIGN KEY (block_id)
        REFERENCES app.blocks(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_floors_number
        CHECK (floor_number >= 0),

    CONSTRAINT chk_floors_capacity
        CHECK (total_capacity >= 0),

    CONSTRAINT chk_floors_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'MAINTENANCE'
            )
        ),

    CONSTRAINT chk_floors_code_not_empty
        CHECK (length(trim(code::text)) > 0),

    CONSTRAINT chk_floors_name_not_empty
        CHECK (length(trim(name)) > 0),

    CONSTRAINT uq_floors_block_number
        UNIQUE (block_id, floor_number),

    CONSTRAINT uq_floors_block_code
        UNIQUE (block_id, code),

    CONSTRAINT uq_floors_block_name
        UNIQUE (block_id, name),

    CONSTRAINT uq_floors_college_id_id
        UNIQUE (college_id, id)
);

COMMENT ON TABLE app.floors IS
'Physical floors belonging to hostel blocks.';


-- ============================================================================
-- 4. ROOMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.rooms (
    id              uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id      uuid NOT NULL,
    hostel_id       uuid NOT NULL,
    block_id        uuid NOT NULL,
    floor_id        uuid NOT NULL,

    code            citext NOT NULL,
    name            text NOT NULL,

    room_type       text NOT NULL DEFAULT 'STANDARD',

    capacity        integer NOT NULL DEFAULT 0,

    description     text,

    status          text NOT NULL DEFAULT 'ACTIVE',

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_rooms_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_rooms_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_rooms_block
        FOREIGN KEY (block_id)
        REFERENCES app.blocks(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_rooms_floor
        FOREIGN KEY (floor_id)
        REFERENCES app.floors(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_rooms_capacity
        CHECK (capacity >= 0),

    CONSTRAINT chk_rooms_room_type
        CHECK (
            room_type IN (
                'STANDARD',
                'SINGLE',
                'DOUBLE',
                'TRIPLE',
                'DORMITORY',
                'SPECIAL'
            )
        ),

    CONSTRAINT chk_rooms_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE',
                'MAINTENANCE'
            )
        ),

    CONSTRAINT chk_rooms_code_not_empty
        CHECK (length(trim(code::text)) > 0),

    CONSTRAINT chk_rooms_name_not_empty
        CHECK (length(trim(name)) > 0),

    CONSTRAINT uq_rooms_floor_code
        UNIQUE (floor_id, code),

    CONSTRAINT uq_rooms_floor_name
        UNIQUE (floor_id, name),

    CONSTRAINT uq_rooms_college_id_id
        UNIQUE (college_id, id)
);

COMMENT ON TABLE app.rooms IS
'Physical hostel rooms belonging to floors.';

COMMENT ON COLUMN app.rooms.capacity IS
'Configured maximum number of beds/occupants supported by the room.';


-- ============================================================================
-- 5. BEDS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.beds (
    id              uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id      uuid NOT NULL,
    hostel_id       uuid NOT NULL,
    block_id        uuid NOT NULL,
    floor_id        uuid NOT NULL,
    room_id         uuid NOT NULL,

    code            citext NOT NULL,
    name            text,

    status          text NOT NULL DEFAULT 'AVAILABLE',

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_beds_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_beds_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_beds_block
        FOREIGN KEY (block_id)
        REFERENCES app.blocks(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_beds_floor
        FOREIGN KEY (floor_id)
        REFERENCES app.floors(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_beds_room
        FOREIGN KEY (room_id)
        REFERENCES app.rooms(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_beds_status
        CHECK (
            status IN (
                'AVAILABLE',
                'OCCUPIED',
                'RESERVED',
                'MAINTENANCE',
                'INACTIVE'
            )
        ),

    CONSTRAINT chk_beds_code_not_empty
        CHECK (length(trim(code::text)) > 0),

    CONSTRAINT uq_beds_room_code
        UNIQUE (room_id, code),

    CONSTRAINT uq_beds_college_id_id
        UNIQUE (college_id, id)
);

COMMENT ON TABLE app.beds IS
'Individual physical beds that can be allocated to students.';


-- ============================================================================
-- 6. BED ALLOCATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.bed_allocations (
    id              uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id      uuid NOT NULL,

    bed_id          uuid NOT NULL,

    allocation_type text NOT NULL DEFAULT 'REGULAR',

    allocated_at    timestamptz NOT NULL DEFAULT now(),
    released_at     timestamptz,

    status          text NOT NULL DEFAULT 'ACTIVE',

    remarks         text,

    created_by      uuid,
    released_by     uuid,

    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_bed_allocations_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_bed_allocations_bed
        FOREIGN KEY (bed_id)
        REFERENCES app.beds(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_bed_allocations_created_by
        FOREIGN KEY (created_by)
        REFERENCES app.users(user_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_bed_allocations_released_by
        FOREIGN KEY (released_by)
        REFERENCES app.users(user_id)
        ON DELETE SET NULL,

    CONSTRAINT chk_bed_allocations_type
        CHECK (
            allocation_type IN (
                'REGULAR',
                'TEMPORARY',
                'EMERGENCY',
                'TRANSFER'
            )
        ),

    CONSTRAINT chk_bed_allocations_status
        CHECK (
            status IN (
                'ACTIVE',
                'RELEASED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_bed_allocations_dates
        CHECK (
            released_at IS NULL
            OR released_at >= allocated_at
        )
);

COMMENT ON TABLE app.bed_allocations IS
'Historical student bed allocation records. Student reference is added after the student table is created.';


-- ============================================================================
-- 7. ROOM MAINTENANCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.room_maintenance (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    room_id             uuid NOT NULL,

    maintenance_type    text NOT NULL DEFAULT 'GENERAL',

    reason              text NOT NULL,

    started_at          timestamptz NOT NULL DEFAULT now(),
    expected_end_at     timestamptz,
    completed_at        timestamptz,

    status              text NOT NULL DEFAULT 'OPEN',

    reported_by         uuid,
    resolved_by         uuid,

    remarks             text,

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_room_maintenance_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_room_maintenance_room
        FOREIGN KEY (room_id)
        REFERENCES app.rooms(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_room_maintenance_reported_by
        FOREIGN KEY (reported_by)
        REFERENCES app.users(user_id)
        ON DELETE SET NULL,

    CONSTRAINT fk_room_maintenance_resolved_by
        FOREIGN KEY (resolved_by)
        REFERENCES app.users(user_id)
        ON DELETE SET NULL,

    CONSTRAINT chk_room_maintenance_type
        CHECK (
            maintenance_type IN (
                'GENERAL',
                'ELECTRICAL',
                'PLUMBING',
                'CIVIL',
                'FURNITURE',
                'CLEANING',
                'SAFETY',
                'OTHER'
            )
        ),

    CONSTRAINT chk_room_maintenance_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    CONSTRAINT chk_room_maintenance_dates
        CHECK (
            expected_end_at IS NULL
            OR expected_end_at >= started_at
        ),

    CONSTRAINT chk_room_maintenance_completed
        CHECK (
            completed_at IS NULL
            OR completed_at >= started_at
        ),

    CONSTRAINT chk_room_maintenance_reason
        CHECK (length(trim(reason)) > 0)
);

COMMENT ON TABLE app.room_maintenance IS
'Maintenance and temporary-unavailability history for hostel rooms.';


-- ============================================================================
-- 8. GATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS app.gates (
    id                  uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id          uuid NOT NULL,
    hostel_id           uuid,

    code                citext NOT NULL,
    name                text NOT NULL,

    gate_type           text NOT NULL DEFAULT 'MAIN',

    location_description text,

    status              text NOT NULL DEFAULT 'ACTIVE',

    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_gates_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_gates_hostel
        FOREIGN KEY (hostel_id)
        REFERENCES app.hostels(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_gates_type
        CHECK (
            gate_type IN (
                'MAIN',
                'HOSTEL',
                'EMERGENCY',
                'SERVICE',
                'OTHER'
            )
        ),

    CONSTRAINT chk_gates_status
        CHECK (
            status IN (
                'ACTIVE',
                'INACTIVE'
            )
        ),

    CONSTRAINT chk_gates_code_not_empty
        CHECK (length(trim(code::text)) > 0),

    CONSTRAINT chk_gates_name_not_empty
        CHECK (length(trim(name)) > 0),

    CONSTRAINT uq_gates_college_code
        UNIQUE (college_id, code)
);

COMMENT ON TABLE app.gates IS
'Physical hostel/security gates used by movement and security modules.';


-- ============================================================================
-- 9. HOSTEL TENANT CONSISTENCY VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION app.validate_hostel_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    referenced_college_id uuid;
BEGIN

    -- ------------------------------------------------------------------------
    -- BLOCK -> HOSTEL
    -- ------------------------------------------------------------------------

    IF TG_TABLE_NAME = 'blocks' THEN

        SELECT h.college_id
        INTO referenced_college_id
        FROM app.hostels h
        WHERE h.id = NEW.hostel_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Hostel % does not exist',
                NEW.hostel_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant violation: block % and hostel % belong to different colleges',
                NEW.id,
                NEW.hostel_id;
        END IF;

    END IF;


    -- ------------------------------------------------------------------------
    -- FLOOR -> BLOCK / HOSTEL
    -- ------------------------------------------------------------------------

    IF TG_TABLE_NAME = 'floors' THEN

        SELECT b.college_id
        INTO referenced_college_id
        FROM app.blocks b
        WHERE b.id = NEW.block_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Block % does not exist',
                NEW.block_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant violation: floor % and block % belong to different colleges',
                NEW.id,
                NEW.block_id;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM app.hostels h
            WHERE h.id = NEW.hostel_id
              AND h.college_id = NEW.college_id
        ) THEN
            RAISE EXCEPTION
                'Invalid hostel % for floor %',
                NEW.hostel_id,
                NEW.id;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM app.blocks b
            WHERE b.id = NEW.block_id
              AND b.hostel_id = NEW.hostel_id
              AND b.college_id = NEW.college_id
        ) THEN
            RAISE EXCEPTION
                'Floor % hierarchy does not match its block/hostel',
                NEW.id;
        END IF;

    END IF;


    -- ------------------------------------------------------------------------
    -- ROOM -> FLOOR / BLOCK / HOSTEL
    -- ------------------------------------------------------------------------

    IF TG_TABLE_NAME = 'rooms' THEN

        SELECT f.college_id
        INTO referenced_college_id
        FROM app.floors f
        WHERE f.id = NEW.floor_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Floor % does not exist',
                NEW.floor_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant violation: room % and floor % belong to different colleges',
                NEW.id,
                NEW.floor_id;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM app.floors f
            WHERE f.id = NEW.floor_id
              AND f.hostel_id = NEW.hostel_id
              AND f.block_id = NEW.block_id
              AND f.college_id = NEW.college_id
        ) THEN
            RAISE EXCEPTION
                'Room % hierarchy does not match its floor/block/hostel',
                NEW.id;
        END IF;

    END IF;


    -- ------------------------------------------------------------------------
    -- BED -> ROOM / FLOOR / BLOCK / HOSTEL
    -- ------------------------------------------------------------------------

    IF TG_TABLE_NAME = 'beds' THEN

        SELECT r.college_id
        INTO referenced_college_id
        FROM app.rooms r
        WHERE r.id = NEW.room_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Room % does not exist',
                NEW.room_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant violation: bed % and room % belong to different colleges',
                NEW.id,
                NEW.room_id;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM app.rooms r
            WHERE r.id = NEW.room_id
              AND r.hostel_id = NEW.hostel_id
              AND r.block_id = NEW.block_id
              AND r.floor_id = NEW.floor_id
              AND r.college_id = NEW.college_id
        ) THEN
            RAISE EXCEPTION
                'Bed % hierarchy does not match its room/floor/block/hostel',
                NEW.id;
        END IF;

    END IF;


    -- ------------------------------------------------------------------------
    -- BED ALLOCATION -> BED
    -- ------------------------------------------------------------------------

    IF TG_TABLE_NAME = 'bed_allocations' THEN

        SELECT b.college_id
        INTO referenced_college_id
        FROM app.beds b
        WHERE b.id = NEW.bed_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Bed % does not exist',
                NEW.bed_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant violation: allocation % and bed % belong to different colleges',
                NEW.id,
                NEW.bed_id;
        END IF;

    END IF;


    -- ------------------------------------------------------------------------
    -- ROOM MAINTENANCE -> ROOM
    -- ------------------------------------------------------------------------

    IF TG_TABLE_NAME = 'room_maintenance' THEN

        SELECT r.college_id
        INTO referenced_college_id
        FROM app.rooms r
        WHERE r.id = NEW.room_id;

        IF referenced_college_id IS NULL THEN
            RAISE EXCEPTION
                'Room % does not exist',
                NEW.room_id;
        END IF;

        IF referenced_college_id <> NEW.college_id THEN
            RAISE EXCEPTION
                'Tenant violation: maintenance % and room % belong to different colleges',
                NEW.id,
                NEW.room_id;
        END IF;

    END IF;


    -- ------------------------------------------------------------------------
    -- GATE -> HOSTEL
    -- ------------------------------------------------------------------------

    IF TG_TABLE_NAME = 'gates' THEN
        IF NEW.hostel_id IS NOT NULL THEN

            SELECT h.college_id
            INTO referenced_college_id
            FROM app.hostels h
            WHERE h.id = NEW.hostel_id;

            IF referenced_college_id IS NULL THEN
                RAISE EXCEPTION
                    'Hostel % does not exist',
                    NEW.hostel_id;
            END IF;

            IF referenced_college_id <> NEW.college_id THEN
                RAISE EXCEPTION
                    'Tenant violation: gate % and hostel % belong to different colleges',
                    NEW.id,
                    NEW.hostel_id;
            END IF;

        END IF;
    END IF;


    RETURN NEW;

END;
$$;


-- ============================================================================
-- 10. TENANT CONSISTENCY TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_blocks_tenant_consistency
ON app.blocks;

CREATE TRIGGER trg_blocks_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.blocks
FOR EACH ROW
EXECUTE FUNCTION app.validate_hostel_tenant_consistency();


DROP TRIGGER IF EXISTS trg_floors_tenant_consistency
ON app.floors;

CREATE TRIGGER trg_floors_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.floors
FOR EACH ROW
EXECUTE FUNCTION app.validate_hostel_tenant_consistency();


DROP TRIGGER IF EXISTS trg_rooms_tenant_consistency
ON app.rooms;

CREATE TRIGGER trg_rooms_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.rooms
FOR EACH ROW
EXECUTE FUNCTION app.validate_hostel_tenant_consistency();


DROP TRIGGER IF EXISTS trg_beds_tenant_consistency
ON app.beds;

CREATE TRIGGER trg_beds_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.beds
FOR EACH ROW
EXECUTE FUNCTION app.validate_hostel_tenant_consistency();


DROP TRIGGER IF EXISTS trg_bed_allocations_tenant_consistency
ON app.bed_allocations;

CREATE TRIGGER trg_bed_allocations_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.bed_allocations
FOR EACH ROW
EXECUTE FUNCTION app.validate_hostel_tenant_consistency();


DROP TRIGGER IF EXISTS trg_room_maintenance_tenant_consistency
ON app.room_maintenance;

CREATE TRIGGER trg_room_maintenance_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.room_maintenance
FOR EACH ROW
EXECUTE FUNCTION app.validate_hostel_tenant_consistency();


DROP TRIGGER IF EXISTS trg_gates_tenant_consistency
ON app.gates;

CREATE TRIGGER trg_gates_tenant_consistency
BEFORE INSERT OR UPDATE
ON app.gates
FOR EACH ROW
EXECUTE FUNCTION app.validate_hostel_tenant_consistency();


-- ============================================================================
-- 11. BED ALLOCATION SAFETY
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_bed_allocations_one_active
ON app.bed_allocations (bed_id)
WHERE status = 'ACTIVE';


-- ============================================================================
-- 12. ROOM MAINTENANCE SAFETY
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_room_maintenance_one_open
ON app.room_maintenance (room_id)
WHERE status IN ('OPEN', 'IN_PROGRESS');


-- ============================================================================
-- 13. DOCUMENTATION
-- ============================================================================

COMMENT ON SCHEMA app IS
'Application/tenant data schema for the Hostel Management System.';


COMMIT;


/*
===============================================================================
END OF 003_hostel.sql
===============================================================================
*/