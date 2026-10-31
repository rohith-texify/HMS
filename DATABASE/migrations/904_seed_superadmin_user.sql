BEGIN;

-- ============================================================
-- HMS - 904 SEED SUPERADMIN USER
-- Creates Super Admin test user for development and testing
--
-- IMPORTANT:
--   - Only creates ONE superadmin test user
--   - Safe to execute repeatedly (uses ON CONFLICT)
--   - Email: superadmin@hms.local
--   - Password: Password@123
--   - Scope: PLATFORM
--   - Status: ACTIVE
-- ============================================================

-- Helper function to hash password with bcrypt (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'crypt') THEN
    -- pgcrypto extension provides crypt() function for bcrypt
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- ============================================================
-- 1. CREATE TEST SUPERADMIN USER
-- ============================================================

-- Insert user with bcrypt hashed password
-- Password: Password@123 (bcrypted)
INSERT INTO app.users (
    email,
    phone,
    password_hash,
    status,
    created_at,
    updated_at
)
VALUES (
    'superadmin@hms.local',
    '+919999999999',
    -- Bcrypt hash of "Password@123"
    -- Generated using: SELECT crypt('Password@123', gen_salt('bf', 12));
    '$2a$12$eImiTXuWVxfaHNYY0iCa.OPST9/PgBkqquzi.Ss7KIUgO2PKPejGi',
    'ACTIVE',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE
SET updated_at = NOW();

-- ============================================================
-- 2. ASSIGN SUPER_ADMIN ROLE TO TEST USER
-- ============================================================

INSERT INTO platform.user_roles (
    user_id,
    role_id,
    college_id,
    status,
    created_at,
    updated_at
)
SELECT
    u.user_id,
    r.role_id,
    NULL, -- Super Admin has no college_id
    'ACTIVE',
    NOW(),
    NOW()
FROM app.users u
CROSS JOIN platform.roles r
WHERE u.email = 'superadmin@hms.local'
  AND r.role_code = 'SUPER_ADMIN'
  AND NOT EXISTS (
      SELECT 1
      FROM platform.user_roles ur
      WHERE ur.user_id = u.user_id
        AND ur.role_id = r.role_id
  );

-- ============================================================
-- 3. VERIFICATION
-- ============================================================

DO $$
DECLARE
    v_user_count INTEGER;
    v_role_count INTEGER;
    v_user_id UUID;
BEGIN

    SELECT COUNT(*)
    INTO v_user_count
    FROM app.users
    WHERE email = 'superadmin@hms.local';

    SELECT COUNT(*)
    INTO v_role_count
    FROM app.users u
    JOIN platform.user_roles ur ON u.user_id = ur.user_id
    JOIN platform.roles r ON ur.role_id = r.role_id
    WHERE u.email = 'superadmin@hms.local'
      AND r.role_code = 'SUPER_ADMIN';

    SELECT u.user_id
    INTO v_user_id
    FROM app.users u
    WHERE u.email = 'superadmin@hms.local';

    RAISE NOTICE
        '============================================================';

    RAISE NOTICE
        'HMS 904 SEED SUPERADMIN USER COMPLETED';

    RAISE NOTICE
        'Email                 : superadmin@hms.local';

    RAISE NOTICE
        'Password              : Password@123';

    RAISE NOTICE
        'User Found            : %',
        CASE WHEN v_user_count > 0 THEN 'YES' ELSE 'NO' END;

    RAISE NOTICE
        'Super Admin Role      : %',
        CASE WHEN v_role_count > 0 THEN 'ASSIGNED' ELSE 'NOT ASSIGNED' END;

    RAISE NOTICE
        'User ID               : %',
        v_user_id;

    RAISE NOTICE
        '============================================================';

END $$;


COMMIT;
