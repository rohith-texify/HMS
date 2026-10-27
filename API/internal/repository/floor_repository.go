package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Floor struct {
	ID            uuid.UUID `json:"id"`
	CollegeID     uuid.UUID `json:"college_id"`
	HostelID      uuid.UUID `json:"hostel_id"`
	BlockID       uuid.UUID `json:"block_id"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	FloorNumber   int       `json:"floor_number"`
	Description   *string   `json:"description,omitempty"`
	TotalCapacity int       `json:"total_capacity"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (r *Repository) CreateFloor(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
	code string,
	name string,
	floorNumber int,
	description *string,
) (Floor, error) {
	var item Floor

	err := r.Executor(ctx).QueryRow(ctx, `
		INSERT INTO app.floors (
			college_id,
			hostel_id,
			block_id,
			code,
			name,
			floor_number,
			description
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING
			id,
			college_id,
			hostel_id,
			block_id,
			code,
			name,
			floor_number,
			description,
			total_capacity,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		hostelID,
		blockID,
		code,
		name,
		floorNumber,
		description,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.Code,
		&item.Name,
		&item.FloorNumber,
		&item.Description,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		return Floor{}, err
	}

	return item, nil
}

func (r *Repository) GetFloor(
	ctx context.Context,
	collegeID uuid.UUID,
	blockID uuid.UUID,
	floorID uuid.UUID,
) (Floor, error) {
	var item Floor

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			hostel_id,
			block_id,
			code,
			name,
			floor_number,
			description,
			total_capacity,
			status,
			created_at,
			updated_at
		FROM app.floors
		WHERE college_id = $1 AND block_id = $2 AND id = $3
	`,
		collegeID,
		blockID,
		floorID,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.Code,
		&item.Name,
		&item.FloorNumber,
		&item.Description,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Floor{}, ErrNotFound
		}
		return Floor{}, err
	}

	return item, nil
}

func (r *Repository) ListFloors(
	ctx context.Context,
	collegeID uuid.UUID,
	blockID uuid.UUID,
) ([]Floor, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT
			id,
			college_id,
			hostel_id,
			block_id,
			code,
			name,
			floor_number,
			description,
			total_capacity,
			status,
			created_at,
			updated_at
		FROM app.floors
		WHERE college_id = $1 AND block_id = $2
		ORDER BY floor_number ASC
	`, collegeID, blockID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Floor
	for rows.Next() {
		var item Floor
		if err := rows.Scan(
			&item.ID,
			&item.CollegeID,
			&item.HostelID,
			&item.BlockID,
			&item.Code,
			&item.Name,
			&item.FloorNumber,
			&item.Description,
			&item.TotalCapacity,
			&item.Status,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if items == nil {
		items = []Floor{}
	}

	return items, nil
}

func (r *Repository) UpdateFloor(
	ctx context.Context,
	collegeID uuid.UUID,
	blockID uuid.UUID,
	floorID uuid.UUID,
	code string,
	name string,
	floorNumber int,
	description *string,
) (Floor, error) {
	var item Floor

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.floors
		SET
			code = $4,
			name = $5,
			floor_number = $6,
			description = $7,
			updated_at = now()
		WHERE college_id = $1 AND block_id = $2 AND id = $3
		RETURNING
			id,
			college_id,
			hostel_id,
			block_id,
			code,
			name,
			floor_number,
			description,
			total_capacity,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		blockID,
		floorID,
		code,
		name,
		floorNumber,
		description,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.Code,
		&item.Name,
		&item.FloorNumber,
		&item.Description,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Floor{}, ErrNotFound
		}
		return Floor{}, err
	}

	return item, nil
}

func (r *Repository) UpdateFloorStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	blockID uuid.UUID,
	floorID uuid.UUID,
	status string,
) (Floor, error) {
	var item Floor

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.floors
		SET
			status = $4,
			updated_at = now()
		WHERE college_id = $1 AND block_id = $2 AND id = $3
		RETURNING
			id,
			college_id,
			hostel_id,
			block_id,
			code,
			name,
			floor_number,
			description,
			total_capacity,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		blockID,
		floorID,
		status,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.Code,
		&item.Name,
		&item.FloorNumber,
		&item.Description,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Floor{}, ErrNotFound
		}
		return Floor{}, err
	}

	return item, nil
}
