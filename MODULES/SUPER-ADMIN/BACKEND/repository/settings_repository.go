package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// ListCollegeSettings retrieves all settings for a college.
func (r *Repository) ListCollegeSettings(
	ctx context.Context,
	collegeID uuid.UUID,
	includeSensitive bool,
) ([]models.CollegeSetting, error) {
	whereClause := "WHERE college_id = $1"
	args := []interface{}{collegeID}

	if !includeSensitive {
		whereClause += " AND is_sensitive = false"
	}

	query := fmt.Sprintf(`
		SELECT
			college_setting_id,
			college_id,
			setting_key,
			setting_value,
			is_sensitive,
			created_at,
			updated_at
		FROM platform.college_settings
		%s
		ORDER BY setting_key ASC
	`, whereClause)

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list college settings: %w", err)
	}
	defer rows.Close()

	var settings []models.CollegeSetting
	for rows.Next() {
		var setting models.CollegeSetting
		if err := rows.Scan(
			&setting.CollegeSettingID,
			&setting.CollegeID,
			&setting.SettingKey,
			&setting.SettingValue,
			&setting.IsSensitive,
			&setting.CreatedAt,
			&setting.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan college setting: %w", err)
		}
		settings = append(settings, setting)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed while reading college settings: %w", err)
	}

	return settings, nil
}

// GetCollegeSettingByKey retrieves a specific setting by college ID and key.
func (r *Repository) GetCollegeSettingByKey(
	ctx context.Context,
	collegeID uuid.UUID,
	settingKey string,
) (*models.CollegeSetting, error) {
	query := `
		SELECT
			college_setting_id,
			college_id,
			setting_key,
			setting_value,
			is_sensitive,
			created_at,
			updated_at
		FROM platform.college_settings
		WHERE college_id = $1 AND setting_key = $2
	`

	var setting models.CollegeSetting
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, settingKey).Scan(
		&setting.CollegeSettingID,
		&setting.CollegeID,
		&setting.SettingKey,
		&setting.SettingValue,
		&setting.IsSensitive,
		&setting.CreatedAt,
		&setting.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &setting, nil
}

// UpdateCollegeSetting updates a college setting value.
func (r *Repository) UpdateCollegeSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	settingKey string,
	settingValue models.JSONB,
) (*models.CollegeSetting, error) {
	query := `
		UPDATE platform.college_settings
		SET
			setting_value = $1,
			updated_at = $2
		WHERE college_id = $3 AND setting_key = $4
		RETURNING
			college_setting_id,
			college_id,
			setting_key,
			setting_value,
			is_sensitive,
			created_at,
			updated_at
	`

	now := time.Now()

	var setting models.CollegeSetting
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		settingValue,
		now,
		collegeID,
		settingKey,
	).Scan(
		&setting.CollegeSettingID,
		&setting.CollegeID,
		&setting.SettingKey,
		&setting.SettingValue,
		&setting.IsSensitive,
		&setting.CreatedAt,
		&setting.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update college setting: %w", err)
	}

	return &setting, nil
}

// UpsertCollegeSetting creates or updates a college setting.
func (r *Repository) UpsertCollegeSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	settingKey string,
	settingValue models.JSONB,
	isSensitive bool,
) (*models.CollegeSetting, error) {
	query := `
		INSERT INTO platform.college_settings (
			college_id,
			setting_key,
			setting_value,
			is_sensitive,
			created_at,
			updated_at
		)
		VALUES ($1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT (college_id, setting_key)
		DO UPDATE SET
			setting_value = EXCLUDED.setting_value,
			updated_at = NOW()
		RETURNING
			college_setting_id,
			college_id,
			setting_key,
			setting_value,
			is_sensitive,
			created_at,
			updated_at
	`

	var setting models.CollegeSetting
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		collegeID,
		settingKey,
		settingValue,
		isSensitive,
	).Scan(
		&setting.CollegeSettingID,
		&setting.CollegeID,
		&setting.SettingKey,
		&setting.SettingValue,
		&setting.IsSensitive,
		&setting.CreatedAt,
		&setting.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert college setting: %w", err)
	}

	return &setting, nil
}

// SettingsAuditParams represents audit logging parameters for college settings operations.
type SettingsAuditParams struct {
	CollegeID   uuid.UUID
	ActorUserID uuid.UUID
	ActorRole   string
	Module      string
	Action      string
	EntityType  string
	EntityID    *uuid.UUID
	OldData     interface{}
	NewData     interface{}
	Reason      *string
	Severity    string
}

