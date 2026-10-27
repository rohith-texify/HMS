package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type UpdateCollegeStatusParams struct {
	Status          string
	LifecycleReason string
}

type PlatformCollegeStatus struct {
	CollegeID       uuid.UUID `json:"college_id"`
	CollegeCode     string    `json:"college_code"`
	Name            string    `json:"name"`
	Status          string    `json:"status"`
	Timezone        string    `json:"timezone"`
	ActivatedAt     *string   `json:"activated_at,omitempty"`
	SuspendedAt     *string   `json:"suspended_at,omitempty"`
	DeactivatedAt   *string   `json:"deactivated_at,omitempty"`
	ArchivedAt      *string   `json:"archived_at,omitempty"`
	LifecycleReason *string   `json:"lifecycle_reason,omitempty"`
}

// GetCollegeStatusForUpdate reads the current status while locking the
// college row until the surrounding transaction commits or rolls back.
func (r *Repository) GetCollegeStatusForUpdate(
	ctx context.Context,
	collegeID uuid.UUID,
) (string, error) {
	var status string

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		SELECT status
		FROM platform.colleges
		WHERE college_id = $1
		FOR UPDATE
		`,
		collegeID,
	).Scan(&status)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("failed to read college status: %w", err)
	}

	return status, nil
}

func (r *Repository) UpdateCollegeStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	params UpdateCollegeStatusParams,
) (PlatformCollegeStatus, error) {
	executor := r.Executor(ctx)

	var college PlatformCollegeStatus

	err := executor.QueryRow(
		ctx,
		`
		UPDATE platform.colleges
		SET
			status = $1::text,
			lifecycle_reason = $2,

			activated_at = CASE
				WHEN $1::text = 'ACTIVE' AND status <> 'ACTIVE'
					THEN NOW()
				ELSE activated_at
			END,

			suspended_at = CASE
				WHEN $1::text = 'SUSPENDED' AND status <> 'SUSPENDED'
					THEN NOW()
				ELSE suspended_at
			END,

			deactivated_at = CASE
				WHEN $1::text = 'DEACTIVATED' AND status <> 'DEACTIVATED'
					THEN NOW()
				ELSE deactivated_at
			END,

			updated_at = NOW()

		WHERE college_id = $3

		RETURNING
			college_id,
			college_code,
			name,
			status,
			timezone,
			to_char(activated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
			to_char(suspended_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
			to_char(deactivated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
			to_char(archived_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
			lifecycle_reason
		`,
		params.Status,
		params.LifecycleReason,
		collegeID,
	).Scan(
		&college.CollegeID,
		&college.CollegeCode,
		&college.Name,
		&college.Status,
		&college.Timezone,
		&college.ActivatedAt,
		&college.SuspendedAt,
		&college.DeactivatedAt,
		&college.ArchivedAt,
		&college.LifecycleReason,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PlatformCollegeStatus{}, ErrNotFound
		}

		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) {
			return PlatformCollegeStatus{}, fmt.Errorf(
				"failed to update college status: %w",
				err,
			)
		}

		return PlatformCollegeStatus{}, fmt.Errorf(
			"failed to update college status: %w",
			err,
		)
	}

	return college, nil
}
