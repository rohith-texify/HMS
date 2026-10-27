BEGIN;

-- ============================================================
-- HMS - 903 SEED
-- Production baseline/reference seed data
--
-- IMPORTANT:
--   - No tables are created.
--   - No columns are added.
--   - No operational college/student data is inserted.
--   - Safe to execute repeatedly.
--   - Uses the existing frozen schema only.
--
-- MODULE RULES:
--   Root modules use:
--       parent_id = NULL
--       kind      = 'APP'
--       priority  = 'M'
--
-- Existing frozen constraint:
--   priority IN ('M', 'S', 'R')
-- ============================================================


-- ============================================================
-- 1. ROOT MODULES
-- ============================================================

INSERT INTO platform.modules
(
    module_code,
    module_name,
    parent_id,
    kind,
    priority,
    is_core,
    is_active
)
VALUES
    (
        'PLATFORM',
        'Platform Administration',
        NULL,
        'APP',
        'M',
        TRUE,
        TRUE
    ),
    (
        'ACADEMIC',
        'Academic Management',
        NULL,
        'APP',
        'M',
        TRUE,
        TRUE
    ),
    (
        'HOSTEL',
        'Hostel Management',
        NULL,
        'APP',
        'M',
        TRUE,
        TRUE
    ),
    (
        'PEOPLE',
        'People Management',
        NULL,
        'APP',
        'M',
        TRUE,
        TRUE
    ),
    (
        'MOVEMENT',
        'Attendance and Movement',
        NULL,
        'APP',
        'M',
        TRUE,
        TRUE
    ),
    (
        'REQUESTS',
        'Requests and Approvals',
        NULL,
        'APP',
        'M',
        TRUE,
        TRUE
    ),
    (
        'SUPPORT',
        'Support and Security',
        NULL,
        'APP',
        'M',
        TRUE,
        TRUE
    ),
    (
        'COMMUNICATION',
        'Communication',
        NULL,
        'APP',
        'M',
        TRUE,
        TRUE
    ),
    (
        'MEALS',
        'Meals and Mess',
        NULL,
        'APP',
        'M',
        TRUE,
        TRUE
    ),
    (
        'RESOURCES',
        'Resources',
        NULL,
        'APP',
        'M',
        TRUE,
        TRUE
    ),
    (
        'REPORTS',
        'Reports',
        NULL,
        'APP',
        'M',
        TRUE,
        TRUE
    )
ON CONFLICT DO NOTHING;


-- ============================================================
-- 2. SYSTEM ROLES
-- ============================================================

INSERT INTO platform.roles
(
    role_code,
    role_name,
    scope,
    is_system_role
)
VALUES
    (
        'SUPER_ADMIN',
        'Super Administrator',
        'PLATFORM',
        TRUE
    ),
    (
        'COLLEGE_ADMIN',
        'College Administrator',
        'COLLEGE',
        TRUE
    ),
    (
        'HOSTEL_ADMIN',
        'Hostel Administrator',
        'COLLEGE',
        TRUE
    ),
    (
        'WARDEN',
        'Warden',
        'COLLEGE',
        TRUE
    ),
    (
        'INCHARGE',
        'Hostel Incharge',
        'COLLEGE',
        TRUE
    ),
    (
        'SECURITY',
        'Security Staff',
        'COLLEGE',
        TRUE
    ),
    (
        'STAFF',
        'Staff',
        'COLLEGE',
        TRUE
    ),
    (
        'STUDENT',
        'Student',
        'COLLEGE',
        TRUE
    ),
    (
        'PARENT',
        'Parent',
        'COLLEGE',
        TRUE
    )
ON CONFLICT DO NOTHING;


-- ============================================================
-- 3. BASE PERMISSIONS
-- ============================================================

INSERT INTO platform.permissions
(
    module_id,
    permission_code,
    scope_type,
    description
)
SELECT
    m.module_id,
    x.permission_code,
    x.scope_type,
    x.description
