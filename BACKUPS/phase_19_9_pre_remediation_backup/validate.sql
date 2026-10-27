BEGIN;

DO $$
DECLARE

    required_schemas TEXT[] := ARRAY[
        'platform',
        'app'
    ];

    required_tables TEXT[] := ARRAY[
        'platform.colleges',
        'app.users',
        'platform.roles',
        'platform.user_roles',
        'platform.modules',
        'platform.permissions',
        'platform.role_permissions',
        'platform.college_modules',
        'platform.entitlement_templates',
        'platform.college_settings',
        'platform.college_onboarding',
        'platform.approval_requests',
        'platform.approval_steps',
        'platform.audit_logs',
        'platform.login_events',
        'platform.support_access_grants',
        'platform.device_tokens',

        'app.departments',
        'app.programs',
        'app.courses',
        'app.academic_years',
        'app.semesters',
        'app.batches',

        'app.hostels',
        'app.blocks',
        'app.floors',
        'app.rooms',
        'app.beds',
        'app.bed_allocations',
        'app.room_maintenance',
        'app.gates',

        'app.students',
        'app.parents',
        'app.student_parents',
        'app.emergency_contacts',
        'app.staff_profiles',
        'app.incharge_hostels',
        'app.security_assignments',

        'app.attendance_cards',
        'app.attendance_records',
        'app.entry_exit_records',
        'app.record_corrections',

        'app.leave_requests',
        'app.leave_approvals',
        'app.leave_verification_logs',
        'app.gate_passes',
        'app.gate_pass_verifications',
        'app.visitor_requests',
        'app.visitors',
        'app.visitor_visits',
        'app.parcels',

        'app.complaints',
        'app.complaint_updates',
        'app.sos_alerts',
        'app.security_incidents',
        'app.incident_updates',

        'app.notifications',
        'app.notification_recipients',
        'app.announcements',
        'app.platform_notifications',

        'app.meal_menus',
        'app.meal_timings',
        'app.mess_notices',
        'app.food_feedback',
        'app.resource_items',
        'app.resource_availability',
        'app.reports_saved',
        'app.files'
    ];

    required_views TEXT[] := ARRAY[
        'app.v_current_student_bed_allocation',
        'app.v_student_current_location',
        'app.v_hostel_occupancy',
        'app.v_open_complaint_summary',
        'app.v_active_sos_alerts',
        'app.v_today_meal_menus',
        'app.v_resource_availability',
        'app.v_pending_leave_requests',
        'app.v_current_visitor_activity'
    ];

    required_functions TEXT[] := ARRAY[
        'app.current_tenant_id()',
        'app.has_tenant_context()',
        'platform.generate_uuid()'
    ];

    item TEXT;
    v_schema TEXT;
    v_object TEXT;
    v_function TEXT;
    v_args TEXT;
    v_exists BOOLEAN;

    pk_count INTEGER;
    fk_count INTEGER;
    rls_count INTEGER;
    policy_count INTEGER;
    index_count INTEGER;
    table_count INTEGER;
    view_count INTEGER;

    module_count INTEGER;
    role_count INTEGER;
    permission_count INTEGER;
    entitlement_count INTEGER;

