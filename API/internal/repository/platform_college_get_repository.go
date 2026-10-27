package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Repository) GetCollege(
	ctx context.Context,
	collegeID uuid.UUID,
) (PlatformCollege, error) {
	executor := r.Executor(ctx)

	var college PlatformCollege

	err := executor.QueryRow(
		ctx,
		`
		SELECT
			college_id,
			college_code,
			name,
			status,
			timezone
		FROM platform.colleges
		WHERE college_id = $1
		`,
		collegeID,
	).Scan(
		&college.CollegeID,
		&college.CollegeCode,
		&college.Name,
		&college.Status,
		&college.Timezone,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return PlatformCollege{}, ErrNotFound
		}

		return PlatformCollege{}, fmt.Errorf(
			"failed to get college: %w",
			err,
		)
	}

	return college, nil
}
