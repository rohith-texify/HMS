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

const AppConfigKeyPrefix = "app_config."

// GetCollegeAppSetting retrieves a single application stored setting from platform.college_settings.
func (r *Repository) GetCollegeAppSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	appID string,
) (*models.ApplicationStoredSetting, error) {
	settingKey := AppConfigKeyPrefix + appID

	query := `
		SELECT
			setting_value
		FROM platform.college_settings
		WHERE college_id = $1 AND setting_key = $2
	`

	var rawValue []byte
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, settingKey).Scan(&rawValue)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil // No custom override, falls back to default
		}
		return nil, fmt.Errorf("failed to get college app setting: %w", err)
	}

	var stored models.ApplicationStoredSetting
	if err := json.Unmarshal(rawValue, &stored); err != nil {
		return nil, fmt.Errorf("failed to unmarshal college app setting: %w", err)
	}

	return &stored, nil
}

// ListCollegeAppSettings retrieves all application stored settings for a college.
func (r *Repository) ListCollegeAppSettings(
	ctx context.Context,
	collegeID uuid.UUID,
) (map[string]models.ApplicationStoredSetting, error) {
	query := `
		SELECT
			setting_key,
			setting_value
		FROM platform.college_settings
		WHERE college_id = $1 AND setting_key LIKE $2
	`

	rows, err := r.Executor(ctx).Query(ctx, query, collegeID, AppConfigKeyPrefix+"%")
	if err != nil {
		return nil, fmt.Errorf("failed to list college app settings: %w", err)
	}
	defer rows.Close()

	settings := make(map[string]models.ApplicationStoredSetting)
	for rows.Next() {
		var key string
		var rawValue []byte
		if err := rows.Scan(&key, &rawValue); err != nil {
			return nil, fmt.Errorf("failed to scan college app setting: %w", err)
		}

		var stored models.ApplicationStoredSetting
		if err := json.Unmarshal(rawValue, &stored); err == nil {
			settings[stored.AppID] = stored
		}
	}

	return settings, rows.Err()
}

// UpsertCollegeAppSetting updates or inserts an application stored setting.
func (r *Repository) UpsertCollegeAppSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	setting models.ApplicationStoredSetting,
) error {
	settingKey := AppConfigKeyPrefix + setting.AppID

	valJSON, err := json.Marshal(setting)
	if err != nil {
		return fmt.Errorf("failed to marshal application setting: %w", err)
	}

	query := `
		INSERT INTO platform.college_settings (
			college_setting_id,
			college_id,
			setting_key,
			setting_value,
			is_sensitive,
			created_at,
			updated_at
		)
		VALUES (
			$1, $2, $3, $4::jsonb, false, NOW(), NOW()
		)
		ON CONFLICT (college_id, setting_key)
		DO UPDATE SET
			setting_value = EXCLUDED.setting_value,
			updated_at = NOW()
	`

	_, err = r.Executor(ctx).Exec(
		ctx,
		query,
		uuid.New(),
		collegeID,
		settingKey,
		string(valJSON),
	)
	if err != nil {
		return fmt.Errorf("failed to upsert college app setting: %w", err)
	}

	return nil
}

// RecordApplicationAudit writes an immutable audit record for an application configuration change.
func (r *Repository) RecordApplicationAudit(
	ctx context.Context,
	collegeID uuid.UUID,
	actorUserID uuid.UUID,
	actorRole string,
	action string,
	appID string,
	oldData interface{},
	newData interface{},
	reason *string,
	severity string,
) error {
	if actorUserID == uuid.Nil {
		return fmt.Errorf("actor user ID is required for audit")
	}

	oldDataJSON := []byte("{}")
	if oldData != nil {
		if b, err := json.Marshal(oldData); err == nil {
			oldDataJSON = b
		}
	}

	newDataJSON := []byte("{}")
	if newData != nil {
		if b, err := json.Marshal(newData); err == nil {
			newDataJSON = b
		}
	}

	if severity == "" {
		severity = "INFO"
	}

	query := `
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
			'application_management', $5, 'APPLICATION', NULL,
			$6::jsonb, $7::jsonb,
			$8, NOW(), $9
		)
	`

	_, err := r.Executor(ctx).Exec(
		ctx,
		query,
		uuid.New(),
		collegeID,
		actorUserID,
		actorRole,
		action,
		string(oldDataJSON),
		string(newDataJSON),
		reason,
		severity,
	)
	if err != nil {
		return fmt.Errorf("failed to record application audit: %w", err)
	}

	return nil
}

