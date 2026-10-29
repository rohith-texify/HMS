BEGIN;

-- ============================================================
-- 900_security.sql
-- Row Level Security / Tenant Isolation
-- ============================================================
-- Purpose:
--   Establish PostgreSQL Row Level Security and Role Permissions
--   for the shared multi-tenant HMS database.
--
-- Rules:
--   1. Every college-owned row is isolated by college_id.
--   2. Tenant context is supplied through app.current_tenant_id().
--   3. Dual-policy architecture: Paired AS PERMISSIVE base access
--      to hms_app + AS RESTRICTIVE tenant isolation boundary.
--   4. RLS is enabled and FORCED on all tenant-owned tables.
--   5. Least-privilege application role (hms_app) is provisioned
--      with NOBYPASSRLS and explicit schema/table grants.
-- ============================================================


-- ============================================================
-- 1. APPLICATION ROLE PROVISIONING (LEAST PRIVILEGE)
-- ============================================================
-- Ensures hms_app exists with NOBYPASSRLS for standalone runs
-- and dev/test environments.
-- ============================================================

DO $$
BEGIN
    -- Base role for backward compatibility and test validation
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_app') THEN
        BEGIN
            CREATE ROLE hms_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        EXCEPTION
            WHEN insufficient_privilege THEN
                RAISE EXCEPTION
                    'Prerequisite role "hms_app" does not exist and migration runner lacks CREATEROLE privilege. Run cluster provisioning first.';
        END;
    ELSE
        BEGIN
            ALTER ROLE hms_app WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        EXCEPTION
            WHEN insufficient_privilege THEN
                NULL;
        END;
    END IF;

    -- College Application Pool restricted runtime role
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_college_app') THEN
        BEGIN
            CREATE ROLE hms_college_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        EXCEPTION
            WHEN insufficient_privilege THEN
                RAISE EXCEPTION
                    'Prerequisite role "hms_college_app" does not exist and migration runner lacks CREATEROLE privilege.';
        END;
    ELSE
        BEGIN
            ALTER ROLE hms_college_app WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        EXCEPTION
            WHEN insufficient_privilege THEN
                NULL;
        END;
    END IF;

    -- Platform Control Plane Pool restricted runtime role
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_platform_app') THEN
        BEGIN
            CREATE ROLE hms_platform_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        EXCEPTION
            WHEN insufficient_privilege THEN
                RAISE EXCEPTION
                    'Prerequisite role "hms_platform_app" does not exist and migration runner lacks CREATEROLE privilege.';
        END;
    ELSE
        BEGIN
            ALTER ROLE hms_platform_app WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
        EXCEPTION
            WHEN insufficient_privilege THEN
                NULL;
        END;
    END IF;
END
$$;


-- ============================================================
-- 2. TENANT CONTEXT
-- ============================================================
-- Application sets the tenant before executing tenant queries:
--
--   SELECT set_config(
--       'app.current_tenant_id',
--       '<college_uuid>',
--       false
--   );
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
-- 3. TENANT CONTEXT CHECK
-- ============================================================

CREATE OR REPLACE FUNCTION app.has_tenant_context()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT app.current_tenant_id() IS NOT NULL;
$$;


-- ============================================================
-- 4. GENERIC TENANT POLICY FUNCTION
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
-- 5. PLATFORM ADMIN SCOPE VERIFICATION
-- ============================================================
-- Returns TRUE only when session is explicitly scoped to PLATFORM
-- AND the authenticated user holds an active SUPER_ADMIN or
-- PLATFORM_OPERATOR role in platform.user_roles.
-- ============================================================

CREATE OR REPLACE FUNCTION app.is_platform_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = platform, app, pg_temp
AS $$
DECLARE
    scope_val text;
    uid_val text;
    parsed_uid uuid;
    is_admin boolean;
BEGIN
    -- Layer 1: PostgreSQL Session User Barrier
    -- Inside a SECURITY DEFINER function, CURRENT_USER changes to the function definer/owner.
    -- SESSION_USER reliably reflects the authenticated connection login role.
    -- Any connection authenticated as hms_college_app fails closed unconditionally.
    IF SESSION_USER = 'hms_college_app' THEN
        RETURN false;
    END IF;

    -- Layer 2: Session Scope Barrier
    scope_val := current_setting('app.current_scope', true);
    IF scope_val IS DISTINCT FROM 'PLATFORM' THEN
        RETURN false;
    END IF;

    uid_val := current_setting('app.current_user_id', true);
    IF uid_val IS NULL OR btrim(uid_val) = '' THEN
        RETURN false;
    END IF;

    BEGIN
        parsed_uid := uid_val::uuid;
    EXCEPTION
        WHEN invalid_text_representation THEN
            RETURN false;
    END;

    SELECT EXISTS (
        SELECT 1
        FROM platform.user_roles ur
        JOIN platform.roles r ON r.role_id = ur.role_id
        WHERE ur.user_id = parsed_uid
          AND r.scope = 'PLATFORM'
          AND r.role_code IN ('SUPER_ADMIN', 'PLATFORM_OPERATOR')
          AND ur.status = 'ACTIVE'
          AND (ur.expires_at IS NULL OR ur.expires_at > now())
    ) INTO is_admin;

    RETURN coalesce(is_admin, false);
