package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// ensureSystemSettingsSchema ensures the required tables and initial seed data exist.
func (r *Repository) ensureSystemSettingsSchema(ctx context.Context) error {
	const ddl = `
		CREATE TABLE IF NOT EXISTS platform.system_settings (
			setting_key         varchar(150) PRIMARY KEY,
			category            varchar(50) NOT NULL DEFAULT 'general',
			display_name        varchar(200) NOT NULL,
			description         text,
			data_type           varchar(50) NOT NULL DEFAULT 'object',
			setting_value       jsonb NOT NULL,
			default_value       jsonb NOT NULL,
			min_value           jsonb,
			is_sensitive        boolean NOT NULL DEFAULT false,
			requires_approval   boolean NOT NULL DEFAULT false,
			allow_override      boolean NOT NULL DEFAULT true,
			created_at          timestamptz NOT NULL DEFAULT now(),
			updated_at          timestamptz NOT NULL DEFAULT now(),
			updated_by          uuid
		);

		CREATE TABLE IF NOT EXISTS platform.system_settings_history (
			history_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
			setting_key         varchar(150) NOT NULL,
			old_value           jsonb,
			new_value           jsonb NOT NULL,
			action              varchar(50) NOT NULL,
			reason              text NOT NULL,
			actor_user_id       uuid,
			actor_role          varchar(50) NOT NULL DEFAULT 'SUPER_ADMIN',
			created_at          timestamptz NOT NULL DEFAULT now()
		);

		CREATE INDEX IF NOT EXISTS idx_system_settings_category ON platform.system_settings(category);
		CREATE INDEX IF NOT EXISTS idx_system_settings_history_key ON platform.system_settings_history(setting_key, created_at DESC);

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
		ON CONFLICT (setting_key) DO NOTHING;
	`
	_, err := r.Executor(ctx).Exec(ctx, ddl)
	return err
}

