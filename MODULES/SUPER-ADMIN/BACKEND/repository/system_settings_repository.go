package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// ListSystemSettings retrieves all global platform settings, optionally filtered by category.
func (r *Repository) ListSystemSettings(
	ctx context.Context,
	category string,
) ([]models.SystemSetting, error) {
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
		return nil, fmt.Errorf("query system settings: %w", err)
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
			return nil, fmt.Errorf("scan system setting: %w", err)
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

	return settings, nil
}

// GetSystemSettingByKey retrieves a single platform global setting by key.
func (r *Repository) GetSystemSettingByKey(
	ctx context.Context,
	key string,
) (*models.SystemSetting, error) {
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
		return nil, fmt.Errorf("query system setting '%s': %w", key, err)
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
		return nil, 0, fmt.Errorf("query system setting history: %w", err)
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