END;
$$;


-- ============================================================
-- 6. PAIRED RLS POLICIES FOR CATEGORY 1 APP TABLES
-- ============================================================
-- Applies paired Permissive (base grant to hms_app) and
-- Restrictive (boundary across all roles) on every table in 'app'
-- having a non-nullable college_id.
-- (Excludes app.files which has nullable college_id and custom policies).
-- ============================================================

DO $$
DECLARE
    table_record record;
    perm_policy text;
    rest_policy text;
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
          AND c.table_name NOT IN ('files', 'notifications')
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

        perm_policy := 'tenant_base_' || table_record.table_name;
        rest_policy := 'tenant_isolation_' || table_record.table_name;

        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', perm_policy, table_record.table_schema, table_record.table_name);
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', rest_policy, table_record.table_schema, table_record.table_name);

        -- Permissive base grant to hms_app and hms_college_app
        EXECUTE format(
            'CREATE POLICY %I
             ON %I.%I
             AS PERMISSIVE
             FOR ALL
             TO hms_app, hms_college_app
             USING (
                 college_id = app.current_tenant_id()
             )
             WITH CHECK (
                 college_id = app.current_tenant_id()
             )',
            perm_policy,
            table_record.table_schema,
            table_record.table_name
        );

        -- Restrictive tenant boundary
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
            rest_policy,
            table_record.table_schema,
            table_record.table_name
        );
    END LOOP;
END
$$;


-- ============================================================
-- 7. SPECIAL RLS POLICIES: NOTIFICATIONS & RECIPIENTS
-- ============================================================
-- app.notifications supports tenant notifications and global platform notifications (college_id IS NULL).
-- notification_recipients does not contain college_id; tenant is determined through parent notification.
-- ============================================================

ALTER TABLE app.notifications
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.notifications
    FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_base_notifications
ON app.notifications;

DROP POLICY IF EXISTS tenant_isolation_notifications
ON app.notifications;

CREATE POLICY tenant_base_notifications
ON app.notifications
AS PERMISSIVE
FOR ALL
TO hms_app, hms_college_app
USING (
    college_id = app.current_tenant_id()
    OR (college_id IS NULL AND (app.is_platform_admin() OR app.current_tenant_id() IS NOT NULL))
)
WITH CHECK (
    college_id = app.current_tenant_id()
    OR (college_id IS NULL AND app.is_platform_admin())
);

CREATE POLICY tenant_isolation_notifications
ON app.notifications
AS RESTRICTIVE
FOR ALL
USING (
    college_id = app.current_tenant_id()
    OR (college_id IS NULL AND (app.is_platform_admin() OR app.current_tenant_id() IS NOT NULL))
)
WITH CHECK (
    college_id = app.current_tenant_id()
    OR (college_id IS NULL AND app.is_platform_admin())
);

ALTER TABLE app.notification_recipients
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.notification_recipients
    FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_base_notification_recipients
ON app.notification_recipients;

DROP POLICY IF EXISTS tenant_notification_recipients
ON app.notification_recipients;

CREATE POLICY tenant_base_notification_recipients
ON app.notification_recipients
AS PERMISSIVE
FOR ALL
TO hms_app, hms_college_app
USING (
    EXISTS (
        SELECT 1
        FROM app.notifications n
        WHERE n.id = notification_recipients.notification_id
          AND (n.college_id = app.current_tenant_id() OR (n.college_id IS NULL AND (app.is_platform_admin() OR app.current_tenant_id() IS NOT NULL)))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM app.notifications n
        WHERE n.id = notification_recipients.notification_id
          AND (n.college_id = app.current_tenant_id() OR (n.college_id IS NULL AND app.is_platform_admin()))
    )
);

CREATE POLICY tenant_notification_recipients
ON app.notification_recipients
AS RESTRICTIVE
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM app.notifications n
        WHERE n.id = notification_recipients.notification_id
          AND (n.college_id = app.current_tenant_id() OR (n.college_id IS NULL AND (app.is_platform_admin() OR app.current_tenant_id() IS NOT NULL)))
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM app.notifications n
        WHERE n.id = notification_recipients.notification_id
          AND (n.college_id = app.current_tenant_id() OR (n.college_id IS NULL AND app.is_platform_admin()))
    )
);