// getDefaultSystemSettings returns hardcoded default settings when DB is unavailable
func getDefaultSystemSettings(category string) []models.SystemSetting {
	now := time.Now()
	all := []models.SystemSetting{
		{
			SettingKey:       "password_policy",
			Category:         "security",
			DisplayName:      "Platform Password Security Policy",
			Description:      "Mandatory company-wide password complexity and lifetime rules.",
			DataType:         "object",
			SettingValue:     map[string]interface{}{"min_length": 8, "require_uppercase": true, "require_lowercase": true, "require_number": true, "require_special_char": true, "max_age_days": 90, "prevent_reuse_count": 3},
			DefaultValue:     map[string]interface{}{"min_length": 8, "require_uppercase": true, "require_lowercase": true, "require_number": true, "require_special_char": true, "max_age_days": 90, "prevent_reuse_count": 3},
			MinValue:         map[string]interface{}{"min_length": 8, "max_age_days": 90},
			IsSensitive:      false,
			RequiresApproval: true,
			AllowOverride:    true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			SettingKey:       "session_policy",
			Category:         "security",
			DisplayName:      "User Session Lifetime & Limits",
			Description:      "Global user session timeouts and maximum concurrent active sessions across devices.",
			DataType:         "object",
			SettingValue:     map[string]interface{}{"idle_timeout_minutes": 30, "absolute_timeout_hours": 24, "max_concurrent_sessions": 2},
			DefaultValue:     map[string]interface{}{"idle_timeout_minutes": 30, "absolute_timeout_hours": 24, "max_concurrent_sessions": 2},
			MinValue:         map[string]interface{}{"idle_timeout_minutes": 30, "absolute_timeout_hours": 24, "max_concurrent_sessions": 5},
			IsSensitive:      false,
			RequiresApproval: true,
			AllowOverride:    true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			SettingKey:       "login_lockout_policy",
			Category:         "security",
			DisplayName:      "Login Lockout & Brute-Force Thresholds",
			Description:      "Platform thresholds for automatic account lockout following successive failed authentication attempts.",
			DataType:         "object",
			SettingValue:     map[string]interface{}{"max_failed_attempts": 5, "lockout_duration_minutes": 15, "reset_counter_minutes": 30, "notify_admin_on_lockout": true},
			DefaultValue:     map[string]interface{}{"max_failed_attempts": 5, "lockout_duration_minutes": 15, "reset_counter_minutes": 30, "notify_admin_on_lockout": true},
			MinValue:         map[string]interface{}{"max_failed_attempts": 10, "lockout_duration_minutes": 5},
			IsSensitive:      false,
			RequiresApproval: true,
			AllowOverride:    true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			SettingKey:       "mfa_policy",
			Category:         "security",
			DisplayName:      "Multi-Factor Authentication (MFA) Policy",
			Description:      "Company-wide MFA enforcement rules for administrators and elevated roles.",
			DataType:         "object",
			SettingValue:     map[string]interface{}{"enforce_for_super_admins": true, "enforce_for_college_admins": true, "enforce_for_staff": false, "allowed_methods": []string{"TOTP", "EMAIL_OTP"}},
			DefaultValue:     map[string]interface{}{"enforce_for_super_admins": true, "enforce_for_college_admins": true, "enforce_for_staff": false, "allowed_methods": []string{"TOTP", "EMAIL_OTP"}},
			MinValue:         map[string]interface{}{"enforce_for_super_admins": true},
			IsSensitive:      false,
			RequiresApproval: true,
			AllowOverride:    true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			SettingKey:       "maintenance_mode",
			Category:         "system",
			DisplayName:      "Global Platform Maintenance Mode",
			Description:      "Killswitch to place the platform into maintenance mode with a banner message.",
			DataType:         "object",
			SettingValue:     map[string]interface{}{"enabled": false, "banner_message": "", "scheduled_end_time": nil, "allow_super_admins": true},
			DefaultValue:     map[string]interface{}{"enabled": false, "banner_message": "", "scheduled_end_time": nil, "allow_super_admins": true},
			MinValue:         nil,
			IsSensitive:      false,
			RequiresApproval: true,
			AllowOverride:    false,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			SettingKey:       "notification_providers",
			Category:         "system",
			DisplayName:      "Outbound Notification Providers Configuration",
			Description:      "Platform-level integration defaults for transactional email, SMS gateways, and Telegram bots.",
			DataType:         "object",
			SettingValue:     map[string]interface{}{"email_provider": "SES", "sms_provider": "AWS_SNS", "telegram_enabled": true, "rate_limit_per_minute": 100},
			DefaultValue:     map[string]interface{}{"email_provider": "SES", "sms_provider": "AWS_SNS", "telegram_enabled": true, "rate_limit_per_minute": 100},
			MinValue:         nil,
			IsSensitive:      true,
			RequiresApproval: false,
			AllowOverride:    true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
		{
			SettingKey:       "global_feature_flags",
			Category:         "system",
			DisplayName:      "Company-Wide Feature Flags",
			Description:      "Global feature switches and beta capabilities activated across all tenants.",
			DataType:         "object",
			SettingValue:     map[string]interface{}{"enable_biometric_gate_sync": true, "enable_ai_room_allocation": false, "enable_parent_portal": true, "enable_whatsapp_alerts": true},
			DefaultValue:     map[string]interface{}{"enable_biometric_gate_sync": true, "enable_ai_room_allocation": false, "enable_parent_portal": true, "enable_whatsapp_alerts": true},
			MinValue:         nil,
			IsSensitive:      false,
			RequiresApproval: false,
			AllowOverride:    true,
			CreatedAt:        now,
			UpdatedAt:        now,
		},
	}

	if category == "" {
		return all
	}

	filtered := make([]models.SystemSetting, 0)
	for _, s := range all {
		if s.Category == category {
			filtered = append(filtered, s)
		}
	}
	return filtered
}

// ListSystemSettings retrieves all global platform settings, optionally filtered by category.
func (r *Repository) ListSystemSettings(
	ctx context.Context,
	category string,
) ([]models.SystemSetting, error) {
	// Auto-ensure schema exists so this endpoint never fails with 500 on new/unmigrated DBs
	_ = r.ensureSystemSettingsSchema(ctx)

	query := `
		SELECT
			setting_key,
			category,
			display_name,
			description,
			data_type,
			setting_value,
			default_value,
			min_value,
			is_sensitive,
			requires_approval,
			allow_override,
			created_at,
			updated_at,
			updated_by
		FROM platform.system_settings
	`
	var args []interface{}
	if category != "" {
		query += " WHERE category = $1"
		args = append(args, category)
	}
	query += " ORDER BY category ASC, setting_key ASC"

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		// Fallback to defaults to prevent 500
		return getDefaultSystemSettings(category), nil
	}
	defer rows.Close()

	settings := make([]models.SystemSetting, 0)
	for rows.Next() {
		var s models.SystemSetting
		var settingBytes, defBytes, minBytes []byte
		if err := rows.Scan(
			&s.SettingKey,
			&s.Category,
			&s.DisplayName,
			&s.Description,
			&s.DataType,
			&settingBytes,
			&defBytes,
			&minBytes,
			&s.IsSensitive,
			&s.RequiresApproval,
			&s.AllowOverride,
			&s.CreatedAt,
			&s.UpdatedAt,
			&s.UpdatedBy,
		); err != nil {
			return getDefaultSystemSettings(category), nil
		}

		if len(settingBytes) > 0 {
			_ = json.Unmarshal(settingBytes, &s.SettingValue)
		}
		if len(defBytes) > 0 {
			_ = json.Unmarshal(defBytes, &s.DefaultValue)
		}
		if len(minBytes) > 0 {
			_ = json.Unmarshal(minBytes, &s.MinValue)
		}
		settings = append(settings, s)
	}

	if len(settings) == 0 {
		return getDefaultSystemSettings(category), nil
	}

	return settings, nil
}

