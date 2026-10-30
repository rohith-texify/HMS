-- ============================================================================
-- HMS - 904 SEED USERS
-- ============================================================================
-- Purpose:
--   Creates test/demo user accounts for development and testing.
--   Includes password hashes for common roles.
--
-- IMPORTANT:
--   - This migration is environment-specific
--   - Use ONLY in development and testing environments
--   - NEVER execute in production without review
--   - All passwords are intentionally simple for testing
--
-- Test Credentials:
--   Super Admin: superadmin@hms.local / Password@123
--   College Admin: admin@test-college.local / Password@123
--   Student: student@test-college.local / Password@123
--   Parent: parent@test-college.local / Password@123
--   Hostel Incharge: incharge@test-college.local / Password@123
--   Security: security@test-college.local / Password@123
--
-- Password Hash Reference (bcrypt):
--   Password@123 → $2a$12$T/G.xLh3qeD3xSq6EKv52eN7M96LlR1K8Y7gN2.xGMpqL4K5YnEhW
--
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE TEST COLLEGE
-- ============================================================================

INSERT INTO platform.colleges (
    college_code,
    name,
    city,
    state,
    timezone,
    status,
    contact_email
) VALUES (
    'TEST_COLLEGE',
    'Test College University',
    'Test City',
    'Test State',
    'Asia/Kolkata',
    'ACTIVE',
    'contact@testcollege.edu'
) ON CONFLICT (college_code) DO NOTHING;

-- Get the college ID for use in the following inserts
-- This will be used in subsequent statements
DO $$
DECLARE
    v_college_id uuid;
    v_super_admin_user_id uuid;
    v_admin_user_id uuid;
    v_student_user_id uuid;
    v_parent_user_id uuid;
    v_incharge_user_id uuid;
    v_security_user_id uuid;
    v_super_admin_role_id uuid;
    v_college_admin_role_id uuid;
    v_student_role_id uuid;
    v_parent_role_id uuid;
    v_incharge_role_id uuid;
    v_security_role_id uuid;