FROM platform.modules m
CROSS JOIN
(
    VALUES

        (
            'PLATFORM',
            'platform.view',
            'PLATFORM',
            'View platform administration data'
        ),
        (
            'PLATFORM',
            'platform.manage',
            'PLATFORM',
            'Manage platform configuration'
        ),

        (
            'ACADEMIC',
            'academic.view',
            'COLLEGE',
            'View academic information'
        ),
        (
            'ACADEMIC',
            'academic.manage',
            'COLLEGE',
            'Manage academic information'
        ),

        (
            'HOSTEL',
            'hostel.view',
            'COLLEGE',
            'View hostel information'
        ),
        (
            'HOSTEL',
            'hostel.manage',
            'COLLEGE',
            'Manage hostel information'
        ),

        (
            'PEOPLE',
            'people.view',
            'COLLEGE',
            'View people information'
        ),
        (
            'PEOPLE',
            'people.manage',
            'COLLEGE',
            'Manage people information'
        ),

        (
            'MOVEMENT',
            'movement.view',
            'COLLEGE',
            'View attendance and movement'
        ),
        (
            'MOVEMENT',
            'movement.manage',
            'COLLEGE',
            'Manage attendance and movement'
        ),

        (
            'REQUESTS',
            'requests.view',
            'COLLEGE',
            'View requests'
        ),
        (
            'REQUESTS',
            'requests.manage',
            'COLLEGE',
            'Manage requests'
        ),

        (
            'SUPPORT',
            'support.view',
            'COLLEGE',
            'View support and security data'
        ),
        (
            'SUPPORT',
            'support.manage',
            'COLLEGE',
            'Manage support and security data'
        ),

        (
            'COMMUNICATION',
            'communication.view',
            'COLLEGE',
            'View communication data'
        ),
        (
            'COMMUNICATION',
            'communication.manage',
            'COLLEGE',
            'Manage communication'
        ),

        (
            'MEALS',
            'meals.view',
            'COLLEGE',
            'View meal and mess information'
        ),
        (
            'MEALS',
            'meals.manage',
            'COLLEGE',
            'Manage meal and mess information'
        ),

        (
            'RESOURCES',
            'resources.view',
            'COLLEGE',
            'View resources'
        ),
        (
            'RESOURCES',
            'resources.manage',
            'COLLEGE',
            'Manage resources'
        ),

        (
            'REPORTS',
            'reports.view',
            'COLLEGE',
            'View reports'
        ),
        (
            'REPORTS',
            'reports.manage',
            'COLLEGE',
            'Manage saved reports'
        )

) AS x(
    module_code,
    permission_code,
    scope_type,
    description
)
WHERE m.module_code = x.module_code
ON CONFLICT DO NOTHING;


-- ============================================================
-- 4. SUPER ADMIN PERMISSIONS
-- ============================================================

INSERT INTO platform.role_permissions
(
    role_id,
    permission_id
)
SELECT
    r.role_id,
    p.permission_id
FROM platform.roles r
CROSS JOIN platform.permissions p
WHERE r.role_code = 'SUPER_ADMIN'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 5. COLLEGE ADMIN PERMISSIONS
-- ============================================================

INSERT INTO platform.role_permissions
(
    role_id,
    permission_id
)
SELECT
    r.role_id,
    p.permission_id
FROM platform.roles r
JOIN platform.permissions p
    ON p.scope_type = 'COLLEGE'
WHERE r.role_code = 'COLLEGE_ADMIN'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 6. HOSTEL ADMIN PERMISSIONS
-- ============================================================

INSERT INTO platform.role_permissions
(
    role_id,
    permission_id
)
SELECT
    r.role_id,
    p.permission_id
FROM platform.roles r
JOIN platform.permissions p
    ON p.module_id = (
        SELECT module_id
        FROM platform.modules
        WHERE module_code = 'HOSTEL'
        LIMIT 1
    )
WHERE r.role_code = 'HOSTEL_ADMIN'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 7. WARDEN PERMISSIONS
-- ============================================================

INSERT INTO platform.role_permissions
(
    role_id,
    permission_id
)
SELECT
    r.role_id,
    p.permission_id
FROM platform.roles r
JOIN platform.permissions p
    ON p.module_id IN
    (
        SELECT module_id
        FROM platform.modules
        WHERE module_code IN
        (
            'HOSTEL',
            'PEOPLE',
            'MOVEMENT',
            'REQUESTS',
            'SUPPORT'
        )
    )
WHERE r.role_code = 'WARDEN'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 8. HOSTEL INCHARGE PERMISSIONS
-- ============================================================

INSERT INTO platform.role_permissions
(
    role_id,
    permission_id
)
SELECT
    r.role_id,
    p.permission_id
FROM platform.roles r
JOIN platform.permissions p
    ON p.module_id IN
    (
        SELECT module_id
        FROM platform.modules
        WHERE module_code IN
        (
            'HOSTEL',
            'PEOPLE',
            'MOVEMENT',
            'REQUESTS'
        )
    )
