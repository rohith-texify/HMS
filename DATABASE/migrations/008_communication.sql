-- ============================================================
-- HMS DATABASE
-- Migration: 008_communication.sql
-- Module: Communication / Notifications / Announcements
--
-- Creates:
--   1. notifications
--   2. notification_recipients
--   3. announcements
--   4. platform_notifications
--
-- Design:
--   - College-scoped notifications use college_id
--   - Platform notifications are global
--   - Delivery history is retained
--   - Notification recipients are separated from notifications
--   - Announcement targeting is data-driven through JSONB
--   - UTC timestamps
--   - Tenant consistency enforced with triggers
-- ============================================================

BEGIN;

-- ============================================================
-- 1. NOTIFICATIONS
-- ============================================================

CREATE TABLE app.notifications (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid,

    notification_type varchar(40) NOT NULL
        CHECK (
            notification_type IN (
                'SYSTEM',
                'ANNOUNCEMENT',
                'LEAVE',
                'GATE_PASS',
                'VISITOR',
                'PARCEL',
                'COMPLAINT',
                'SOS',
                'SECURITY',
                'MEAL',
                'GENERAL'
            )
        ),

    title varchar(255) NOT NULL,

    message text NOT NULL,

    priority varchar(20) NOT NULL DEFAULT 'NORMAL'
        CHECK (
            priority IN (
                'LOW',
                'NORMAL',
                'HIGH',
                'URGENT'
            )
        ),

    channel varchar(30) NOT NULL DEFAULT 'IN_APP'
        CHECK (
            channel IN (
                'IN_APP',
                'PUSH',
                'EMAIL',
                'SMS',
                'MULTI_CHANNEL'
            )
        ),

    status varchar(30) NOT NULL DEFAULT 'QUEUED'
        CHECK (
            status IN (
                'QUEUED',
                'SCHEDULED',
                'SENDING',
                'SENT',
                'PARTIALLY_DELIVERED',
                'FAILED',
                'CANCELLED',
                'EXPIRED'
            )
        ),

    source_module varchar(100),
    source_record_id uuid,

    scheduled_at timestamptz,
    sent_at timestamptz,
    expires_at timestamptz,

    created_by uuid,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_notifications_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_notifications_created_by
        FOREIGN KEY (created_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_notifications_expiry
        CHECK (
            expires_at IS NULL
            OR scheduled_at IS NULL
            OR expires_at >= scheduled_at
        )
);

-- ============================================================
-- 2. NOTIFICATION RECIPIENTS
-- ============================================================

CREATE TABLE app.notification_recipients (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    notification_id uuid NOT NULL,

    user_id uuid NOT NULL,

    recipient_address varchar(320),

    delivery_status varchar(25) NOT NULL DEFAULT 'PENDING'
        CHECK (
            delivery_status IN (
                'PENDING',
                'QUEUED',
                'SENT',
                'DELIVERED',
                'READ',
                'FAILED',
                'CANCELLED'
            )
        ),

    queued_at timestamptz,
    sent_at timestamptz,
    delivered_at timestamptz,
    read_at timestamptz,
    failed_at timestamptz,

    failure_reason text,

    device_token text,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_notification_recipients_notification
        FOREIGN KEY (notification_id)
        REFERENCES app.notifications(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_notification_recipients_user
        FOREIGN KEY (user_id)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_notification_recipient
        UNIQUE (notification_id, user_id)
);

-- ============================================================
-- 3. ANNOUNCEMENTS
-- ============================================================

CREATE TABLE app.announcements (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    college_id uuid NOT NULL,

    title varchar(255) NOT NULL,

    content text NOT NULL,

    category varchar(30) NOT NULL DEFAULT 'GENERAL'
        CHECK (
            category IN (
                'GENERAL',
                'HOSTEL',
                'ACADEMIC',
                'SECURITY',
                'FOOD',
                'MAINTENANCE',
                'EVENT',
                'EMERGENCY',
                'OTHER'
            )
        ),

    priority varchar(20) NOT NULL DEFAULT 'NORMAL'
        CHECK (
            priority IN (
                'LOW',
                'NORMAL',
                'HIGH',
                'URGENT'
            )
        ),

    status varchar(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'SCHEDULED',
                'PUBLISHED',
                'EXPIRED',
                'CANCELLED'
            )
        ),

    target_type varchar(30) NOT NULL DEFAULT 'ALL'
        CHECK (
            target_type IN (
                'ALL',
                'STUDENTS',
                'PARENTS',
                'STAFF',
                'HOSTEL',
                'ROLE',
                'CUSTOM'
            )
        ),

    target_value jsonb,

    publish_at timestamptz,
    expires_at timestamptz,

    published_by uuid,
    published_at timestamptz,

    created_by uuid NOT NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_announcements_college
        FOREIGN KEY (college_id)
        REFERENCES platform.colleges(college_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_announcements_published_by
        FOREIGN KEY (published_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_announcements_created_by
        FOREIGN KEY (created_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_announcements_expiry
        CHECK (
            expires_at IS NULL
            OR publish_at IS NULL
            OR expires_at >= publish_at
        )
);

-- ============================================================
-- 4. PLATFORM NOTIFICATIONS
--
-- These are NOT college-owned.
-- They are generated by Super Admin / platform operations.
-- ============================================================

CREATE TABLE app.platform_notifications (
    id uuid PRIMARY KEY DEFAULT platform.generate_uuid(),

    notification_type varchar(40) NOT NULL
        CHECK (
            notification_type IN (
                'SYSTEM',
                'MAINTENANCE',
                'SECURITY',
                'BILLING',
                'FEATURE',
                'ANNOUNCEMENT',
                'GENERAL'
            )
        ),

    title varchar(255) NOT NULL,

    message text NOT NULL,

    priority varchar(20) NOT NULL DEFAULT 'NORMAL'
        CHECK (
            priority IN (
                'LOW',
                'NORMAL',
                'HIGH',
                'URGENT'
            )
        ),

    status varchar(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'SCHEDULED',
                'PUBLISHED',
                'EXPIRED',
                'CANCELLED'
            )
        ),

    target_type varchar(30) NOT NULL DEFAULT 'ALL_COLLEGES'
        CHECK (
            target_type IN (
                'ALL_COLLEGES',
                'SELECTED_COLLEGES',
                'PLATFORM_USERS',
                'CUSTOM'
            )
        ),

    target_value jsonb,

    publish_at timestamptz,
    expires_at timestamptz,

    created_by uuid NOT NULL,
    published_by uuid,

    published_at timestamptz,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fk_platform_notifications_created_by
        FOREIGN KEY (created_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_platform_notifications_published_by
        FOREIGN KEY (published_by)
        REFERENCES app.users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_platform_notifications_expiry
        CHECK (
            expires_at IS NULL
            OR publish_at IS NULL
            OR expires_at >= publish_at
        )
);

-- ============================================================
-- TENANT CONSISTENCY FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION app.validate_communication_tenant_consistency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    related_college_id uuid;
BEGIN

    -- --------------------------------------------------------
    -- NOTIFICATIONS
    -- --------------------------------------------------------

    IF TG_TABLE_NAME = 'notifications' THEN

        /*
         * college_id may be NULL for platform/global
         * notifications.
         */
        IF NEW.college_id IS NOT NULL THEN

            IF NOT EXISTS (
                SELECT 1
                FROM platform.colleges
                WHERE college_id = NEW.college_id
            ) THEN
                RAISE EXCEPTION
                    'Invalid college_id in notifications';
            END IF;

        END IF;

    -- --------------------------------------------------------
    -- NOTIFICATION RECIPIENTS
    -- --------------------------------------------------------

    ELSIF TG_TABLE_NAME = 'notification_recipients' THEN

        /*
         * Recipient belongs to the same college as the
         * notification when the notification is college-scoped.
         *
         * Global/platform notifications are allowed.
         */
        SELECT college_id
        INTO related_college_id
        FROM app.notifications
        WHERE id = NEW.notification_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'Notification % does not exist',
                NEW.notification_id;
        END IF;

        IF related_college_id IS NOT NULL THEN

            IF NOT EXISTS (
                SELECT 1
                FROM platform.user_roles ur
                WHERE ur.user_id = NEW.user_id
                  AND ur.college_id = related_college_id
                  AND ur.status = 'ACTIVE'
                  AND (ur.expires_at IS NULL OR ur.expires_at > now())
            ) THEN
                RAISE EXCEPTION
                    'Notification recipient % does not have active membership in college %',
                    NEW.user_id, related_college_id;
            END IF;

        ELSE

            IF NOT EXISTS (
                SELECT 1
                FROM app.users u
                WHERE u.user_id = NEW.user_id
                  AND u.status IN ('ACTIVE', 'INVITED')
            ) THEN
                RAISE EXCEPTION
                    'Notification recipient % is not an active user',
                    NEW.user_id;
            END IF;

        END IF;

    -- --------------------------------------------------------
    -- ANNOUNCEMENTS
    -- --------------------------------------------------------

    ELSIF TG_TABLE_NAME = 'announcements' THEN

        IF NOT EXISTS (
            SELECT 1
            FROM platform.colleges
            WHERE college_id = NEW.college_id
        ) THEN
            RAISE EXCEPTION
                'Invalid college_id in announcements';
        END IF;

    END IF;

    RETURN NEW;
END;
$$;

-- ============================================================
-- TENANT CONSISTENCY TRIGGERS
-- ============================================================

CREATE TRIGGER trg_validate_notifications_tenant
BEFORE INSERT OR UPDATE ON app.notifications
FOR EACH ROW
EXECUTE FUNCTION app.validate_communication_tenant_consistency();

CREATE TRIGGER trg_validate_notification_recipients_tenant
BEFORE INSERT OR UPDATE ON app.notification_recipients
FOR EACH ROW
EXECUTE FUNCTION app.validate_communication_tenant_consistency();

CREATE TRIGGER trg_validate_announcements_tenant
BEFORE INSERT OR UPDATE ON app.announcements
FOR EACH ROW
EXECUTE FUNCTION app.validate_communication_tenant_consistency();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_notifications_college_status
    ON app.notifications (college_id, status);

CREATE INDEX idx_notifications_type
    ON app.notifications (college_id, notification_type);

CREATE INDEX idx_notifications_scheduled
    ON app.notifications (scheduled_at)
    WHERE status = 'SCHEDULED';

CREATE INDEX idx_notifications_expires
    ON app.notifications (expires_at)
    WHERE expires_at IS NOT NULL;

CREATE INDEX idx_notifications_source
    ON app.notifications (source_module, source_record_id);

CREATE INDEX idx_notification_recipients_user
    ON app.notification_recipients (user_id, delivery_status);

CREATE INDEX idx_notification_recipients_status
    ON app.notification_recipients (notification_id, delivery_status);

CREATE INDEX idx_notification_recipients_unread
    ON app.notification_recipients (user_id, created_at DESC)
    WHERE delivery_status IN (
        'PENDING',
        'QUEUED',
        'SENT',
        'DELIVERED'
    );

CREATE INDEX idx_announcements_college_status
    ON app.announcements (college_id, status);

CREATE INDEX idx_announcements_publish
    ON app.announcements (college_id, publish_at)
    WHERE status = 'SCHEDULED';

CREATE INDEX idx_announcements_active
    ON app.announcements (college_id, publish_at DESC)
    WHERE status = 'PUBLISHED';

CREATE INDEX idx_platform_notifications_status
    ON app.platform_notifications (status);

CREATE INDEX idx_platform_notifications_publish
    ON app.platform_notifications (publish_at)
    WHERE status = 'SCHEDULED';

-- ============================================================
-- JSONB TARGETING INDEXES
-- ============================================================

CREATE INDEX idx_announcements_target_value
    ON app.announcements
    USING GIN (target_value);

CREATE INDEX idx_platform_notifications_target_value
    ON app.platform_notifications
    USING GIN (target_value);

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE app.notifications IS
'Application notifications generated by HMS modules.';

COMMENT ON TABLE app.notification_recipients IS
'Per-user notification delivery and read tracking.';

COMMENT ON TABLE app.announcements IS
'College announcements with configurable audience targeting.';

COMMENT ON TABLE app.platform_notifications IS
'Platform-level notifications generated by Super Admin operations.';

COMMENT ON COLUMN app.notifications.source_record_id IS
'UUID of the source business record that generated the notification.';

COMMENT ON COLUMN app.announcements.target_value IS
'JSONB targeting parameters such as hostel, role, or custom recipient criteria.';

COMMENT ON COLUMN app.platform_notifications.target_value IS
'JSONB platform targeting parameters such as selected colleges or custom users.';

COMMIT;