-- ============================================================
-- 8. SPECIAL RLS POLICY: FILES (HYBRID / NULLABLE COLLEGE_ID)
-- ============================================================
-- app.files supports tenant files and global platform files.
-- ============================================================

ALTER TABLE app.files
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE app.files
    FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_base_files
ON app.files;

DROP POLICY IF EXISTS tenant_isolation_files
ON app.files;

CREATE POLICY tenant_base_files
ON app.files
AS PERMISSIVE
FOR ALL
TO hms_app, hms_college_app
USING (
    college_id = app.current_tenant_id()
    OR (college_id IS NULL AND (app.is_platform_admin() OR app.current_tenant_id() IS NOT NULL))
)
WITH CHECK (
    college_id = app.current_tenant_id()
    OR (college_id IS NULL AND app.is_platform_admin())
);

CREATE POLICY tenant_isolation_files
ON app.files
AS RESTRICTIVE
FOR ALL
USING (
    college_id = app.current_tenant_id()
    OR (college_id IS NULL AND (app.is_platform_admin() OR app.current_tenant_id() IS NOT NULL))
)
WITH CHECK (
    college_id = app.current_tenant_id()
    OR (college_id IS NULL AND app.is_platform_admin())
);


-- ============================================================
-- 9. CATEGORY 3 PLATFORM TABLES RLS
-- ============================================================
-- Partitioned platform tables accessible to colleges for their
-- own rows, and platform admins across colleges.
-- ============================================================

DO $$
DECLARE
    tbl text;
    perm_p text;
    rest_p text;
    platform_tables text[] := ARRAY[
        'approval_requests',
        'college_settings',
        'college_modules',
        'college_onboarding',
        'support_access_grants'
    ];
BEGIN
    FOREACH tbl IN ARRAY platform_tables
    LOOP
        EXECUTE format('ALTER TABLE platform.%I ENABLE ROW LEVEL SECURITY', tbl);
        EXECUTE format('ALTER TABLE platform.%I FORCE ROW LEVEL SECURITY', tbl);

        perm_p := 'tenant_base_' || tbl;
        rest_p := 'tenant_isolation_' || tbl;

        EXECUTE format('DROP POLICY IF EXISTS %I ON platform.%I', perm_p, tbl);
        EXECUTE format('DROP POLICY IF EXISTS %I ON platform.%I', rest_p, tbl);

        EXECUTE format(
            'CREATE POLICY %I
             ON platform.%I
             AS PERMISSIVE
             FOR ALL
             TO hms_app, hms_college_app, hms_platform_app
             USING (
                 (app.current_tenant_id() IS NOT NULL AND college_id = app.current_tenant_id())
                 OR app.is_platform_admin()
             )
             WITH CHECK (
                 (app.current_tenant_id() IS NOT NULL AND college_id = app.current_tenant_id())
                 OR app.is_platform_admin()
             )',
            perm_p, tbl
        );

        EXECUTE format(
            'CREATE POLICY %I
             ON platform.%I
             AS RESTRICTIVE
             FOR ALL
             USING (
                 (app.current_tenant_id() IS NOT NULL AND college_id = app.current_tenant_id())
                 OR app.is_platform_admin()
             )
             WITH CHECK (
                 (app.current_tenant_id() IS NOT NULL AND college_id = app.current_tenant_id())
                 OR app.is_platform_admin()
             )',
            rest_p, tbl
        );
    END LOOP;
END
$$;

-- approval_steps (indirectly scoped through approval_requests)
ALTER TABLE platform.approval_steps
    ENABLE ROW LEVEL SECURITY;

ALTER TABLE platform.approval_steps
    FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_base_approval_steps
ON platform.approval_steps;

DROP POLICY IF EXISTS tenant_approval_steps
ON platform.approval_steps;

CREATE POLICY tenant_base_approval_steps
ON platform.approval_steps
AS PERMISSIVE
FOR ALL
TO hms_app, hms_college_app, hms_platform_app
USING (
    EXISTS (
        SELECT 1
        FROM platform.approval_requests ar
        WHERE ar.request_id = approval_steps.request_id
          AND ((app.current_tenant_id() IS NOT NULL AND ar.college_id = app.current_tenant_id()) OR app.is_platform_admin())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM platform.approval_requests ar
        WHERE ar.request_id = approval_steps.request_id
          AND ((app.current_tenant_id() IS NOT NULL AND ar.college_id = app.current_tenant_id()) OR app.is_platform_admin())
    )
);