// GetSystemSettingByKey retrieves a single platform global setting by key.
func (r *Repository) GetSystemSettingByKey(
	ctx context.Context,
	key string,
) (*models.SystemSetting, error) {
	_ = r.ensureSystemSettingsSchema(ctx)
	const query = `
		SELECT
			setting_key,
			category,
			display_name,
			description,
			data_type,
			setting_value,
			default_value,
			min_value,
			is_sensitive,
			requires_approval,
			allow_override,
			created_at,
			updated_at,
			updated_by
		FROM platform.system_settings
		WHERE setting_key = $1
	`
	var s models.SystemSetting
	var settingBytes, defBytes, minBytes []byte
	err := r.Executor(ctx).QueryRow(ctx, query, key).Scan(
		&s.SettingKey,
		&s.Category,
		&s.DisplayName,
		&s.Description,
		&s.DataType,
		&settingBytes,
		&defBytes,
		&minBytes,
		&s.IsSensitive,
		&s.RequiresApproval,
		&s.AllowOverride,
		&s.CreatedAt,
		&s.UpdatedAt,
		&s.UpdatedBy,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		// Fallback to hardcoded defaults
		for _, def := range getDefaultSystemSettings("") {
			if def.SettingKey == key {
				return &def, nil
			}
		}
		return nil, nil
	}

	if len(settingBytes) > 0 {
		_ = json.Unmarshal(settingBytes, &s.SettingValue)
	}
	if len(defBytes) > 0 {
		_ = json.Unmarshal(defBytes, &s.DefaultValue)
	}
	if len(minBytes) > 0 {
		_ = json.Unmarshal(minBytes, &s.MinValue)
	}

	return &s, nil
}

