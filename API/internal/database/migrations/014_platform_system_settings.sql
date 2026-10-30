-- ============================================================
-- 014_platform_system_settings.sql
-- Module 13: Company-wide Platform System Configuration & Defaults Store
-- Provides dedicated platform global settings, audit history, and diff rollback.
-- ============================================================

CREATE TABLE IF NOT EXISTS platform.system_settings (
    setting_key         varchar(150) PRIMARY KEY,
    category            varchar(50) NOT NULL DEFAULT 'general',
    display_name        varchar(200) NOT NULL,
    description         text,
    data_type           varchar(50) NOT NULL DEFAULT 'object',
    setting_value       jsonb NOT NULL,
    default_value       jsonb NOT NULL,
    min_value           jsonb, -- Enforced minimum security constraints (floors)
    is_sensitive        boolean NOT NULL DEFAULT false,
    requires_approval   boolean NOT NULL DEFAULT false,
    allow_override      boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    updated_by          uuid REFERENCES app.users(user_id) ON DELETE SET NULL
);

COMMENT ON TABLE platform.system_settings IS
'Authoritative company-wide global platform settings, defaults, security minimums, and maintenance flags.';

CREATE TABLE IF NOT EXISTS platform.system_settings_history (
    history_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key         varchar(150) NOT NULL REFERENCES platform.system_settings(setting_key) ON DELETE CASCADE,
    old_value           jsonb,
    new_value           jsonb NOT NULL,
    action              varchar(50) NOT NULL, -- UPDATE, REVERT, RESET
    reason              text NOT NULL,
    actor_user_id       uuid REFERENCES app.users(user_id) ON DELETE SET NULL,
    actor_role          varchar(50) NOT NULL DEFAULT 'SUPER_ADMIN',
    created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform.system_settings_history IS
'Full audit log and version trail for global system settings changes, enabling diff inspection and rollback.';

CREATE INDEX IF NOT EXISTS idx_system_settings_category ON platform.system_settings(category);
CREATE INDEX IF NOT EXISTS idx_system_settings_history_key ON platform.system_settings_history(setting_key, created_at DESC);

-- Seed core global configurations
INSERT INTO platform.system_settings (
    setting_key, category, display_name, description, data_type, setting_value, default_value, min_value, is_sensitive, requires_approval, allow_override
) VALUES
(
    'password_policy',
    'security',
    'Platform Password Security Policy',
    'Mandatory company-wide password complexity and lifetime rules. Tenant college policies cannot weaken these minimum floors.',
    'object',
    '{"min_length": 8, "require_uppercase": true, "require_lowercase": true, "require_number": true, "require_special_char": true, "max_age_days": 90, "prevent_reuse_count": 3}'::jsonb,
    '{"min_length": 8, "require_uppercase": true, "require_lowercase": true, "require_number": true, "require_special_char": true, "max_age_days": 90, "prevent_reuse_count": 3}'::jsonb,
    '{"min_length": 8, "max_age_days": 90}'::jsonb,
    false,
    true,
    true
),
(
    'session_policy',
    'security',
    'User Session Lifetime & Limits',
    'Global user session timeouts and maximum concurrent active sessions across devices.',
    'object',
    '{"idle_timeout_minutes": 30, "absolute_timeout_hours": 24, "max_concurrent_sessions": 2}'::jsonb,
    '{"idle_timeout_minutes": 30, "absolute_timeout_hours": 24, "max_concurrent_sessions": 2}'::jsonb,
    '{"idle_timeout_minutes": 30, "absolute_timeout_hours": 24, "max_concurrent_sessions": 5}'::jsonb,
    false,
    true,
    true
),
(
    'login_lockout_policy',
    'security',
    'Login Lockout & Brute-Force Thresholds',
    'Platform thresholds for automatic account lockout following successive failed authentication attempts.',
    'object',
    '{"max_failed_attempts": 5, "lockout_duration_minutes": 15, "reset_counter_minutes": 30, "notify_admin_on_lockout": true}'::jsonb,
    '{"max_failed_attempts": 5, "lockout_duration_minutes": 15, "reset_counter_minutes": 30, "notify_admin_on_lockout": true}'::jsonb,
    '{"max_failed_attempts": 10, "lockout_duration_minutes": 5}'::jsonb,
    false,
    true,
    true
),
(
    'mfa_policy',
    'security',
    'Multi-Factor Authentication (MFA) Policy',
    'Company-wide MFA enforcement rules for administrators and elevated roles.',
    'object',
    '{"enforce_for_super_admins": true, "enforce_for_college_admins": true, "enforce_for_staff": false, "allowed_methods": ["TOTP", "EMAIL_OTP"]}'::jsonb,
    '{"enforce_for_super_admins": true, "enforce_for_college_admins": true, "enforce_for_staff": false, "allowed_methods": ["TOTP", "EMAIL_OTP"]}'::jsonb,
    '{"enforce_for_super_admins": true}'::jsonb,
    false,
    true,
    true
),
(
    'maintenance_mode',
    'system',
    'Global Platform Maintenance Mode',
    'Killswitch to place the platform into maintenance mode with a banner message and estimated completion timestamp.',
    'object',
    '{"enabled": false, "banner_message": "", "scheduled_end_time": null, "allow_super_admins": true}'::jsonb,
    '{"enabled": false, "banner_message": "", "scheduled_end_time": null, "allow_super_admins": true}'::jsonb,
    null,
    false,
    true,
    false
),
(
    'notification_providers',
    'system',
    'Outbound Notification Providers Configuration',
    'Platform-level integration defaults for transactional email, SMS gateways, and Telegram bots.',
    'object',
    '{"email_provider": "SES", "sms_provider": "AWS_SNS", "telegram_enabled": true, "rate_limit_per_minute": 100}'::jsonb,
    '{"email_provider": "SES", "sms_provider": "AWS_SNS", "telegram_enabled": true, "rate_limit_per_minute": 100}'::jsonb,
    null,
    true,
    false,
    true
),
(
    'global_feature_flags',
    'system',
    'Company-Wide Feature Flags',
    'Global feature switches and beta capabilities activated across all tenants.',
    'object',
    '{"enable_biometric_gate_sync": true, "enable_ai_room_allocation": false, "enable_parent_portal": true, "enable_whatsapp_alerts": true}'::jsonb,
    '{"enable_biometric_gate_sync": true, "enable_ai_room_allocation": false, "enable_parent_portal": true, "enable_whatsapp_alerts": true}'::jsonb,
    null,
    false,
    false,
    true
)
ON CONFLICT (setting_key) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    data_type = EXCLUDED.data_type,
    category = EXCLUDED.category,
    is_sensitive = EXCLUDED.is_sensitive,
    requires_approval = EXCLUDED.requires_approval,
    allow_override = EXCLUDED.allow_override;
