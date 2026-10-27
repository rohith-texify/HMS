-- ============================================================================
-- HMS - 001 PLATFORM
-- ============================================================================
-- Domain:
--   Platform & Access
--
-- Purpose:
--   Creates the foundation used by every HMS tenant/college and by the
--   Super Admin platform.
--
-- Tables:
--   1.  colleges
--   2.  users
--   3.  roles
--   4.  user_roles
--   5.  modules
--   6.  permissions
--   7.  role_permissions
--   8.  college_modules
--   9.  entitlement_templates
--   10. college_settings
--   11. college_onboarding
--   12. approval_requests
--   13. approval_steps
--   14. audit_logs
--   15. login_events
--   16. support_access_grants
--   17. device_tokens
--
-- IMPORTANT:
--   This migration establishes the platform contract.
--   Later migrations must reference these structures instead of recreating
--   equivalent tables.
--
-- Source architecture:
--   HMS Database Architecture v1.0
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. COLLEGES
-- ============================================================================
-- One row represents one HMS tenant/college.
-- ============================================================================

CREATE TABLE platform.colleges (
    college_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    college_code            citext NOT NULL,
    name                    varchar(200) NOT NULL,

    city                    varchar(100),
    state                   varchar(100),
    timezone                varchar(100) NOT NULL DEFAULT 'UTC',

    status                  varchar(30) NOT NULL DEFAULT 'ACTIVE',

    contact_email           citext,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_colleges_college_code
        UNIQUE (college_code),

    CONSTRAINT ck_colleges_status
        CHECK (
            status IN (
                'ONBOARDING',
                'ACTIVE',
                'SUSPENDED',
                'DEACTIVATED'
            )
        )
);

COMMENT ON TABLE platform.colleges IS
'One row per HMS tenant/college. Platform-owned tenant registry.';

COMMENT ON COLUMN platform.colleges.college_code IS
'Permanent unique tenant/college code.';

COMMENT ON COLUMN platform.colleges.status IS
'Lifecycle state of the college tenant.';

-- ============================================================================
-- 2. USERS
-- ============================================================================
-- Shared login identity for all HMS users.
-- A user can belong to one or more college contexts through user_roles.
-- ============================================================================

CREATE TABLE app.users (
    user_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    email                   citext,
    phone                   varchar(30),

    password_hash           text,

    status                  varchar(30) NOT NULL DEFAULT 'ACTIVE',

    mfa_enabled             boolean NOT NULL DEFAULT false,

    last_login_at           timestamptz,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_users_email
        UNIQUE (email),

    CONSTRAINT ck_users_status
        CHECK (
            status IN (
                'INVITED',
                'ACTIVE',
                'LOCKED',
                'SUSPENDED',
                'DEACTIVATED'
            )
        ),

    CONSTRAINT ck_users_identity
        CHECK (
            email IS NOT NULL
            OR phone IS NOT NULL
        )
);

COMMENT ON TABLE app.users IS
'Shared login identity for students, parents, staff, administrators and platform users.';

COMMENT ON COLUMN app.users.password_hash IS
'Password hash only. Plain-text passwords must never be stored.';

-- ============================================================================
-- 3. ROLES
-- ============================================================================

CREATE TABLE platform.roles (
    role_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    role_code               varchar(100) NOT NULL,
    role_name               varchar(150) NOT NULL,

    scope                   varchar(20) NOT NULL,

    is_system_role          boolean NOT NULL DEFAULT false,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_roles_role_code
        UNIQUE (role_code),

    CONSTRAINT ck_roles_scope
        CHECK (
            scope IN (
                'PLATFORM',
                'COLLEGE'
            )
        )
);

COMMENT ON TABLE platform.roles IS
'System role catalog used for platform and college authorization.';

-- ============================================================================
-- 4. USER ROLES
-- ============================================================================
-- College is NULL for PLATFORM roles.
-- College is mandatory for COLLEGE roles.
-- ============================================================================

