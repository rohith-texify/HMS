package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
)

type CreateCollegeParams struct {
	CollegeCode string
	Name        string
}

func (r *Repository) CreateCollege(
	ctx context.Context,
	params CreateCollegeParams,
) (PlatformCollege, error) {
	executor := r.Executor(ctx)
	collegeID := uuid.New()

	var college PlatformCollege

	err := executor.QueryRow(
		ctx,
		`
		INSERT INTO platform.colleges (
			college_id,
			college_code,
			name,
			status
		)
		VALUES ($1, $2, $3, 'ONBOARDING')
		RETURNING
			college_id,
			college_code,
			name,
			status,
			timezone
		`,
		collegeID,
		params.CollegeCode,
		params.Name,
	).Scan(
		&college.CollegeID,
		&college.CollegeCode,
		&college.Name,
		&college.Status,
		&college.Timezone,
	)

	if err != nil {
		var pgErr *pgconn.PgError

		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return PlatformCollege{}, ErrConflict
		}

		return PlatformCollege{}, fmt.Errorf(
			"failed to create college: %w",
			err,
		)
	}

	return college, nil
}
