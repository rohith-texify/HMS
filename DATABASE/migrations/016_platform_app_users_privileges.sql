-- 016_platform_app_users_privileges.sql
-- Grant platform control plane role (hms_platform_app) write access on app.users
-- Required for Super Admin onboarding and managing college administrators.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_platform_app') THEN
        GRANT USAGE ON SCHEMA app TO hms_platform_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON app.users TO hms_platform_app;
    END IF;
END
$$;

