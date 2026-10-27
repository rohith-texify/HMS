BEGIN;

-- ============================================================
-- 900_security.sql
-- Row Level Security / Tenant Isolation
-- ============================================================
-- Purpose:
--   Establish PostgreSQL Row Level Security for the shared
--   multi-tenant HMS database.
--
-- Rules:
--   1. Every college-owned row is isolated by college_id.
--   2. Tenant context is supplied through app.current_tenant_id().
--   3. RLS is enabled on all tenant-owned application tables.
--   4. RLS is forced so table owners also respect policies.
--   5. Cross-tenant data access is prevented at DB level.
--
-- IMPORTANT:
--   This migration does NOT create new business tables.
-- ============================================================


-- ============================================================
-- 1. TENANT CONTEXT
-- ============================================================
-- Application sets the tenant before executing tenant queries:
--
--   SELECT set_config(
--       'app.current_tenant_id',
--       '<college_uuid>',
--       false
--   );
--
-- The value remains transaction/session scoped according to
-- the third parameter supplied by the application.
-- ============================================================

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    tenant_value text;
BEGIN

    tenant_value := current_setting(
        'app.current_tenant_id',
        true
    );

    IF tenant_value IS NULL
       OR btrim(tenant_value) = '' THEN
        RETURN NULL;
    END IF;

    BEGIN
        RETURN tenant_value::uuid;
    EXCEPTION
        WHEN invalid_text_representation THEN
            RAISE EXCEPTION
                'Invalid app.current_tenant_id value: %',
                tenant_value;
    END;

END;
$$;


-- ============================================================
-- 2. TENANT CONTEXT CHECK
-- ============================================================

CREATE OR REPLACE FUNCTION app.has_tenant_context()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT app.current_tenant_id() IS NOT NULL;
$$;


-- ============================================================
-- 3. GENERIC TENANT POLICY FUNCTION
-- ============================================================
-- This function returns TRUE only when:
--
--   row.college_id = current tenant
--
-- NULL tenant context results in FALSE.
-- ============================================================

CREATE OR REPLACE FUNCTION app.tenant_row_visible(
    row_college_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT
        app.current_tenant_id() IS NOT NULL
        AND row_college_id = app.current_tenant_id();
$$;


-- ============================================================
-- 4. ENABLE RLS ON ALL TENANT TABLES
-- ============================================================
-- Dynamically finds every app table containing college_id.
--
-- This avoids maintaining a second hard-coded list of tables.
-- ============================================================

DO $$
DECLARE
    table_record record;
BEGIN

    FOR table_record IN
        SELECT
            c.table_schema,
            c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.table_schema = 'app'
          AND c.column_name = 'college_id'
          AND t.table_type = 'BASE TABLE'
        ORDER BY c.table_name
    LOOP

        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            table_record.table_schema,
            table_record.table_name
        );

        EXECUTE format(
            'ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',
            table_record.table_schema,
            table_record.table_name
        );

    END LOOP;

END
$$;


-- ============================================================
-- 5. CREATE TENANT POLICIES
-- ============================================================
-- Policy applies to:
--   SELECT
--   INSERT
--   UPDATE
--   DELETE
--
-- PostgreSQL evaluates USING for existing rows and WITH CHECK
-- for rows being inserted/updated.
-- ============================================================

DO $$
DECLARE
    table_record record;
    policy_name text;
BEGIN

    FOR table_record IN
        SELECT
            c.table_schema,
            c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name = c.table_name
        WHERE c.table_schema = 'app'
          AND c.column_name = 'college_id'
          AND t.table_type = 'BASE TABLE'
        ORDER BY c.table_name
    LOOP

        policy_name :=
            'tenant_isolation_' || table_record.table_name;

        EXECUTE format(
            'DROP POLICY IF EXISTS %I ON %I.%I',
            policy_name,
            table_record.table_schema,
            table_record.table_name
        );

        EXECUTE format(
            'CREATE POLICY %I
             ON %I.%I
             AS RESTRICTIVE
             FOR ALL
             USING (
                 college_id = app.current_tenant_id()
             )
             WITH CHECK (
                 college_id = app.current_tenant_id()
             )',
            policy_name,
            table_record.table_schema,
            table_record.table_name
        );

    END LOOP;