// RecordSettingsAudit writes an immutable audit record to platform.audit_logs.
func (r *Repository) RecordSettingsAudit(
	ctx context.Context,
	params SettingsAuditParams,
) error {
	if params.ActorUserID == uuid.Nil {
		return fmt.Errorf("actor user ID is required for audit")
	}

	oldDataJSON := []byte("{}")
	if params.OldData != nil {
		if b, err := json.Marshal(params.OldData); err == nil {
			oldDataJSON = b
		}
	}

	newDataJSON := []byte("{}")
	if params.NewData != nil {
		if b, err := json.Marshal(params.NewData); err == nil {
			newDataJSON = b
		}
	}

	module := params.Module
	if module == "" {
		module = "platform_college_settings"
	}

	severity := params.Severity
	if severity == "" {
		severity = "INFO"
	}

	_, err := r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.audit_logs (
			audit_id,
			college_id,
			actor_user_id,
			actor_role,
			module,
			action,
			entity_type,
			entity_id,
			old_data,
			new_data,
			reason,
			created_at,
			severity
		)
		VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8,
			$9::jsonb, $10::jsonb,
			$11, NOW(), $12
		)
	`,
		uuid.New(),
		params.CollegeID,
		params.ActorUserID,
		params.ActorRole,
		module,
		params.Action,
		params.EntityType,
		params.EntityID,
		string(oldDataJSON),
		string(newDataJSON),
		params.Reason,
		severity,
	)
	if err != nil {
		return fmt.Errorf("record settings audit: %w", err)
	}

	return nil
}

// DeleteCollegeSetting removes an explicit college setting override.
func (r *Repository) DeleteCollegeSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	settingKey string,
) error {
	query := `
		DELETE FROM platform.college_settings
		WHERE college_id = $1 AND setting_key = $2
	`

	result, err := r.Executor(ctx).Exec(ctx, query, collegeID, settingKey)
	if err != nil {
		return fmt.Errorf("failed to delete college setting: %w", err)
	}

	if result.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	return nil
}

// ListCollegeSettingsHistory retrieves paginated audit logs for college settings mutations.
func (r *Repository) ListCollegeSettingsHistory(
	ctx context.Context,
	collegeID uuid.UUID,
	settingKey string,
	limit int,
	offset int,
) ([]models.SettingHistoryEntry, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	whereClause := `
		WHERE college_id = $1
		  AND (entity_type = 'COLLEGE_SETTING' OR module = 'platform_college_settings')
	`
	args := []interface{}{collegeID}

	if settingKey != "" {
		args = append(args, settingKey)
		whereClause += fmt.Sprintf(` AND (COALESCE(new_data->>'setting_key', old_data->>'setting_key', '') = $%d)`, len(args))
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM platform.audit_logs %s`, whereClause)
	var total int
	if err := r.Executor(ctx).QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count college setting history: %w", err)
	}

	argsWithPaging := append(args, limit, offset)
	query := fmt.Sprintf(`
		SELECT
			audit_id,
			college_id,
			COALESCE(new_data->>'setting_key', old_data->>'setting_key', '') AS key,
			old_data,
			new_data,
			action,
			actor_user_id,
			actor_role,
			reason,
			created_at
		FROM platform.audit_logs
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, len(argsWithPaging)-1, len(argsWithPaging))

	rows, err := r.Executor(ctx).Query(ctx, query, argsWithPaging...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query college setting history: %w", err)
	}
	defer rows.Close()

	var entries []models.SettingHistoryEntry
	for rows.Next() {
		var (
			entry      models.SettingHistoryEntry
			oldDataRaw models.JSONB
			newDataRaw models.JSONB
		)
		if err := rows.Scan(
			&entry.AuditID,
			&entry.CollegeID,
			&entry.SettingKey,
			&oldDataRaw,
			&newDataRaw,
			&entry.Action,
			&entry.ActorUserID,
			&entry.ActorRole,
			&entry.Reason,
			&entry.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan setting history entry: %w", err)
		}

		entry.OldValue = extractSettingValue(oldDataRaw)
		entry.NewValue = extractSettingValue(newDataRaw)
		entries = append(entries, entry)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed reading setting history rows: %w", err)
	}

	if entries == nil {
		entries = []models.SettingHistoryEntry{}
	}

	return entries, total, nil
}

// GetSettingsAuditByID retrieves a specific settings audit log entry.
func (r *Repository) GetSettingsAuditByID(
	ctx context.Context,
	collegeID uuid.UUID,
	auditID uuid.UUID,
) (*models.SettingHistoryEntry, error) {
	query := `
		SELECT
			audit_id,
			college_id,
			COALESCE(new_data->>'setting_key', old_data->>'setting_key', '') AS key,
			old_data,
			new_data,
			action,
			actor_user_id,
			actor_role,
			reason,
			created_at
		FROM platform.audit_logs
		WHERE college_id = $1 AND audit_id = $2
		  AND (entity_type = 'COLLEGE_SETTING' OR module = 'platform_college_settings')
	`

	var (
		entry      models.SettingHistoryEntry
		oldDataRaw models.JSONB
		newDataRaw models.JSONB
	)

	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, auditID).Scan(
		&entry.AuditID,
		&entry.CollegeID,
		&entry.SettingKey,
		&oldDataRaw,
		&newDataRaw,
		&entry.Action,
		&entry.ActorUserID,
		&entry.ActorRole,
		&entry.Reason,
		&entry.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	entry.OldValue = extractSettingValue(oldDataRaw)
	entry.NewValue = extractSettingValue(newDataRaw)

	return &entry, nil
}

// extractSettingValue extracts the actual setting value payload from audit JSON data.
func extractSettingValue(data models.JSONB) interface{} {
	if data == nil {
		return nil
	}
	if val, exists := data["setting_value"]; exists {
		return val
	}
	return data
}