BEGIN
    -- Get college ID
    SELECT college_id INTO v_college_id
    FROM platform.colleges
    WHERE college_code = 'TEST_COLLEGE'
    LIMIT 1;

    IF v_college_id IS NULL THEN
        RAISE EXCEPTION 'Test college not found';
    END IF;

    -- Get role IDs
    SELECT role_id INTO v_super_admin_role_id
    FROM platform.roles
    WHERE role_code = 'SUPER_ADMIN'
    LIMIT 1;

    SELECT role_id INTO v_college_admin_role_id
    FROM platform.roles
    WHERE role_code = 'COLLEGE_ADMIN'
    LIMIT 1;

    SELECT role_id INTO v_student_role_id
    FROM platform.roles
    WHERE role_code = 'STUDENT'
    LIMIT 1;

    SELECT role_id INTO v_parent_role_id
    FROM platform.roles
    WHERE role_code = 'PARENT'
    LIMIT 1;

    SELECT role_id INTO v_incharge_role_id
    FROM platform.roles
    WHERE role_code = 'INCHARGE'
    LIMIT 1;

    SELECT role_id INTO v_security_role_id
    FROM platform.roles
    WHERE role_code = 'SECURITY'
    LIMIT 1;

    -- ========================================================================
    -- 2. CREATE SUPER ADMIN USER
    -- ========================================================================
    INSERT INTO app.users (
        email,
        phone,
        password_hash,
        status,
        mfa_enabled
    ) VALUES (
        'superadmin@hms.local',
        '+91-9876543210',
        '$2a$12$T/G.xLh3qeD3xSq6EKv52eN7M96LlR1K8Y7gN2.xGMpqL4K5YnEhW', -- Password@123
        'ACTIVE',
        FALSE
    ) ON CONFLICT (email) DO NOTHING
    RETURNING user_id INTO v_super_admin_user_id;

    -- If user already exists, get the ID
    IF v_super_admin_user_id IS NULL THEN
        SELECT user_id INTO v_super_admin_user_id
        FROM app.users
        WHERE email = 'superadmin@hms.local'
        LIMIT 1;
    END IF;

    -- Assign SUPER_ADMIN role (platform scope)
    INSERT INTO platform.user_roles (
        user_id,
        role_id,
        college_id,
        status
    ) VALUES (
        v_super_admin_user_id,
        v_super_admin_role_id,
        NULL,  -- Platform roles have no college
        'ACTIVE'
    ) ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- 3. CREATE COLLEGE ADMIN USER
    -- ========================================================================
    INSERT INTO app.users (
        email,
        phone,
        password_hash,
        status,
        mfa_enabled
    ) VALUES (
        'admin@test-college.local',
        '+91-9876543211',
        '$2a$12$T/G.xLh3qeD3xSq6EKv52eN7M96LlR1K8Y7gN2.xGMpqL4K5YnEhW', -- Password@123
        'ACTIVE',
        FALSE
    ) ON CONFLICT (email) DO NOTHING
    RETURNING user_id INTO v_admin_user_id;

    IF v_admin_user_id IS NULL THEN
        SELECT user_id INTO v_admin_user_id
        FROM app.users
        WHERE email = 'admin@test-college.local'
        LIMIT 1;
    END IF;

    INSERT INTO platform.user_roles (
        user_id,
        role_id,
        college_id,
        status
    ) VALUES (
        v_admin_user_id,
        v_college_admin_role_id,
        v_college_id,  -- College scoped role
        'ACTIVE'
    ) ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- 4. CREATE STUDENT USER
    -- ========================================================================
    INSERT INTO app.users (
        email,
        phone,
        password_hash,
        status,
        mfa_enabled
    ) VALUES (
        'student@test-college.local',
        '+91-9876543212',
        '$2a$12$T/G.xLh3qeD3xSq6EKv52eN7M96LlR1K8Y7gN2.xGMpqL4K5YnEhW', -- Password@123
        'ACTIVE',
        FALSE
    ) ON CONFLICT (email) DO NOTHING
    RETURNING user_id INTO v_student_user_id;

    IF v_student_user_id IS NULL THEN
        SELECT user_id INTO v_student_user_id
        FROM app.users
        WHERE email = 'student@test-college.local'
        LIMIT 1;
    END IF;

    INSERT INTO platform.user_roles (
        user_id,
        role_id,
        college_id,
        status
    ) VALUES (
        v_student_user_id,
        v_student_role_id,
        v_college_id,
        'ACTIVE'
    ) ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- 5. CREATE PARENT USER
    -- ========================================================================
    INSERT INTO app.users (
        email,
        phone,
        password_hash,
        status,
        mfa_enabled
    ) VALUES (
        'parent@test-college.local',
        '+91-9876543213',
        '$2a$12$T/G.xLh3qeD3xSq6EKv52eN7M96LlR1K8Y7gN2.xGMpqL4K5YnEhW', -- Password@123
        'ACTIVE',
        FALSE
    ) ON CONFLICT (email) DO NOTHING
    RETURNING user_id INTO v_parent_user_id;

    IF v_parent_user_id IS NULL THEN
        SELECT user_id INTO v_parent_user_id
        FROM app.users
        WHERE email = 'parent@test-college.local'
        LIMIT 1;
    END IF;

    INSERT INTO platform.user_roles (
        user_id,
        role_id,
        college_id,
        status
    ) VALUES (
        v_parent_user_id,
        v_parent_role_id,
        v_college_id,
        'ACTIVE'
    ) ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- 6. CREATE HOSTEL INCHARGE USER
    -- ========================================================================
    INSERT INTO app.users (
        email,
        phone,
        password_hash,
        status,
        mfa_enabled
    ) VALUES (
        'incharge@test-college.local',
        '+91-9876543214',
        '$2a$12$T/G.xLh3qeD3xSq6EKv52eN7M96LlR1K8Y7gN2.xGMpqL4K5YnEhW', -- Password@123
        'ACTIVE',
        FALSE
    ) ON CONFLICT (email) DO NOTHING
    RETURNING user_id INTO v_incharge_user_id;

    IF v_incharge_user_id IS NULL THEN
        SELECT user_id INTO v_incharge_user_id
        FROM app.users
        WHERE email = 'incharge@test-college.local'
        LIMIT 1;
    END IF;

    INSERT INTO platform.user_roles (
        user_id,
        role_id,
        college_id,
        status
    ) VALUES (
        v_incharge_user_id,
        v_incharge_role_id,
        v_college_id,
        'ACTIVE'
    ) ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- 7. CREATE SECURITY USER
    -- ========================================================================
    INSERT INTO app.users (
        email,
        phone,
        password_hash,
        status,
        mfa_enabled
    ) VALUES (
        'security@test-college.local',
        '+91-9876543215',
        '$2a$12$T/G.xLh3qeD3xSq6EKv52eN7M96LlR1K8Y7gN2.xGMpqL4K5YnEhW', -- Password@123
        'ACTIVE',
        FALSE
    ) ON CONFLICT (email) DO NOTHING
    RETURNING user_id INTO v_security_user_id;

    IF v_security_user_id IS NULL THEN
        SELECT user_id INTO v_security_user_id
        FROM app.users
        WHERE email = 'security@test-college.local'
        LIMIT 1;
    END IF;

    INSERT INTO platform.user_roles (
        user_id,
        role_id,
        college_id,
        status
    ) VALUES (
        v_security_user_id,
        v_security_role_id,
        v_college_id,
        'ACTIVE'
    ) ON CONFLICT DO NOTHING;

    -- ========================================================================
    -- 8. REPORT RESULTS
    -- ========================================================================
    RAISE NOTICE '============================================================';
    RAISE NOTICE 'HMS 904 SEED USERS COMPLETED';
    RAISE NOTICE 'College: TEST_COLLEGE (ID: %)', v_college_id;
    RAISE NOTICE 'Super Admin: superadmin@hms.local';
    RAISE NOTICE 'College Admin: admin@test-college.local';
    RAISE NOTICE 'Student: student@test-college.local';
    RAISE NOTICE 'Parent: parent@test-college.local';
    RAISE NOTICE 'Incharge: incharge@test-college.local';
    RAISE NOTICE 'Security: security@test-college.local';
    RAISE NOTICE 'All passwords: Password@123';
    RAISE NOTICE '============================================================';

END $$;

COMMIT;