WHERE r.role_code = 'INCHARGE'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 9. SECURITY PERMISSIONS
-- ============================================================

INSERT INTO platform.role_permissions
(
    role_id,
    permission_id
)
SELECT
    r.role_id,
    p.permission_id
FROM platform.roles r
JOIN platform.permissions p
    ON p.module_id IN
    (
        SELECT module_id
        FROM platform.modules
        WHERE module_code IN
        (
            'MOVEMENT',
            'REQUESTS',
            'SUPPORT'
        )
    )
WHERE r.role_code = 'SECURITY'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 10. STAFF PERMISSIONS
-- ============================================================

INSERT INTO platform.role_permissions
(
    role_id,
    permission_id
)
SELECT
    r.role_id,
    p.permission_id
FROM platform.roles r
JOIN platform.permissions p
    ON p.scope_type = 'COLLEGE'
WHERE r.role_code = 'STAFF'
  AND p.permission_code LIKE '%.view'
ON CONFLICT DO NOTHING;


-- ============================================================
-- 11. STUDENT PERMISSIONS
-- ============================================================

INSERT INTO platform.role_permissions
(
    role_id,
    permission_id
)
SELECT
    r.role_id,
    p.permission_id
FROM platform.roles r
JOIN platform.permissions p
    ON p.scope_type = 'COLLEGE'
WHERE r.role_code = 'STUDENT'
  AND p.permission_code IN
  (
      'hostel.view',
      'movement.view',
      'requests.view',
      'support.view',
      'communication.view',
      'meals.view',
      'resources.view',
      'reports.view'
  )
ON CONFLICT DO NOTHING;


-- ============================================================
-- 12. PARENT PERMISSIONS
-- ============================================================

INSERT INTO platform.role_permissions
(
    role_id,
    permission_id
)
SELECT
    r.role_id,
    p.permission_id
FROM platform.roles r
JOIN platform.permissions p
    ON p.scope_type = 'COLLEGE'
WHERE r.role_code = 'PARENT'
  AND p.permission_code IN
  (
      'hostel.view',
      'movement.view',
      'requests.view',
      'support.view',
      'communication.view',
      'meals.view'
  )
ON CONFLICT DO NOTHING;


-- ============================================================
-- 13. ENTITLEMENT TEMPLATES
-- ============================================================

INSERT INTO platform.entitlement_templates
(
    template_code,
    name,
    description,
    is_active
)
VALUES
    (
        'STANDARD_COLLEGE',
        'Standard College',
        'Default entitlement template for a standard hostel management deployment.',
        TRUE
    ),
    (
        'PREMIUM_COLLEGE',
        'Premium College',
        'Extended entitlement template for deployments requiring additional platform capabilities.',
        TRUE
    )
ON CONFLICT DO NOTHING;


-- ============================================================
-- 14. TENANT DATA
-- ============================================================
--
-- No college records are inserted here.
--
-- Colleges are real tenant records and must be created through
-- the Super Admin / onboarding workflow.
--
-- This migration only creates global reference data.
-- ============================================================


-- ============================================================
-- 15. SEED VALIDATION SUMMARY
-- ============================================================

DO $$
DECLARE
    v_modules INTEGER;
    v_roles INTEGER;
    v_permissions INTEGER;
    v_role_permissions INTEGER;
    v_templates INTEGER;
BEGIN

    SELECT COUNT(*)
    INTO v_modules
    FROM platform.modules;

    SELECT COUNT(*)
    INTO v_roles
    FROM platform.roles;

    SELECT COUNT(*)
    INTO v_permissions
    FROM platform.permissions;

    SELECT COUNT(*)
    INTO v_role_permissions
    FROM platform.role_permissions;

    SELECT COUNT(*)
    INTO v_templates
    FROM platform.entitlement_templates;

    RAISE NOTICE
        '============================================================';

    RAISE NOTICE
        'HMS 903 SEED COMPLETED';

    RAISE NOTICE
        'Modules               : %',
        v_modules;

    RAISE NOTICE
        'Roles                 : %',
        v_roles;

    RAISE NOTICE
        'Permissions           : %',
        v_permissions;

    RAISE NOTICE
        'Role Permissions      : %',
        v_role_permissions;

    RAISE NOTICE
        'Entitlement Templates : %',
        v_templates;

    RAISE NOTICE
        '============================================================';

END $$;


COMMIT;