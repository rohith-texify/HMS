package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/MODULES/ADMIN/BACKEND/models"
)

// ListHostels returns all hostels for a college.
func (r *Repository) ListHostels(ctx context.Context, collegeID uuid.UUID) ([]models.Hostel, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, name, code, type, capacity, address, status, created_at, updated_at
		FROM app.hostels
		WHERE college_id = $1
		ORDER BY name ASC
	`

	rows, err := db.Query(ctx, query, collegeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var hostels []models.Hostel
	for rows.Next() {
		var h models.Hostel
		if err := rows.Scan(
			&h.ID, &h.CollegeID, &h.Name, &h.Code, &h.Type,
			&h.Capacity, &h.Address, &h.Status, &h.CreatedAt, &h.UpdatedAt,
		); err != nil {
			return nil, err
		}
		hostels = append(hostels, h)
	}
	return hostels, nil
}

// ListBlocks returns all blocks for a hostel.
func (r *Repository) ListBlocks(ctx context.Context, collegeID, hostelID uuid.UUID) ([]models.Block, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, hostel_id, name, code, total_floors, status, created_at, updated_at
		FROM app.blocks
		WHERE college_id = $1 AND hostel_id = $2
		ORDER BY name ASC
	`

	rows, err := db.Query(ctx, query, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var blocks []models.Block
	for rows.Next() {
		var b models.Block
		if err := rows.Scan(
			&b.ID, &b.CollegeID, &b.HostelID, &b.Name, &b.Code,
			&b.TotalFloors, &b.Status, &b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			return nil, err
		}
		blocks = append(blocks, b)
	}
	return blocks, nil
}

// ListFloors returns all floors for a block.
func (r *Repository) ListFloors(ctx context.Context, collegeID, blockID uuid.UUID) ([]models.Floor, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, block_id, floor_number, name, status, created_at, updated_at
		FROM app.floors
		WHERE college_id = $1 AND block_id = $2
		ORDER BY floor_number ASC
	`

	rows, err := db.Query(ctx, query, collegeID, blockID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var floors []models.Floor
	for rows.Next() {
		var f models.Floor
		if err := rows.Scan(
			&f.ID, &f.CollegeID, &f.BlockID, &f.FloorNumber,
			&f.Name, &f.Status, &f.CreatedAt, &f.UpdatedAt,
		); err != nil {
			return nil, err
		}
		floors = append(floors, f)
	}
	return floors, nil
}

// ListRooms returns all rooms for a floor.
func (r *Repository) ListRooms(ctx context.Context, collegeID, floorID uuid.UUID) ([]models.Room, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, floor_id, room_number, room_type, capacity, status, created_at, updated_at
		FROM app.rooms
		WHERE college_id = $1 AND floor_id = $2
		ORDER BY room_number ASC
	`

	rows, err := db.Query(ctx, query, collegeID, floorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []models.Room
	for rows.Next() {
		var rm models.Room
		if err := rows.Scan(
			&rm.ID, &rm.CollegeID, &rm.FloorID, &rm.RoomNumber,
			&rm.RoomType, &rm.Capacity, &rm.Status, &rm.CreatedAt, &rm.UpdatedAt,
		); err != nil {
			return nil, err
		}
		rooms = append(rooms, rm)
	}
	return rooms, nil
}

// ListBeds returns all beds for a room.
func (r *Repository) ListBeds(ctx context.Context, collegeID, roomID uuid.UUID) ([]models.Bed, error) {
	db, err := r.GetDB(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, college_id, room_id, bed_number, status, created_at, updated_at
		FROM app.beds
		WHERE college_id = $1 AND room_id = $2
		ORDER BY bed_number ASC
	`

	rows, err := db.Query(ctx, query, collegeID, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var beds []models.Bed
	for rows.Next() {
		var bd models.Bed
		if err := rows.Scan(
			&bd.ID, &bd.CollegeID, &bd.RoomID, &bd.BedNumber,
			&bd.Status, &bd.CreatedAt, &bd.UpdatedAt,
		); err != nil {
			return nil, err
		}
		beds = append(beds, bd)
	}
	return beds, nil
}