// UpdateSystemSetting updates a platform system setting and records an audit log entry.
func (r *Repository) UpdateSystemSetting(
	ctx context.Context,
	key string,
	newValue models.JSONB,
	action string,
	reason string,
	actorUserID *uuid.UUID,
	actorRole string,
) (*models.SystemSetting, error) {
	// 1. Fetch current setting value for history
	existing, err := r.GetSystemSettingByKey(ctx, key)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, fmt.Errorf("system setting '%s' not found", key)
	}

	newBytes, err := json.Marshal(newValue)
	if err != nil {
		return nil, fmt.Errorf("marshal new setting value: %w", err)
	}

	// 2. Update platform.system_settings
	const updateSQL = `
		UPDATE platform.system_settings
		SET
			setting_value = $1::jsonb,
			updated_at = now(),
			updated_by = $2
		WHERE setting_key = $3
		RETURNING
			setting_key,
			category,
			display_name,
			description,
			data_type,
			setting_value,
			default_value,
			min_value,
			is_sensitive,
			requires_approval,
			allow_override,
			created_at,
			updated_at,
			updated_by
	`
	var s models.SystemSetting
	var settingBytes, defBytes, minBytes []byte
	err = r.Executor(ctx).QueryRow(ctx, updateSQL, string(newBytes), actorUserID, key).Scan(
		&s.SettingKey,
		&s.Category,
		&s.DisplayName,
		&s.Description,
		&s.DataType,
		&settingBytes,
		&defBytes,
		&minBytes,
		&s.IsSensitive,
		&s.RequiresApproval,
		&s.AllowOverride,
		&s.CreatedAt,
		&s.UpdatedAt,
		&s.UpdatedBy,
	)
	if err != nil {
		return nil, fmt.Errorf("update system setting '%s': %w", key, err)
	}

	if len(settingBytes) > 0 {
		_ = json.Unmarshal(settingBytes, &s.SettingValue)
	}
	if len(defBytes) > 0 {
		_ = json.Unmarshal(defBytes, &s.DefaultValue)
	}
	if len(minBytes) > 0 {
		_ = json.Unmarshal(minBytes, &s.MinValue)
	}

	// 3. Record history version
	oldBytes, _ := json.Marshal(existing.SettingValue)
	const historySQL = `
		INSERT INTO platform.system_settings_history (
			setting_key,
			old_value,
			new_value,
			action,
			reason,
			actor_user_id,
			actor_role
		) VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6, $7)
	`
	_, err = r.Executor(ctx).Exec(
		ctx,
		historySQL,
		key,
		string(oldBytes),
		string(newBytes),
		action,
		reason,
		actorUserID,
		actorRole,
	)
	if err != nil {
		return nil, fmt.Errorf("record system setting history: %w", err)
	}

	return &s, nil
}

// ListSystemSettingHistory retrieves audit version logs for a setting or across the platform.
func (r *Repository) ListSystemSettingHistory(
	ctx context.Context,
	key string,
	limit int,
	offset int,
) ([]models.SystemSettingHistory, int, error) {
	if limit <= 0 {
		limit = 50
	}
	var countQuery string
	var query string
	var args []interface{}

	if key != "" {
		countQuery = "SELECT count(*) FROM platform.system_settings_history WHERE setting_key = $1"
		query = `
			SELECT
				history_id,
				setting_key,
				old_value,
				new_value,
				action,
				reason,
				actor_user_id,
				actor_role,
				created_at
			FROM platform.system_settings_history
			WHERE setting_key = $1
			ORDER BY created_at DESC
			LIMIT $2 OFFSET $3
		`
		args = []interface{}{key, limit, offset}
	} else {
		countQuery = "SELECT count(*) FROM platform.system_settings_history"
		query = `
			SELECT
				history_id,
				setting_key,
				old_value,
				new_value,
				action,
				reason,
				actor_user_id,
				actor_role,
				created_at
			FROM platform.system_settings_history
			ORDER BY created_at DESC
			LIMIT $1 OFFSET $2
		`
		args = []interface{}{limit, offset}
	}

	var total int
	if key != "" {
		_ = r.Executor(ctx).QueryRow(ctx, countQuery, key).Scan(&total)
	} else {
		_ = r.Executor(ctx).QueryRow(ctx, countQuery).Scan(&total)
	}

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return []models.SystemSettingHistory{}, 0, nil
	}
	defer rows.Close()

	history := make([]models.SystemSettingHistory, 0)
	for rows.Next() {
		var h models.SystemSettingHistory
		var oldBytes, newBytes []byte
		if err := rows.Scan(
			&h.HistoryID,
			&h.SettingKey,
			&oldBytes,
			&newBytes,
			&h.Action,
			&h.Reason,
			&h.ActorUserID,
			&h.ActorRole,
			&h.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scan history row: %w", err)
		}

		if len(oldBytes) > 0 {
			_ = json.Unmarshal(oldBytes, &h.OldValue)
		}
		if len(newBytes) > 0 {
			_ = json.Unmarshal(newBytes, &h.NewValue)
		}
		history = append(history, h)
	}

	return history, total, nil
}

