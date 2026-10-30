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
	// Platform schema queries must use the platform pool, not college pool
	executor := r.Executor(ctx)
	if r.PlatformPool != nil {
		executor = r.PlatformPool
	}

	query := `
		SELECT
			college_id,
			college_code,
			name,
			status,
			timezone
		FROM platform.colleges
		ORDER BY name ASC
	`

	rows, err := executor.Query(ctx, query)
	if err != nil {
		// If query fails and we had a platform pool, try falling back to the college pool
		// (in case platform pool failed to initialize but college pool is working)
		if r.PlatformPool != nil && r.Pool != nil && r.PlatformPool != r.Pool {
			rows, err = r.Pool.Query(ctx, query)
			if err != nil {
				return nil, fmt.Errorf("failed to list colleges (both pools failed): %w", err)
			}
		} else {
			return nil, fmt.Errorf("failed to list colleges: %w", err)
		}
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
