package repository

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Room struct {
	ID          uuid.UUID `json:"id"`
	CollegeID   uuid.UUID `json:"college_id"`
	HostelID    uuid.UUID `json:"hostel_id"`
	BlockID     uuid.UUID `json:"block_id"`
	FloorID     uuid.UUID `json:"floor_id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	RoomType    string    `json:"room_type"`
	Capacity    int       `json:"capacity"`
	Description *string   `json:"description,omitempty"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (r *Repository) CreateRoom(
	ctx context.Context,
	collegeID uuid.UUID,
	hostelID uuid.UUID,
	blockID uuid.UUID,
	floorID uuid.UUID,
	code string,
	name string,
	roomType string,
	capacity int,
	description *string,
) (Room, error) {
	var item Room

	err := r.Executor(ctx).QueryRow(ctx, `
		INSERT INTO app.rooms (
			college_id,
			hostel_id,
			block_id,
			floor_id,
			code,
			name,
			room_type,
			capacity,
			description
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING
			id,
			college_id,
			hostel_id,
			block_id,
			floor_id,
			code,
			name,
			room_type,
			capacity,
			description,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		hostelID,
		blockID,
		floorID,
		code,
		name,
		roomType,
		capacity,
		description,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.FloorID,
		&item.Code,
		&item.Name,
		&item.RoomType,
		&item.Capacity,
		&item.Description,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		return Room{}, err
	}

	return item, nil
}

func (r *Repository) GetRoom(
	ctx context.Context,
	collegeID uuid.UUID,
	floorID uuid.UUID,
	roomID uuid.UUID,
) (Room, error) {
	var item Room

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			id,
			college_id,
			hostel_id,
			block_id,
			floor_id,
			code,
			name,
			room_type,
			capacity,
			description,
			status,
			created_at,
			updated_at
		FROM app.rooms
		WHERE college_id = $1 AND floor_id = $2 AND id = $3
	`,
		collegeID,
		floorID,
		roomID,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.FloorID,
		&item.Code,
		&item.Name,
		&item.RoomType,
		&item.Capacity,
		&item.Description,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Room{}, ErrNotFound
		}
		return Room{}, err
	}

	return item, nil
}

func (r *Repository) ListRooms(
	ctx context.Context,
	collegeID uuid.UUID,
	floorID uuid.UUID,
) ([]Room, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT
			id,
			college_id,
			hostel_id,
			block_id,
			floor_id,
			code,
			name,
			room_type,
			capacity,
			description,
			status,
			created_at,
			updated_at
		FROM app.rooms
		WHERE college_id = $1 AND floor_id = $2
		ORDER BY name ASC
	`, collegeID, floorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Room
	for rows.Next() {
		var item Room
		if err := rows.Scan(
			&item.ID,
			&item.CollegeID,
			&item.HostelID,
			&item.BlockID,
			&item.FloorID,
			&item.Code,
			&item.Name,
			&item.RoomType,
			&item.Capacity,
			&item.Description,
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
		items = []Room{}
	}

	return items, nil
}

func (r *Repository) UpdateRoom(
	ctx context.Context,
	collegeID uuid.UUID,
	floorID uuid.UUID,
	roomID uuid.UUID,
	code string,
	name string,
	roomType string,
	capacity int,
	description *string,
) (Room, error) {
	var item Room

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.rooms
		SET
			code = $4,
			name = $5,
			room_type = $6,
			capacity = $7,
			description = $8,
			updated_at = now()
		WHERE college_id = $1 AND floor_id = $2 AND id = $3
		RETURNING
			id,
			college_id,
			hostel_id,
			block_id,
			floor_id,
			code,
			name,
			room_type,
			capacity,
			description,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		floorID,
		roomID,
		code,
		name,
		roomType,
		capacity,
		description,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.FloorID,
		&item.Code,
		&item.Name,
		&item.RoomType,
		&item.Capacity,
		&item.Description,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Room{}, ErrNotFound
		}
		return Room{}, err
	}

	return item, nil
}

func (r *Repository) UpdateRoomStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	floorID uuid.UUID,
	roomID uuid.UUID,
	status string,
) (Room, error) {
	var item Room

	err := r.Executor(ctx).QueryRow(ctx, `
		UPDATE app.rooms
		SET
			status = $4,
			updated_at = now()
		WHERE college_id = $1 AND floor_id = $2 AND id = $3
		RETURNING
			id,
			college_id,
			hostel_id,
			block_id,
			floor_id,
			code,
			name,
			room_type,
			capacity,
			description,
			status,
			created_at,
			updated_at
	`,
		collegeID,
		floorID,
		roomID,
		status,
	).Scan(
		&item.ID,
		&item.CollegeID,
		&item.HostelID,
		&item.BlockID,
		&item.FloorID,
		&item.Code,
		&item.Name,
		&item.RoomType,
		&item.Capacity,
		&item.Description,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Room{}, ErrNotFound
		}
		return Room{}, err
	}

	return item, nil
}
