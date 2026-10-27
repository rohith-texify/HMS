package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

type PlatformCollege struct {
	CollegeID   uuid.UUID `json:"college_id"`
	CollegeCode string    `json:"college_code"`
	Name        string    `json:"name"`
	Status      string    `json:"status"`
	Timezone    string    `json:"timezone"`
}

func (r *Repository) ListColleges(
	ctx context.Context,
) ([]PlatformCollege, error) {
	rows, err := r.Executor(ctx).Query(
		ctx,
		`
		SELECT
			college_id,
			college_code,
			name,
			status,
			timezone
		FROM platform.colleges
		ORDER BY name ASC
		`,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list colleges: %w", err)
	}
	defer rows.Close()

	var colleges []PlatformCollege

	for rows.Next() {
		var college PlatformCollege

		if err := rows.Scan(
			&college.CollegeID,
			&college.CollegeCode,
			&college.Name,
			&college.Status,
			&college.Timezone,
		); err != nil {
			return nil, fmt.Errorf("failed to scan college: %w", err)
		}

		colleges = append(colleges, college)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed while reading colleges: %w", err)
	}

	return colleges, nil
}