CREATE POLICY tenant_approval_steps
ON platform.approval_steps
AS RESTRICTIVE
FOR ALL
USING (
    EXISTS (
        SELECT 1
        FROM platform.approval_requests ar
        WHERE ar.request_id = approval_steps.request_id
          AND ((app.current_tenant_id() IS NOT NULL AND ar.college_id = app.current_tenant_id()) OR app.is_platform_admin())
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM platform.approval_requests ar
        WHERE ar.request_id = approval_steps.request_id
          AND ((app.current_tenant_id() IS NOT NULL AND ar.college_id = app.current_tenant_id()) OR app.is_platform_admin())
    )
);


-- ============================================================
-- 10. APP.USERS TENANT POLICY CHECK
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

        DROP POLICY IF EXISTS tenant_base_users ON app.users;
        DROP POLICY IF EXISTS tenant_isolation_users ON app.users;

        CREATE POLICY tenant_base_users
        ON app.users
        AS PERMISSIVE
        FOR ALL
        TO hms_app, hms_college_app
        USING (college_id = app.current_tenant_id())
        WITH CHECK (college_id = app.current_tenant_id());

        CREATE POLICY tenant_isolation_users
        ON app.users
        AS RESTRICTIVE
        FOR ALL
        USING (college_id = app.current_tenant_id())
        WITH CHECK (college_id = app.current_tenant_id());
    END IF;
END
$$;


-- ============================================================
-- 11. REVOKE PUBLIC ACCESS & GRANT LEAST PRIVILEGE TO hms_app
-- ============================================================

-- Revoke all default public access
REVOKE ALL ON ALL TABLES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA app FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;

REVOKE ALL ON ALL TABLES IN SCHEMA platform FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA platform FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA platform FROM PUBLIC;

-- Schema USAGE
GRANT USAGE ON SCHEMA app TO hms_app;
GRANT USAGE ON SCHEMA platform TO hms_app;

-- App schema: Full DML for tenant data (RLS strictly isolates rows)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO hms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO hms_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO hms_app;

-- Platform schema: Function execution
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA platform TO hms_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform TO hms_app;

-- Platform Catalogs (Read-Only)
GRANT SELECT ON
    platform.colleges,
    platform.roles,
    platform.modules,
    platform.permissions,
    platform.role_permissions,
    platform.entitlement_templates
TO hms_app;

-- Platform Operational Tables (Read/Write subject to RLS / business logic)
GRANT SELECT, INSERT, UPDATE, DELETE ON
    platform.user_roles,
    platform.college_settings,
    platform.college_modules,
    platform.college_onboarding,
    platform.approval_requests,
    platform.approval_steps,
    platform.support_access_grants,
    platform.device_tokens
TO hms_app;

-- Platform Audit Logs (Append-Only: SELECT and INSERT only; UPDATE and DELETE strictly forbidden)
GRANT SELECT, INSERT ON
    platform.audit_logs,
    platform.login_events
TO hms_app;

-- Dual Application Roles (Least-Privilege Separation)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_college_app') THEN
        GRANT USAGE ON SCHEMA app, platform TO hms_college_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO hms_college_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app TO hms_college_app;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app, platform TO hms_college_app;
        GRANT SELECT ON
            platform.colleges,
            platform.roles,
            platform.modules,
            platform.permissions,
            platform.role_permissions,
            platform.entitlement_templates
        TO hms_college_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON
            platform.user_roles,
            platform.college_settings,
            platform.college_modules,
            platform.college_onboarding,
            platform.approval_requests,
            platform.approval_steps,
            platform.support_access_grants,
            platform.device_tokens
        TO hms_college_app;
        GRANT SELECT, INSERT ON platform.audit_logs, platform.login_events TO hms_college_app;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_platform_app') THEN
        GRANT USAGE ON SCHEMA platform, app TO hms_platform_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA platform TO hms_platform_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA platform TO hms_platform_app;
        GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA platform, app TO hms_platform_app;
        GRANT SELECT ON ALL TABLES IN SCHEMA app TO hms_platform_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON app.users TO hms_platform_app;
        GRANT SELECT, INSERT ON platform.audit_logs, platform.login_events TO hms_platform_app;
    END IF;
END
$$;

-- Default privileges for future objects created in schemas
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hms_app, hms_college_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT SELECT ON TABLES TO hms_platform_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hms_platform_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT USAGE, SELECT ON SEQUENCES TO hms_app, hms_college_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA platform GRANT USAGE, SELECT ON SEQUENCES TO hms_platform_app;


-- ============================================================
-- 12. FUNCTION & SCHEMA COMMENTS
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

COMMENT ON FUNCTION app.is_platform_admin()
IS
'Returns TRUE only when session scope is PLATFORM and authenticated user has active platform super admin role.';

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