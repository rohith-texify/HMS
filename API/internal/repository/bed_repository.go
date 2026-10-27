package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Bed struct {
	ID        uuid.UUID `json:"id"`
	CollegeID uuid.UUID `json:"college_id"`
	HostelID  uuid.UUID `json:"hostel_id"`
	BlockID   uuid.UUID `json:"block_id"`
	FloorID   uuid.UUID `json:"floor_id"`
	RoomID    uuid.UUID `json:"room_id"`
	Code      string    `json:"code"`
	Name      *string   `json:"name,omitempty"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (r *Repository) CreateBed(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
	floorID uuid.UUID,
	roomID uuid.UUID,
	code string,
	name *string,
) (Bed, error) {
	var item Bed

	err := r.Executor(ctx).QueryRow(ctx, `
		INSERT INTO app.beds (
			college_id,
			hostel_id,
			block_id,
			floor_id,
			room_id,
			code,
			name
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING
			id,
			college_id,
			hostel_id,
			block_id,
			floor_id,
			room_id,
			code,
			name,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		hostelID,
		blockID,
		floorID,
		roomID,
		code,
		name,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.FloorID,
		&item.RoomID,
		&item.Code,
		&item.Name,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		return Bed{}, err
	}

	return item, nil
}

func (r *Repository) GetBed(
	ctx context.Context,
	collegeID uuid.UUID,
	roomID uuid.UUID,
	bedID uuid.UUID,
) (Bed, error) {
	var item Bed

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			hostel_id,
			block_id,
			floor_id,
			room_id,
			code,
			name,
			status,
			created_at,
			updated_at
		FROM app.beds
		WHERE college_id = $1 AND room_id = $2 AND id = $3
	`,
		collegeID,
		roomID,
		bedID,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.FloorID,
		&item.RoomID,
		&item.Code,
		&item.Name,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Bed{}, ErrNotFound
		}
		return Bed{}, err
	}

	return item, nil
}

func (r *Repository) ListBeds(
	ctx context.Context,
	collegeID uuid.UUID,
	roomID uuid.UUID,
) ([]Bed, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT
			id,
			college_id,
			hostel_id,
			block_id,
			floor_id,
			room_id,
			code,
			name,
			status,
			created_at,
			updated_at
		FROM app.beds
		WHERE college_id = $1 AND room_id = $2
		ORDER BY code ASC
	`, collegeID, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Bed
	for rows.Next() {
		var item Bed
		if err := rows.Scan(
			&item.ID,
			&item.CollegeID,
			&item.HostelID,
			&item.BlockID,
			&item.FloorID,
			&item.RoomID,
			&item.Code,
			&item.Name,
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
		items = []Bed{}
	}

	return items, nil
}

func (r *Repository) UpdateBed(
	ctx context.Context,
	collegeID uuid.UUID,
	roomID uuid.UUID,
	bedID uuid.UUID,
	code string,
	name *string,
) (Bed, error) {
	var item Bed

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.beds
		SET
			code = $4,
			name = $5,
			updated_at = now()
		WHERE college_id = $1 AND room_id = $2 AND id = $3
		RETURNING
			id,
			college_id,
			hostel_id,
			block_id,
			floor_id,
			room_id,
			code,
			name,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		roomID,
		bedID,
		code,
		name,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.FloorID,
		&item.RoomID,
		&item.Code,
		&item.Name,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Bed{}, ErrNotFound
		}
		return Bed{}, err
	}

	return item, nil
}

func (r *Repository) UpdateBedStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	roomID uuid.UUID,
	bedID uuid.UUID,
	status string,
) (Bed, error) {
	var item Bed

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.beds
		SET
			status = $4,
			updated_at = now()
		WHERE college_id = $1 AND room_id = $2 AND id = $3
		RETURNING
			id,
			college_id,
			hostel_id,
			block_id,
			floor_id,
			room_id,
			code,
			name,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		roomID,
		bedID,
		status,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.FloorID,
		&item.RoomID,
		&item.Code,
		&item.Name,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Bed{}, ErrNotFound
		}
		return Bed{}, err
	}

	return item, nil
}