BEGIN

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'HMS DATABASE VALIDATION STARTED';
    RAISE NOTICE '============================================================';


    ----------------------------------------------------------------
    -- 1. SCHEMAS
    ----------------------------------------------------------------

    FOREACH item IN ARRAY required_schemas
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.schemata s
            WHERE s.schema_name = item
        ) THEN
            RAISE EXCEPTION
                'VALIDATION FAILED: Required schema % missing',
                item;
        END IF;
    END LOOP;

    RAISE NOTICE 'PASS: Required schemas exist';


    ----------------------------------------------------------------
    -- 2. REQUIRED TABLES
    ----------------------------------------------------------------

    FOREACH item IN ARRAY required_tables
    LOOP
        v_schema := split_part(item, '.', 1);
        v_object := split_part(item, '.', 2);

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.tables t
            WHERE t.table_schema = v_schema
              AND t.table_name = v_object
              AND t.table_type = 'BASE TABLE'
        ) THEN
            RAISE EXCEPTION
                'VALIDATION FAILED: Required table % missing',
                item;
        END IF;
    END LOOP;

    RAISE NOTICE 'PASS: All required HMS tables exist';


    ----------------------------------------------------------------
    -- 3. REQUIRED VIEWS
    ----------------------------------------------------------------

    FOREACH item IN ARRAY required_views
    LOOP
        v_schema := split_part(item, '.', 1);
        v_object := split_part(item, '.', 2);

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.views v
            WHERE v.table_schema = v_schema
              AND v.table_name = v_object
        ) THEN
            RAISE EXCEPTION
                'VALIDATION FAILED: Required view % missing',
                item;
        END IF;
    END LOOP;

    RAISE NOTICE 'PASS: Required views exist';


    ----------------------------------------------------------------
    -- 4. EXTENSIONS
    ----------------------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pgcrypto'
    ) THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: pgcrypto extension missing';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'citext'
    ) THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: citext extension missing';
    END IF;

    RAISE NOTICE 'PASS: Required PostgreSQL extensions exist';


    ----------------------------------------------------------------
    -- 5. REQUIRED FUNCTIONS
    ----------------------------------------------------------------

    FOREACH item IN ARRAY required_functions
    LOOP

        v_function := split_part(item, '(', 1);

        v_args := split_part(
            split_part(item, '(', 2),
            ')',
            1
        );

        v_schema := split_part(v_function, '.', 1);
        v_object := split_part(v_function, '.', 2);

        SELECT EXISTS (
            SELECT 1
            FROM pg_proc p
            JOIN pg_namespace n
                ON n.oid = p.pronamespace
            WHERE n.nspname = v_schema
              AND p.proname = v_object
              AND pg_get_function_identity_arguments(p.oid) = v_args
        )
        INTO v_exists;

        IF NOT v_exists THEN
            RAISE EXCEPTION
                'VALIDATION FAILED: Required function % missing',
                item;
        END IF;

    END LOOP;

    RAISE NOTICE 'PASS: Required database functions exist';


    ----------------------------------------------------------------
    -- 6. PRIMARY KEYS
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO pk_count
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'PRIMARY KEY'
      AND tc.table_schema IN ('platform', 'app');

    IF pk_count < 68 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: Expected at least 68 primary keys, found %',
            pk_count;
    END IF;

    RAISE NOTICE 'PASS: All HMS tables have primary keys';


    ----------------------------------------------------------------
    -- 7. FOREIGN KEYS
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO fk_count
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema IN ('platform', 'app');

    IF fk_count = 0 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: No foreign key relationships found';
    END IF;

    RAISE NOTICE 'PASS: Foreign key relationships exist';


    ----------------------------------------------------------------
    -- 8. TENANT OWNERSHIP STRUCTURE
    ----------------------------------------------------------------

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'app'
          AND c.table_name = 'users'
          AND c.column_name = 'college_id'
    ) THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: app.users must not contain college_id';
    END IF;


    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'platform'
          AND c.table_name = 'user_roles'
          AND c.column_name = 'college_id'
    ) THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: platform.user_roles must contain college_id';
    END IF;


    FOREACH item IN ARRAY ARRAY[
        'app.students',
        'app.hostels',
        'app.complaints',
        'app.notifications'
    ]
    LOOP

        v_schema := split_part(item, '.', 1);
        v_object := split_part(item, '.', 2);

        IF NOT EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = v_schema
              AND c.table_name = v_object
              AND c.column_name = 'college_id'
        ) THEN
            RAISE EXCEPTION
                'VALIDATION FAILED: Tenant-owned table % missing college_id',
                item;
        END IF;

    END LOOP;

    RAISE NOTICE 'PASS: Tenant ownership structure validated';


    ----------------------------------------------------------------
    -- 9. ROW LEVEL SECURITY
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO rls_count
    FROM pg_class c
    JOIN pg_namespace n
        ON n.oid = c.relnamespace
    WHERE n.nspname = 'app'
      AND c.relkind = 'r'
      AND c.relrowsecurity = TRUE;

    IF rls_count = 0 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: No app tables have Row Level Security enabled';
    END IF;

    RAISE NOTICE 'PASS: Row Level Security enabled';


    ----------------------------------------------------------------
    -- 10. FORCE ROW LEVEL SECURITY
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO rls_count
    FROM pg_class c
    JOIN pg_namespace n
        ON n.oid = c.relnamespace
    WHERE n.nspname = 'app'
      AND c.relkind = 'r'
      AND c.relforcerowsecurity = TRUE;

    IF rls_count = 0 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: No app tables have FORCE ROW LEVEL SECURITY enabled';
    END IF;

    RAISE NOTICE 'PASS: FORCE ROW LEVEL SECURITY enabled';


    ----------------------------------------------------------------
    -- 11. RLS POLICIES
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO policy_count
    FROM pg_policies p
    WHERE p.schemaname = 'app';

    IF policy_count = 0 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: No RLS policies found in app schema';
    END IF;

    RAISE NOTICE 'PASS: RLS policies exist';


    ----------------------------------------------------------------
    -- 12. NOTIFICATION RECIPIENT RLS
    ----------------------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = 'app'
          AND p.tablename = 'notification_recipients'
    ) THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: notification_recipients RLS policy missing';
    END IF;

    RAISE NOTICE 'PASS: Notification recipient RLS exists';


    ----------------------------------------------------------------
    -- 13. APPROVAL STEP RLS
    ----------------------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = 'platform'
          AND p.tablename = 'approval_steps'
    ) THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: approval_steps RLS policy missing';
    END IF;

    RAISE NOTICE 'PASS: Approval step RLS exists';


    ----------------------------------------------------------------
    -- 14. INDEXES
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO index_count
    FROM pg_indexes i
    WHERE i.schemaname IN ('platform', 'app');

    IF index_count = 0 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: No indexes found';
    END IF;

    RAISE NOTICE 'PASS: Database indexes exist';


    ----------------------------------------------------------------
    -- 15. MODULE SEED DATA
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO module_count
    FROM platform.modules;

    IF module_count < 11 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: Expected at least 11 seeded modules, found %',
            module_count;
    END IF;

    RAISE NOTICE 'PASS: Required module seed data exists';


    ----------------------------------------------------------------
    -- 16. ROLE SEED DATA
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO role_count
    FROM platform.roles;

    IF role_count < 9 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: Expected at least 9 seeded roles, found %',
            role_count;
    END IF;

    RAISE NOTICE 'PASS: Required role seed data exists';


    ----------------------------------------------------------------
    -- 17. PERMISSION SEED DATA
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO permission_count
    FROM platform.permissions;

    IF permission_count < 22 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: Expected at least 22 seeded permissions, found %',
            permission_count;
    END IF;

    RAISE NOTICE 'PASS: Required permission seed data exists';


    ----------------------------------------------------------------
    -- 18. ROLE-PERMISSION MAPPINGS
    ----------------------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM platform.role_permissions
    ) THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: role_permissions contains no records';
    END IF;

    RAISE NOTICE 'PASS: Role-permission mappings exist';


    ----------------------------------------------------------------
    -- 19. ENTITLEMENT TEMPLATES
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO entitlement_count
    FROM platform.entitlement_templates;

    IF entitlement_count < 2 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: Expected at least 2 seeded entitlement templates, found %',
            entitlement_count;
    END IF;

    RAISE NOTICE 'PASS: Entitlement templates exist';


    ----------------------------------------------------------------
    -- 20. AUDIT LOGGING
    ----------------------------------------------------------------

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables t
        WHERE t.table_schema = 'platform'
          AND t.table_name = 'audit_logs'
    ) THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: platform.audit_logs missing';
    END IF;

    RAISE NOTICE 'PASS: Audit logging table exists';


    ----------------------------------------------------------------
    -- 21. FINAL TABLE COUNT
    --
    -- IMPORTANT:
    -- The actual frozen HMS schema contains 68 tables.
    -- Do NOT add a fake table just to reach 69.
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO table_count
    FROM information_schema.tables t
    WHERE t.table_schema IN ('platform', 'app')
      AND t.table_type = 'BASE TABLE';

    IF table_count < 68 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: Expected at least 68 tables, found %',
            table_count;
    END IF;

    RAISE NOTICE 'PASS: HMS table count = %', table_count;


    ----------------------------------------------------------------
    -- 22. FINAL VIEW COUNT
    ----------------------------------------------------------------

    SELECT COUNT(*)
    INTO view_count
    FROM information_schema.views v
    WHERE v.table_schema IN ('platform', 'app');

    IF view_count < 9 THEN
        RAISE EXCEPTION
            'VALIDATION FAILED: Expected at least 9 views, found %',
            view_count;
    END IF;

    RAISE NOTICE 'PASS: HMS view count = %', view_count;


    ----------------------------------------------------------------
    -- FINAL RESULT
    ----------------------------------------------------------------

    RAISE NOTICE '============================================================';
    RAISE NOTICE 'HMS DATABASE VALIDATION PASSED';
    RAISE NOTICE '============================================================';

END $$;

COMMIT;