package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// CollegeSetting represents a setting belonging to a college.
type CollegeSetting struct {
	CollegeID uuid.UUID `json:"college_id"`
	Key       string    `json:"key"`
	Value     string    `json:"value"`
}

// ListCollegeSettings retrieves all settings for a college.
func (r *Repository) ListCollegeSettings(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]CollegeSetting, error) {
	rows, err := r.Executor(ctx).Query(
		ctx,
		`
		SELECT
			college_id,
			setting_key,
			setting_value::text
		FROM platform.college_settings
		WHERE college_id = $1
		ORDER BY setting_key ASC
		`,
		collegeID,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to list college settings: %w",
			err,
		)
	}
	defer rows.Close()

	settings := make([]CollegeSetting, 0)

	for rows.Next() {
		var setting CollegeSetting

		if err := rows.Scan(
			&setting.CollegeID,
			&setting.Key,
			&setting.Value,
		); err != nil {
			return nil, fmt.Errorf(
				"failed to scan college setting: %w",
				err,
			)
		}

		settings = append(settings, setting)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf(
			"failed while reading college settings: %w",
			err,
		)
	}

	return settings, nil
}

// UpsertCollegeSetting creates a setting or updates its existing value.
func (r *Repository) UpsertCollegeSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	key string,
	value string,
) (CollegeSetting, error) {
	var setting CollegeSetting

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		INSERT INTO platform.college_settings (
			college_id,
			setting_key,
			setting_value
		)
		VALUES ($1, $2, $3::jsonb)
		ON CONFLICT (college_id, setting_key)
		DO UPDATE SET
			setting_value = EXCLUDED.setting_value,
			updated_at = NOW()
		RETURNING
			college_id,
			setting_key,
			setting_value::text
		`,
		collegeID,
		key,
		value,
	).Scan(
		&setting.CollegeID,
		&setting.Key,
		&setting.Value,
	)

	if err != nil {
		return CollegeSetting{}, fmt.Errorf(
			"failed to save college setting: %w",
			err,
		)
	}

	return setting, nil
}