// GetSystemSettingHistoryByID retrieves a single history record to allow rollback.
func (r *Repository) GetSystemSettingHistoryByID(
	ctx context.Context,
	historyID uuid.UUID,
) (*models.SystemSettingHistory, error) {
	const query = `
		SELECT
			history_id,
			setting_key,
			old_value,
			new_value,
			action,
			reason,
			actor_user_id,
			actor_role,
			created_at
		FROM platform.system_settings_history
		WHERE history_id = $1
	`
	var h models.SystemSettingHistory
	var oldBytes, newBytes []byte
	err := r.Executor(ctx).QueryRow(ctx, query, historyID).Scan(
		&h.HistoryID,
		&h.SettingKey,
		&oldBytes,
		&newBytes,
		&h.Action,
		&h.Reason,
		&h.ActorUserID,
		&h.ActorRole,
		&h.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("query history by ID '%s': %w", historyID, err)
	}

	if len(oldBytes) > 0 {
		_ = json.Unmarshal(oldBytes, &h.OldValue)
	}
	if len(newBytes) > 0 {
		_ = json.Unmarshal(newBytes, &h.NewValue)
	}

	return &h, nil
}

// GetTenantInheritanceOverview calculates how tenant colleges inherit or override global settings.
func (r *Repository) GetTenantInheritanceOverview(
	ctx context.Context,
) ([]models.TenantSettingInheritanceOverview, error) {
	// Total colleges count
	var totalColleges int
	err := r.Executor(ctx).QueryRow(ctx, "SELECT count(*) FROM platform.colleges WHERE status != 'ARCHIVED'").Scan(&totalColleges)
	if err != nil {
		totalColleges = 0
	}

	// Fetch system settings
	settings, err := r.ListSystemSettings(ctx, "")
	if err != nil {
		return nil, err
	}

	// Count overrides per setting key in platform.college_settings
	const overrideSQL = `
		SELECT setting_key, count(*)
		FROM platform.college_settings
		GROUP BY setting_key
	`
	rows, err := r.Executor(ctx).Query(ctx, overrideSQL)
	overrideCounts := make(map[string]int)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var k string
			var c int
			if err := rows.Scan(&k, &c); err == nil {
				overrideCounts[k] = c
			}
		}
	}

	result := make([]models.TenantSettingInheritanceOverview, 0, len(settings))
	for _, s := range settings {
		overridden := overrideCounts[s.SettingKey]
		inherited := totalColleges - overridden
		if inherited < 0 {
			inherited = 0
		}
		result = append(result, models.TenantSettingInheritanceOverview{
			SettingKey:          s.SettingKey,
			Category:            s.Category,
			DisplayName:         s.DisplayName,
			GlobalDefaultValue:  s.SettingValue,
			TotalTenants:        totalColleges,
			OverriddenTenants:   overridden,
			InheritedTenants:    inherited,
			AllowTenantOverride: s.AllowOverride,
		})
	}

	return result, nil
}
