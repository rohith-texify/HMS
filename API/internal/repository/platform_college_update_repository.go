package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type UpdateCollegeParams struct {
	CollegeCode string
	Name        string
	Timezone    string
}

func (r *Repository) UpdateCollege(
	ctx context.Context,
	collegeID uuid.UUID,
	params UpdateCollegeParams,
) (PlatformCollege, error) {
	executor := r.Executor(ctx)

	var college PlatformCollege

	err := executor.QueryRow(
		ctx,
		`
		UPDATE platform.colleges
		SET
			college_code = $1,
			name = $2,
			timezone = $3,
			updated_at = NOW()
		WHERE college_id = $4
		RETURNING
			college_id,
			college_code,
			name,
			status,
			timezone
		`,
		params.CollegeCode,
		params.Name,
		params.Timezone,
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

		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return PlatformCollege{}, ErrConflict
		}

		return PlatformCollege{}, fmt.Errorf(
			"failed to update college: %w",
			err,
		)
	}

	return college, nil
}