END
$$;


-- ============================================================
-- 6. SPECIAL RLS POLICY:
--    NOTIFICATION RECIPIENTS
-- ============================================================
-- notification_recipients does not contain college_id.
--
-- Tenant is determined through its parent notification.
-- ============================================================

ALTER TABLE app.notification_recipients
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.notification_recipients
    FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_notification_recipients
ON app.notification_recipients;

CREATE POLICY tenant_notification_recipients
ON app.notification_recipients
AS RESTRICTIVE
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM app.notifications n
        WHERE n.id = notification_recipients.notification_id
          AND n.college_id = app.current_tenant_id()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM app.notifications n
        WHERE n.id = notification_recipients.notification_id
          AND n.college_id = app.current_tenant_id()
    )
);


-- ============================================================
-- 7. SPECIAL RLS POLICY:
--    APPROVAL STEPS
-- ============================================================
-- approval_steps does not contain college_id.
--
-- Tenant is determined through its parent approval request.
-- ============================================================

ALTER TABLE platform.approval_steps
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE platform.approval_steps
    FORCE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS tenant_approval_steps
ON platform.approval_steps;

CREATE POLICY tenant_approval_steps
ON platform.approval_steps
AS RESTRICTIVE
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM platform.approval_requests ar
        WHERE ar.request_id = approval_steps.request_id
          AND ar.college_id = app.current_tenant_id()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM platform.approval_requests ar
        WHERE ar.request_id = approval_steps.request_id
          AND ar.college_id = app.current_tenant_id()
    )
);


-- ============================================================
-- 8. USERS
-- ============================================================
-- app.users is a platform identity table.
--
-- If users contains college_id, enforce tenant isolation.
-- If it does not, it remains outside automatic tenant policies.
-- ============================================================

DO $$
BEGIN

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'app'
          AND table_name = 'users'
          AND column_name = 'college_id'
    ) THEN

        ALTER TABLE app.users
            ENABLE ROW LEVEL SECURITY;

        ALTER TABLE app.users
            FORCE ROW LEVEL SECURITY;

        DROP POLICY IF EXISTS tenant_isolation_users
        ON app.users;

        CREATE POLICY tenant_isolation_users
        ON app.users
        AS RESTRICTIVE
        FOR ALL
        USING (
            college_id = app.current_tenant_id()
        )
        WITH CHECK (
            college_id = app.current_tenant_id()
        );

    END IF;

END
$$;


-- ============================================================
-- 9. REVOKE PUBLIC ACCESS
-- ============================================================
-- Prevent anonymous/public access to application schemas.
-- Application roles should receive explicit privileges.
-- ============================================================

REVOKE ALL
ON ALL TABLES IN SCHEMA app
FROM PUBLIC;

REVOKE ALL
ON ALL SEQUENCES IN SCHEMA app
FROM PUBLIC;

REVOKE ALL
ON ALL FUNCTIONS IN SCHEMA app
FROM PUBLIC;


REVOKE ALL
ON ALL TABLES IN SCHEMA platform
FROM PUBLIC;

REVOKE ALL
ON ALL SEQUENCES IN SCHEMA platform
FROM PUBLIC;

REVOKE ALL
ON ALL FUNCTIONS IN SCHEMA platform
FROM PUBLIC;


-- ============================================================
-- 10. FUNCTION COMMENTS
-- ============================================================

COMMENT ON FUNCTION app.current_tenant_id()
IS
'Returns the UUID of the currently active HMS tenant from app.current_tenant_id.';


COMMENT ON FUNCTION app.has_tenant_context()
IS
'Returns TRUE when a valid tenant context is available for the current database session.';


COMMENT ON FUNCTION app.tenant_row_visible(uuid)
IS
'Returns TRUE when a row belongs to the currently active HMS tenant.';


-- ============================================================
-- 11. SECURITY DOCUMENTATION
-- ============================================================

COMMENT ON SCHEMA app
IS
'Application schema protected by PostgreSQL Row Level Security and tenant isolation.';


COMMENT ON SCHEMA platform
IS
'Platform schema containing shared HMS control-plane objects.';


-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================

COMMIT;