// ListApplicationHistory retrieves the audit log history for application management.
func (r *Repository) ListApplicationHistory(
	ctx context.Context,
	collegeID uuid.UUID,
	appID string,
	limit, offset int,
) ([]models.ApplicationHistoryItem, int, error) {
	whereClause := "WHERE college_id = $1 AND module = 'application_management'"
	args := []interface{}{collegeID}
	paramIdx := 2

	if appID != "" {
		whereClause += fmt.Sprintf(" AND (new_data->>'app_id' = $%d OR old_data->>'app_id' = $%d)", paramIdx, paramIdx)
		args = append(args, appID)
		paramIdx++
	}

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM platform.audit_logs %s`, whereClause)
	var total int
	if err := r.Executor(ctx).QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count application history: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT
			audit_id,
			college_id,
			action,
			COALESCE(new_data->>'app_id', old_data->>'app_id', '') as app_id,
			old_data,
			new_data,
			actor_user_id,
			COALESCE(actor_role, 'SUPER_ADMIN') as actor_role,
			reason,
			created_at,
			COALESCE(severity, 'INFO') as severity
		FROM platform.audit_logs
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, paramIdx, paramIdx+1)

	args = append(args, limit, offset)

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query application history: %w", err)
	}
	defer rows.Close()

	var history []models.ApplicationHistoryItem
	for rows.Next() {
		var item models.ApplicationHistoryItem
		var oldDataBytes, newDataBytes []byte
		var itemCollegeID *uuid.UUID

		if err := rows.Scan(
			&item.AuditID,
			&itemCollegeID,
			&item.Action,
			&item.AppID,
			&oldDataBytes,
			&newDataBytes,
			&item.ActorUserID,
			&item.ActorRole,
			&item.Reason,
			&item.Timestamp,
			&item.Severity,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan application history: %w", err)
		}

		if itemCollegeID != nil {
			item.CollegeID = *itemCollegeID
		}
		if len(oldDataBytes) > 0 {
			var parsed interface{}
			if err := json.Unmarshal(oldDataBytes, &parsed); err == nil {
				item.PreviousState = parsed
			}
		}
		if len(newDataBytes) > 0 {
			var parsed interface{}
			if err := json.Unmarshal(newDataBytes, &parsed); err == nil {
				item.NewState = parsed
			}
		}

		history = append(history, item)
	}

	return history, total, rows.Err()
}

// GetCollegeActiveModulesCount checks how many of the given modules are active for a college.
func (r *Repository) GetCollegeActiveModulesCount(
	ctx context.Context,
	collegeID uuid.UUID,
	moduleCodes []string,
) (int, error) {
	if len(moduleCodes) == 0 {
		return 0, nil
	}

	query := `
		SELECT COUNT(DISTINCT m.module_code)
		FROM platform.college_modules cm
		JOIN platform.modules m ON m.module_id = cm.module_id
		WHERE cm.college_id = $1
		  AND m.module_code = ANY($2)
		  AND cm.status = 'ACTIVE'
		  AND (cm.effective_from IS NULL OR cm.effective_from <= NOW())
		  AND (cm.effective_to IS NULL OR cm.effective_to > NOW())
	`

	var count int
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, moduleCodes).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count active college modules: %w", err)
	}

	return count, nil
}
