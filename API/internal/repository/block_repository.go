package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Block struct {
	ID            uuid.UUID `json:"id"`
	CollegeID     uuid.UUID `json:"college_id"`
	HostelID      uuid.UUID `json:"hostel_id"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	Description   *string   `json:"description,omitempty"`
	TotalCapacity int       `json:"total_capacity"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (r *Repository) CreateBlock(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	code string,
	name string,
	description *string,
) (Block, error) {
	var item Block

	err := r.Executor(ctx).QueryRow(ctx, `
		INSERT INTO app.blocks (
			college_id,
			hostel_id,
			code,
			name,
			description
		)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING
			id,
			college_id,
			hostel_id,
			code,
			name,
			description,
			total_capacity,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		hostelID,
		code,
		name,
		description,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.Code,
		&item.Name,
		&item.Description,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		return Block{}, err
	}

	return item, nil
}

func (r *Repository) GetBlock(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
) (Block, error) {
	var item Block

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			hostel_id,
			code,
			name,
			description,
			total_capacity,
			status,
			created_at,
			updated_at
		FROM app.blocks
		WHERE college_id = $1 AND hostel_id = $2 AND id = $3
	`,
		collegeID,
		hostelID,
		blockID,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.Code,
		&item.Name,
		&item.Description,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Block{}, ErrNotFound
		}
		return Block{}, err
	}

	return item, nil
}

func (r *Repository) ListBlocks(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
) ([]Block, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT
			id,
			college_id,
			hostel_id,
			code,
			name,
			description,
			total_capacity,
			status,
			created_at,
			updated_at
		FROM app.blocks
		WHERE college_id = $1 AND hostel_id = $2
		ORDER BY created_at DESC
	`, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Block
	for rows.Next() {
		var item Block
		if err := rows.Scan(
			&item.ID,
			&item.CollegeID,
			&item.HostelID,
			&item.Code,
			&item.Name,
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
		items = []Block{}
	}

	return items, nil
}

func (r *Repository) UpdateBlock(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
	code string,
	name string,
	description *string,
) (Block, error) {
	var item Block

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.blocks
		SET
			code = $4,
			name = $5,
			description = $6,
			updated_at = now()
		WHERE college_id = $1 AND hostel_id = $2 AND id = $3
		RETURNING
			id,
			college_id,
			hostel_id,
			code,
			name,
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
		description,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.Code,
		&item.Name,
		&item.Description,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Block{}, ErrNotFound
		}
		return Block{}, err
	}

	return item, nil
}

func (r *Repository) UpdateBlockStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
	status string,
) (Block, error) {
	var item Block

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.blocks
		SET
			status = $4,
			updated_at = now()
		WHERE college_id = $1 AND hostel_id = $2 AND id = $3
		RETURNING
			id,
			college_id,
			hostel_id,
			code,
			name,
			description,
			total_capacity,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		hostelID,
		blockID,
		status,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.Code,
		&item.Name,
		&item.Description,
		&item.TotalCapacity,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Block{}, ErrNotFound
		}
		return Block{}, err
	}

	return item, nil
}