CREATE TABLE platform.user_roles (
    user_role_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id                 uuid NOT NULL,
    role_id                 uuid NOT NULL,

    college_id              uuid,

    status                  varchar(30) NOT NULL DEFAULT 'ACTIVE',

    assigned_by             uuid,

    expires_at              timestamptz,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_roles_user
        FOREIGN KEY (user_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_user_roles_role
        FOREIGN KEY (role_id)
        REFERENCES platform.roles(role_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_user_roles_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_user_roles_assigned_by
        FOREIGN KEY (assigned_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_user_roles_status
        CHECK (
            status IN (
                'ACTIVE',
                'SUSPENDED',
                'REVOKED',
                'EXPIRED'
            )
        )
);

COMMENT ON TABLE platform.user_roles IS
'Associates users with roles and, for college roles, a specific college tenant.';

-- ============================================================================
-- 5. MODULES
-- ============================================================================
-- Hierarchical catalog:
-- APP -> MODULE -> FEATURE
-- ============================================================================

CREATE TABLE platform.modules (
    module_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    module_code             varchar(150) NOT NULL,
    module_name             varchar(200) NOT NULL,

    parent_id               uuid,

    kind                    varchar(20) NOT NULL,

    priority                varchar(20) NOT NULL DEFAULT 'M',

    is_core                 boolean NOT NULL DEFAULT false,

    is_active               boolean NOT NULL DEFAULT true,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_modules_module_code
        UNIQUE (module_code),

    CONSTRAINT fk_modules_parent
        FOREIGN KEY (parent_id)
        REFERENCES platform.modules(module_id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_modules_kind
        CHECK (
            kind IN (
                'APP',
                'MODULE',
                'FEATURE'
            )
        ),

    CONSTRAINT ck_modules_priority
        CHECK (
            priority IN (
                'M',
                'S',
                'R'
            )
        )
);

COMMENT ON TABLE platform.modules IS
'Hierarchical catalog of HMS applications, modules and features.';

-- ============================================================================
-- 6. PERMISSIONS
-- ============================================================================

CREATE TABLE platform.permissions (
    permission_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    module_id               uuid NOT NULL,

    permission_code         varchar(150) NOT NULL,

    scope_type              varchar(30) NOT NULL DEFAULT 'COLLEGE',

    description             text,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_permissions_code
        UNIQUE (permission_code),

    CONSTRAINT fk_permissions_module
        FOREIGN KEY (module_id)
        REFERENCES platform.modules(module_id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_permissions_scope_type
        CHECK (
            scope_type IN (
                'PLATFORM',
                'COLLEGE',
                'GLOBAL'
            )
        )
);

COMMENT ON TABLE platform.permissions IS
'Atomic authorization permissions associated with modules/features.';

-- ============================================================================
-- 7. ROLE PERMISSIONS
-- ============================================================================

CREATE TABLE platform.role_permissions (
    role_id                 uuid NOT NULL,
    permission_id           uuid NOT NULL,

    created_at              timestamptz NOT NULL DEFAULT now(),

    PRIMARY KEY (
        role_id,
        permission_id
    ),

    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id)
        REFERENCES platform.roles(role_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id)
        REFERENCES platform.permissions(permission_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE platform.role_permissions IS
'Associates roles with the permissions they are allowed to perform.';

-- ============================================================================
-- 8. COLLEGE MODULES
-- ============================================================================
-- Controls which modules/features are enabled for a college.
-- ============================================================================

CREATE TABLE platform.college_modules (
    college_module_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    college_id              uuid NOT NULL,
    module_id               uuid NOT NULL,

    status                  varchar(30) NOT NULL DEFAULT 'ACTIVE',

    mode                    varchar(20) NOT NULL DEFAULT 'FULL',

    effective_from         timestamptz NOT NULL DEFAULT now(),
    effective_to           timestamptz,

    reason                  text,

    changed_by              uuid,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_college_modules_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_college_modules_module
        FOREIGN KEY (module_id)
        REFERENCES platform.modules(module_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_college_modules_changed_by
        FOREIGN KEY (changed_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_college_modules
        UNIQUE (
            college_id,
            module_id
        ),

    CONSTRAINT ck_college_modules_status
        CHECK (
            status IN (
                'ACTIVE',
                'DISABLED',
                'SCHEDULED'
            )
        ),

    CONSTRAINT ck_college_modules_mode
        CHECK (
            mode IN (
                'FULL',
                'READ_ONLY'
            )
        ),

    CONSTRAINT ck_college_modules_dates
        CHECK (
            effective_to IS NULL
            OR effective_to > effective_from
        )
);

COMMENT ON TABLE platform.college_modules IS
'Per-college module enablement and operating mode.';

-- ============================================================================
-- 9. ENTITLEMENT TEMPLATES
-- ============================================================================
-- Preset plans such as Full, Standard, No Visitors, etc.
-- ============================================================================

CREATE TABLE platform.entitlement_templates (
    template_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    template_code           varchar(100) NOT NULL,
    name                    varchar(150) NOT NULL,

    description             text,

    is_active               boolean NOT NULL DEFAULT true,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT uq_entitlement_templates_code
        UNIQUE (template_code)
);

COMMENT ON TABLE platform.entitlement_templates IS
'Preset entitlement plans used during tenant onboarding and configuration.';

-- ============================================================================
-- 10. COLLEGE SETTINGS
-- ============================================================================

CREATE TABLE platform.college_settings (
    college_setting_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    college_id              uuid NOT NULL,

    setting_key             varchar(150) NOT NULL,
    setting_value           jsonb NOT NULL,

    is_sensitive            boolean NOT NULL DEFAULT false,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_college_settings_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_college_settings_key
        UNIQUE (
            college_id,
            setting_key
        )
);

COMMENT ON TABLE platform.college_settings IS
'Per-college configurable settings such as curfew and attendance policies.';

-- ============================================================================
-- 11. COLLEGE ONBOARDING
-- ============================================================================

CREATE TABLE platform.college_onboarding (
    onboarding_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    college_id              uuid NOT NULL,

    step_code               varchar(100) NOT NULL,

    status                  varchar(30) NOT NULL DEFAULT 'PENDING',

    completed_by            uuid,

    completed_at            timestamptz,

    notes                   text,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_college_onboarding_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_college_onboarding_completed_by
        FOREIGN KEY (completed_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_college_onboarding_step
        UNIQUE (
            college_id,
            step_code
        ),

    CONSTRAINT ck_college_onboarding_status
        CHECK (
            status IN (
                'PENDING',
                'IN_PROGRESS',
                'COMPLETED',
                'SKIPPED',
                'FAILED'
            )
        )
);

COMMENT ON TABLE platform.college_onboarding IS
'Go-live/onboarding checklist for each college tenant.';

-- ============================================================================
-- 12. APPROVAL REQUESTS
-- ============================================================================

CREATE TABLE platform.approval_requests (
    request_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    operation_type          varchar(150) NOT NULL,

    college_id              uuid,

    payload                 jsonb NOT NULL DEFAULT '{}'::jsonb,

    requested_by            uuid NOT NULL,

    status                  varchar(30) NOT NULL DEFAULT 'PENDING',

    expires_at              timestamptz,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_approval_requests_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_approval_requests_requested_by
        FOREIGN KEY (requested_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_approval_requests_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'CANCELLED',
                'EXPIRED',
                'EXECUTED'
            )
        )
);

COMMENT ON TABLE platform.approval_requests IS
'Maker-checker approval requests for sensitive platform operations.';

-- ============================================================================
-- 13. APPROVAL STEPS
-- ============================================================================

CREATE TABLE platform.approval_steps (
    approval_step_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    request_id              uuid NOT NULL,

    step_order              integer NOT NULL,

    approver_id             uuid,

    decision                varchar(30) NOT NULL DEFAULT 'PENDING',

    comment                 text,

    decided_at              timestamptz,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_approval_steps_request
        FOREIGN KEY (request_id)
        REFERENCES platform.approval_requests(request_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_approval_steps_approver
        FOREIGN KEY (approver_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_approval_steps_order
        UNIQUE (
            request_id,
            step_order
        ),

    CONSTRAINT ck_approval_steps_order
        CHECK (
            step_order > 0
        ),

    CONSTRAINT ck_approval_steps_decision
        CHECK (
            decision IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'SKIPPED'
            )
        )
);

COMMENT ON TABLE platform.approval_steps IS
'Individual approval decisions within a maker-checker request.';

-- ============================================================================
-- 14. AUDIT LOGS
-- ============================================================================
-- One centralized audit trail.
-- old_data/new_data are JSONB snapshots.
-- ============================================================================

CREATE TABLE platform.audit_logs (
    audit_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    college_id              uuid,

    actor_user_id           uuid,

    actor_role              varchar(100),

    module                  varchar(150) NOT NULL,

    action                  varchar(100) NOT NULL,

    entity_type             varchar(150),

    entity_id               uuid,

    old_data                jsonb,

    new_data                jsonb,

    reason                  text,

    ip_address              inet,

    user_agent              text,

    created_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_audit_logs_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_audit_logs_actor
        FOREIGN KEY (actor_user_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE platform.audit_logs IS
'Central immutable-style audit trail for platform and tenant operations.';

-- ============================================================================
-- 15. LOGIN EVENTS
-- ============================================================================

CREATE TABLE platform.login_events (
    login_event_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id                 uuid,

    college_id              uuid,

    result                  varchar(30) NOT NULL,

    ip_address              inet,

    device                  varchar(255),

    user_agent              text,

    event_at                timestamptz NOT NULL DEFAULT now(),

    created_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_login_events_user
        FOREIGN KEY (user_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_login_events_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_login_events_result
        CHECK (
            result IN (
                'SUCCESS',
                'FAILED',
                'LOCKED',
                'BLOCKED',
                'LOGOUT',
                'MFA_FAILED'
            )
        )
);

COMMENT ON TABLE platform.login_events IS
'Authentication history, failures and lockout/security events.';

-- ============================================================================
-- 16. SUPPORT ACCESS GRANTS
-- ============================================================================
-- Time-limited, scoped, read-only support access.
-- ============================================================================

CREATE TABLE platform.support_access_grants (
    grant_id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    grantee_id              uuid NOT NULL,

    college_id              uuid NOT NULL,

    scope                   jsonb NOT NULL DEFAULT '{}'::jsonb,

    reason                  text NOT NULL,

    ticket_ref              varchar(150) NOT NULL,

    approved_by             uuid NOT NULL,

    starts_at               timestamptz NOT NULL DEFAULT now(),

    expires_at              timestamptz NOT NULL,

    revoked_at              timestamptz,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_support_access_grants_grantee
        FOREIGN KEY (grantee_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_support_access_grants_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_support_access_grants_approved_by
        FOREIGN KEY (approved_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_support_access_grants_expiry
        CHECK (
            expires_at > starts_at
        ),

    CONSTRAINT ck_support_access_grants_revoked
        CHECK (
            revoked_at IS NULL
            OR revoked_at >= starts_at
        )
);

COMMENT ON TABLE platform.support_access_grants IS
'Time-boxed, scoped, read-only support access grants.';

-- ============================================================================
-- 17. DEVICE TOKENS
-- ============================================================================
-- Push notification device registrations.
-- ============================================================================

CREATE TABLE platform.device_tokens (
    device_token_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id                 uuid NOT NULL,

    token                   text NOT NULL,

    platform                varchar(30) NOT NULL,

    device_id               varchar(255),

    is_active               boolean NOT NULL DEFAULT true,

    last_seen_at            timestamptz,

    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_device_tokens_user
        FOREIGN KEY (user_id)
        REFERENCES app.users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_device_tokens_token
        UNIQUE (token),

    CONSTRAINT ck_device_tokens_platform
        CHECK (
            platform IN (
                'ANDROID',
                'IOS',
                'WEB',
                'OTHER'
            )
        )
);

COMMENT ON TABLE platform.device_tokens IS
'Registered push-notification device tokens for HMS users.';


-- ============================================================================
-- ADDITIONAL BUSINESS CONSTRAINTS
-- ============================================================================

-- A COLLEGE role must have a college.
-- A PLATFORM role must not have a college.

CREATE OR REPLACE FUNCTION platform.validate_user_role_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_scope varchar(20);
BEGIN
    SELECT scope
    INTO v_scope
    FROM platform.roles
    WHERE role_id = NEW.role_id;

    IF v_scope = 'COLLEGE' AND NEW.college_id IS NULL THEN
        RAISE EXCEPTION
            'COLLEGE role assignment requires college_id';
    END IF;

    IF v_scope = 'PLATFORM' AND NEW.college_id IS NOT NULL THEN
        RAISE EXCEPTION
            'PLATFORM role assignment must not have college_id';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_roles_validate_scope
BEFORE INSERT OR UPDATE ON platform.user_roles
FOR EACH ROW
EXECUTE FUNCTION platform.validate_user_role_scope();


-- ============================================================================
-- MODULE HIERARCHY VALIDATION
-- ============================================================================

CREATE OR REPLACE FUNCTION platform.validate_module_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_parent_kind varchar(20);
BEGIN
    IF NEW.parent_id IS NULL THEN
        IF NEW.kind <> 'APP' THEN
            RAISE EXCEPTION
                'Root module must have kind APP';
        END IF;

        RETURN NEW;
    END IF;

    SELECT kind
    INTO v_parent_kind
    FROM platform.modules
    WHERE module_id = NEW.parent_id;

    IF NEW.kind = 'MODULE'
       AND v_parent_kind <> 'APP' THEN
        RAISE EXCEPTION
            'MODULE parent must be APP';
    END IF;

    IF NEW.kind = 'FEATURE'
       AND v_parent_kind <> 'MODULE' THEN
        RAISE EXCEPTION
            'FEATURE parent must be MODULE';
    END IF;

    IF NEW.kind = 'APP' THEN
        RAISE EXCEPTION
            'APP cannot have a parent';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_modules_validate_hierarchy
BEFORE INSERT OR UPDATE ON platform.modules
FOR EACH ROW
EXECUTE FUNCTION platform.validate_module_hierarchy();


-- ============================================================================
-- FINAL COMMENTS
-- ============================================================================

COMMENT ON SCHEMA platform IS
'Platform-owned HMS objects, tenant registry and platform authorization data.';

COMMENT ON SCHEMA app IS
'Shared HMS application identity and tenant operational objects.';

COMMIT;