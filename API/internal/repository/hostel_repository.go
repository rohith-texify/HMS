package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Hostel struct {
	ID            uuid.UUID `json:"id"`
	CollegeID     uuid.UUID `json:"college_id"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	Category      string    `json:"category"`
	Description   *string   `json:"description"`
	Address       *string   `json:"address"`
	TotalCapacity int       `json:"total_capacity"`
	Status        string    `json:"status"`
	CreatedAt     string    `json:"created_at"`
	UpdatedAt     string    `json:"updated_at"`
}

func (r *Repository) ListHostels(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]Hostel, error) {
	rows, err := r.Executor(ctx).Query(
		ctx,
		`
		SELECT
			id,
			college_id,
			code,
			name,
			category,
			description,
			address,
			total_capacity,
			status,
			created_at::text,
			updated_at::text
		FROM app.hostels
		WHERE college_id = $1
		ORDER BY name ASC
		`,
		collegeID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list hostels: %w", err)
	}
	defer rows.Close()

	items := make([]Hostel, 0)

	for rows.Next() {
		var item Hostel

		if err := rows.Scan(
			&item.ID,
			&item.CollegeID,
			&item.Code,
			&item.Name,
			&item.Category,
			&item.Description,
			&item.Address,
			&item.TotalCapacity,
			&item.Status,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan hostel: %w", err)
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate hostels: %w", err)
	}

	return items, nil
}

func (r *Repository) GetHostel(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
) (Hostel, error) {
	var item Hostel

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		SELECT
			id,
			college_id,
			code,
			name,
			category,
			description,
			address,
			total_capacity,
			status,
			created_at::text,
			updated_at::text
		FROM app.hostels
		WHERE college_id = $1
		  AND id = $2
		`,
		collegeID,
		hostelID,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.Code,
		&item.Name,
		&item.Category,
		&item.Description,
		&item.Address,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return Hostel{}, ErrNotFound
		}

		if errors.Is(err, pgx.ErrNoRows) {
			return Hostel{}, ErrNotFound
		}

		return Hostel{}, fmt.Errorf("failed to get hostel: %w", err)
	}

	return item, nil
}

func (r *Repository) CreateHostel(
	ctx context.Context,
	collegeID uuid.UUID,
	code string,
	name string,
	category string,
	description *string,
	address *string,
	totalCapacity int,
	status string,
) (Hostel, error) {
	var item Hostel

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		INSERT INTO app.hostels (
			college_id,
			code,
			name,
			category,
			description,
			address,
			total_capacity,
			status
		)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
		RETURNING
			id,
			college_id,
			code,
			name,
			category,
			description,
			address,
			total_capacity,
			status,
			created_at::text,
			updated_at::text
		`,
		collegeID,
		code,
		name,
		category,
		description,
		address,
		totalCapacity,
		status,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.Code,
		&item.Name,
		&item.Category,
		&item.Description,
		&item.Address,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		return Hostel{}, fmt.Errorf("failed to create hostel: %w", err)
	}

	return item, nil
}

func (r *Repository) UpdateHostel(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	code string,
	name string,
	category string,
	description *string,
	address *string,
	totalCapacity int,
) (Hostel, error) {
	var item Hostel

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		UPDATE app.hostels
		SET
			code = $3,
			name = $4,
			category = $5,
			description = $6,
			address = $7,
			total_capacity = $8,
			updated_at = CURRENT_TIMESTAMP
		WHERE college_id = $1
		  AND id = $2
		RETURNING
			id,
			college_id,
			code,
			name,
			category,
			description,
			address,
			total_capacity,
			status,
			created_at::text,
			updated_at::text
		`,
		collegeID,
		hostelID,
		code,
		name,
		category,
		description,
		address,
		totalCapacity,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.Code,
		&item.Name,
		&item.Category,
		&item.Description,
		&item.Address,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Hostel{}, ErrNotFound
		}

		return Hostel{}, fmt.Errorf("failed to update hostel: %w", err)
	}

	return item, nil
}

func (r *Repository) UpdateHostelStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	status string,
) (Hostel, error) {
	var item Hostel

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		UPDATE app.hostels
		SET
			status = $3,
			updated_at = CURRENT_TIMESTAMP
		WHERE college_id = $1
		  AND id = $2
		RETURNING
			id,
			college_id,
			code,
			name,
			category,
			description,
			address,
			total_capacity,
			status,
			created_at::text,
			updated_at::text
		`,
		collegeID,
		hostelID,
		status,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.Code,
		&item.Name,
		&item.Category,
		&item.Description,
		&item.Address,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Hostel{}, ErrNotFound
		}

		return Hostel{}, fmt.Errorf("failed to update hostel status: %w", err)
	}

	return item, nil
}
