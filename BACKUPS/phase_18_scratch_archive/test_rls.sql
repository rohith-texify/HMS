\set ON_ERROR_STOP on

DO $$ BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hms_api_role') THEN
      CREATE ROLE hms_api_role NOLOGIN;
   END IF;
END $$;
GRANT USAGE ON SCHEMA app, platform TO hms_api_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app, platform TO hms_api_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app, platform TO hms_api_role;

DO $$ DECLARE
   col_a UUID := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
   col_b UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
   user_a UUID := 'aaaaaaaa-1111-aaaa-aaaa-aaaaaaaaaaaa';
   user_b UUID := 'bbbbbbbb-1111-bbbb-bbbb-bbbbbbbbbbbb';
BEGIN
   INSERT INTO platform.colleges (college_id, college_code, name, status) VALUES 
   (col_a, 'COLA', 'College A', 'ACTIVE'),
   (col_b, 'COLB', 'College B', 'ACTIVE') ON CONFLICT DO NOTHING;

   INSERT INTO app.users (user_id, email, phone) VALUES
   (user_a, 'a@col.a', '111'),
   (user_b, 'b@col.b', '222') ON CONFLICT DO NOTHING;

   INSERT INTO app.reports_saved (college_id, owner_user_id, name, report_type) VALUES
   (col_a, user_a, 'Report A', 'TEST'),
   (col_b, user_b, 'Report B', 'TEST');

   INSERT INTO app.files (college_id, owner_table, owner_id, uploaded_by, storage_path, original_filename, mime_type, size_bytes) VALUES
   (col_a, 'users', user_a, user_a, '/a', 'a.txt', 'text/plain', 1),
   (col_b, 'users', user_b, user_b, '/b', 'b.txt', 'text/plain', 1);
END $$;

SET ROLE hms_api_role;

-- 1. Missing tenant context
DO $$ DECLARE c INT; BEGIN
   SELECT COUNT(*) INTO c FROM app.reports_saved;
   IF c > 0 THEN RAISE EXCEPTION 'RLS FAIL: Non-tenant can read reports'; END IF;
END $$;

-- 2. Transaction local context Tenant A
BEGIN;
SELECT set_config('app.current_tenant_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
DO $$ DECLARE c INT; BEGIN
   SELECT COUNT(*) INTO c FROM app.reports_saved;
   IF c != 1 THEN RAISE EXCEPTION 'RLS FAIL: Tenant A read % reports', c; END IF;
END $$;
COMMIT;

-- 3. Confirm missing tenant context does not leak
DO $$ DECLARE c INT; BEGIN
   SELECT COUNT(*) INTO c FROM app.reports_saved;
   IF c > 0 THEN RAISE EXCEPTION 'RLS FAIL: Tenant leaked outside transaction'; END IF;
END $$;

-- 4. Transaction local context Tenant B
BEGIN;
SELECT set_config('app.current_tenant_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
DO $$ DECLARE c INT; BEGIN
   SELECT COUNT(*) INTO c FROM app.reports_saved;
   IF c != 1 THEN RAISE EXCEPTION 'RLS FAIL: Tenant B read % reports', c; END IF;
   
   -- Should not see A's rows
   SELECT COUNT(*) INTO c FROM app.reports_saved WHERE college_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
   IF c > 0 THEN RAISE EXCEPTION 'RLS FAIL: Tenant B read Tenant A rows'; END IF;
END $$;
COMMIT;

RESET ROLE;
