package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

const (
	StructurePolicyKeyPrefix = "hostel_structure.policy"
	StructureLockKeyPrefix   = "hostel_structure.lock."
)

// GetStructureOverview returns aggregate structure and verified occupancy figures for a college.
func (r *Repository) GetStructureOverview(ctx context.Context, collegeID uuid.UUID) (*models.OccupancySummary, error) {
	summary := &models.OccupancySummary{}

	// Hostels, blocks, floors, rooms, beds count
	query := `
		SELECT
			(SELECT COUNT(*) FROM app.hostels WHERE college_id = $1),
			(SELECT COUNT(*) FROM app.blocks WHERE college_id = $1),
			(SELECT COUNT(*) FROM app.floors WHERE college_id = $1),
			(SELECT COUNT(*) FROM app.rooms WHERE college_id = $1),
			(SELECT COUNT(*) FROM app.rooms WHERE college_id = $1 AND status = 'ACTIVE'),
			(SELECT COALESCE(SUM(capacity), 0) FROM app.rooms WHERE college_id = $1),
			(SELECT COUNT(*) FROM app.beds WHERE college_id = $1),
			(SELECT COUNT(*) FROM app.beds WHERE college_id = $1 AND status = 'RESERVED'),
			(SELECT COUNT(*) FROM app.beds WHERE college_id = $1 AND status = 'MAINTENANCE'),
			(SELECT COUNT(*) FROM app.beds WHERE college_id = $1 AND status = 'INACTIVE')
	`
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID).Scan(
		&summary.TotalHostels,
		&summary.TotalBlocks,
		&summary.TotalFloors,
		&summary.TotalRooms,
		&summary.ActiveRooms,
		&summary.TotalBedCapacity,
		&summary.TotalBeds,
		&summary.ReservedBeds,
		&summary.MaintenanceBeds,
		&summary.InactiveBeds,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query structure counts: %w", err)
	}

	// Active bed allocations (actual occupied beds)
	allocQuery := `
		SELECT COUNT(DISTINCT ba.bed_id)
		FROM app.bed_allocations ba
		JOIN app.beds b ON b.id = ba.bed_id AND b.college_id = ba.college_id
		WHERE ba.college_id = $1 AND ba.status = 'ACTIVE'
	`
	_ = r.Executor(ctx).QueryRow(ctx, allocQuery, collegeID).Scan(&summary.OccupiedBeds)

	summary.AvailableBeds = summary.TotalBeds - summary.OccupiedBeds - summary.ReservedBeds - summary.MaintenanceBeds - summary.InactiveBeds
	if summary.AvailableBeds < 0 {
		summary.AvailableBeds = 0
	}

	// Room level occupancy distribution
	roomStatsQuery := `
		WITH room_allocations AS (
			SELECT r.id AS room_id, r.capacity, r.status,
			       COUNT(ba.id) AS active_allocations
			FROM app.rooms r
			LEFT JOIN app.beds b ON b.room_id = r.id AND b.college_id = r.college_id
			LEFT JOIN app.bed_allocations ba ON ba.bed_id = b.id AND ba.college_id = r.college_id AND ba.status = 'ACTIVE'
			WHERE r.college_id = $1 AND r.status = 'ACTIVE'
			GROUP BY r.id, r.capacity, r.status
		)
		SELECT
			COUNT(CASE WHEN active_allocations > 0 AND active_allocations >= capacity AND capacity > 0 THEN 1 END) AS fully_occupied,
			COUNT(CASE WHEN active_allocations > 0 AND (active_allocations < capacity OR capacity = 0) THEN 1 END) AS partially_occupied,
			COUNT(CASE WHEN active_allocations = 0 THEN 1 END) AS vacant
		FROM room_allocations
	`
	var fullyOcc, partOcc, vacant int
	_ = r.Executor(ctx).QueryRow(ctx, roomStatsQuery, collegeID).Scan(&fullyOcc, &partOcc, &vacant)
	summary.OccupiedRooms = fullyOcc
	summary.PartiallyOccupied = partOcc
	summary.VacantRooms = vacant

	if summary.TotalBedCapacity > 0 {
		summary.OccupancyPercentage = float64(summary.OccupiedBeds) / float64(summary.TotalBedCapacity) * 100.0
	} else if summary.TotalBeds > 0 {
		summary.OccupancyPercentage = float64(summary.OccupiedBeds) / float64(summary.TotalBeds) * 100.0
	}

	return summary, nil
}

// GetHostelHierarchy fetches the entire structural hierarchy for a college (or single hostel).
func (r *Repository) GetHostelHierarchy(ctx context.Context, collegeID uuid.UUID, targetHostelID *uuid.UUID) ([]models.HierarchyHostel, error) {
	// 1. Fetch Hostels
	hostelQuery := `
		SELECT id, code, name, category, status, total_capacity
		FROM app.hostels
		WHERE college_id = $1
	`
	args := []interface{}{collegeID}
	if targetHostelID != nil && *targetHostelID != uuid.Nil {
		hostelQuery += " AND id = $2"
		args = append(args, *targetHostelID)
	}
	hostelQuery += " ORDER BY name ASC"

	rows, err := r.Executor(ctx).Query(ctx, hostelQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query hostels: %w", err)
	}
	defer rows.Close()

	hostelMap := make(map[uuid.UUID]*models.HierarchyHostel)
	hostelList := make([]*models.HierarchyHostel, 0)

	for rows.Next() {
		h := &models.HierarchyHostel{
			Blocks: make([]models.HierarchyBlock, 0),
		}
		if err := rows.Scan(&h.ID, &h.Code, &h.Name, &h.Category, &h.Status, &h.TotalCapacity); err != nil {
			return nil, fmt.Errorf("scan hostel error: %w", err)
		}
		hostelMap[h.ID] = h
		hostelList = append(hostelList, h)
	}

	if len(hostelList) == 0 {
		return []models.HierarchyHostel{}, nil
	}

	// 2. Fetch Blocks
	blockQuery := `
		SELECT id, hostel_id, code, name, status
		FROM app.blocks
		WHERE college_id = $1
		ORDER BY name ASC
	`
	bRows, err := r.Executor(ctx).Query(ctx, blockQuery, collegeID)
	if err != nil {
		return nil, fmt.Errorf("failed to query blocks: %w", err)
	}
	defer bRows.Close()

	blockMap := make(map[uuid.UUID]*models.HierarchyBlock)
	for bRows.Next() {
		var bID, hID uuid.UUID
		var code, name, status string
		if err := bRows.Scan(&bID, &hID, &code, &name, &status); err != nil {
			return nil, fmt.Errorf("scan block error: %w", err)
		}
		b := &models.HierarchyBlock{
			ID:     bID,
			Code:   code,
			Name:   name,
			Status: status,
			Floors: make([]models.HierarchyFloor, 0),
		}
		blockMap[bID] = b
		if hostel, exists := hostelMap[hID]; exists {
			hostel.Blocks = append(hostel.Blocks, *b)
		}
	}

	// 3. Fetch Floors
	floorQuery := `
		SELECT id, block_id, code, name, floor_number, status
		FROM app.floors
		WHERE college_id = $1
		ORDER BY floor_number ASC, name ASC
	`
	fRows, err := r.Executor(ctx).Query(ctx, floorQuery, collegeID)
	if err != nil {
		return nil, fmt.Errorf("failed to query floors: %w", err)
	}
	defer fRows.Close()

	floorMap := make(map[uuid.UUID]*models.HierarchyFloor)
	for fRows.Next() {
		var fID, bID uuid.UUID
		var code, name, status string
		var floorNum int
		if err := fRows.Scan(&fID, &bID, &code, &name, &floorNum, &status); err != nil {
			return nil, fmt.Errorf("scan floor error: %w", err)
		}
		f := &models.HierarchyFloor{
			ID:          fID,
			Code:        code,
			Name:        name,
			FloorNumber: floorNum,
			Status:      status,
			Rooms:       make([]models.HierarchyRoom, 0),
		}
		floorMap[fID] = f
		if block, exists := blockMap[bID]; exists {
			block.Floors = append(block.Floors, *f)
		}
	}

	// 4. Fetch Rooms
	roomQuery := `
		SELECT id, floor_id, code, name, room_type, capacity, status
		FROM app.rooms
		WHERE college_id = $1
		ORDER BY code ASC
	`
	rRows, err := r.Executor(ctx).Query(ctx, roomQuery, collegeID)
	if err != nil {
		return nil, fmt.Errorf("failed to query rooms: %w", err)
	}
	defer rRows.Close()

	roomMap := make(map[uuid.UUID]*models.HierarchyRoom)
	for rRows.Next() {
		var rID, fID uuid.UUID
		var code, name, rType, status string
		var cap int
		if err := rRows.Scan(&rID, &fID, &code, &name, &rType, &cap, &status); err != nil {
			return nil, fmt.Errorf("scan room error: %w", err)
		}
		r := &models.HierarchyRoom{
			ID:       rID,
			Code:     code,
			Name:     name,
			RoomType: rType,
			Capacity: cap,
			Status:   status,
			Beds:     make([]models.HierarchyBed, 0),
		}
		roomMap[rID] = r
		if floor, exists := floorMap[fID]; exists {
			floor.Rooms = append(floor.Rooms, *r)
		}
	}

	// 5. Fetch Beds and Active Allocation flag
	bedQuery := `
		SELECT b.id, b.room_id, b.code, b.name, b.status,
		       CASE WHEN ba.id IS NOT NULL THEN true ELSE false END AS is_occupied
		FROM app.beds b
		LEFT JOIN app.bed_allocations ba ON ba.bed_id = b.id AND ba.college_id = b.college_id AND ba.status = 'ACTIVE'
		WHERE b.college_id = $1
		ORDER BY b.code ASC
	`
	bedRows, err := r.Executor(ctx).Query(ctx, bedQuery, collegeID)
	if err != nil {
		return nil, fmt.Errorf("failed to query beds: %w", err)
	}
	defer bedRows.Close()

	for bedRows.Next() {
		var bedID, rID uuid.UUID
		var code, status string
		var name *string
		var isOcc bool
		if err := bedRows.Scan(&bedID, &rID, &code, &name, &status, &isOcc); err != nil {
			return nil, fmt.Errorf("scan bed error: %w", err)
		}
		bed := models.HierarchyBed{
			ID:         bedID,
			Code:       code,
			Name:       name,
			Status:     status,
			IsOccupied: isOcc,
		}
		if room, exists := roomMap[rID]; exists {
			room.Beds = append(room.Beds, bed)
			if isOcc {
				room.Occupied++
			} else if status == "AVAILABLE" {
				room.Available++
			}
		}
	}

	// Rebuild nested hierarchy with updated room counts
	res := make([]models.HierarchyHostel, 0, len(hostelList))
	for _, h := range hostelList {
		// Populate blocks with floors that have rooms with beds
		hCopy := *h
		hCopy.Blocks = make([]models.HierarchyBlock, 0)
		for _, b := range hostelMap[h.ID].Blocks {
			bCopy := b
			bCopy.Floors = make([]models.HierarchyFloor, 0)
			for _, f := range blockMap[b.ID].Floors {
				fCopy := f
				fCopy.Rooms = make([]models.HierarchyRoom, 0)
				for _, rm := range floorMap[f.ID].Rooms {
					rmCopy := *roomMap[rm.ID]
					fCopy.Rooms = append(fCopy.Rooms, rmCopy)
					if rmCopy.Status == "ACTIVE" {
						hCopy.ActiveRooms++
						if rmCopy.Occupied == 0 {
							hCopy.VacantRooms++
						}
					}
					hCopy.OccupiedBeds += rmCopy.Occupied
					hCopy.AvailableBeds += rmCopy.Available
				}
				bCopy.Floors = append(bCopy.Floors, fCopy)
			}
			hCopy.Blocks = append(hCopy.Blocks, bCopy)
		}
		// Check lock state
		hCopy.IsLocked = r.CheckHostelLockFast(ctx, collegeID, h.ID)
		res = append(res, hCopy)
	}

	return res, nil
}

// CheckHostelLockFast checks whether a specific hostel or the college structure is locked.
func (r *Repository) CheckHostelLockFast(ctx context.Context, collegeID, hostelID uuid.UUID) bool {
	// Check hostel specific lock
	hostelLockKey := fmt.Sprintf("%s%s", StructureLockKeyPrefix, hostelID.String())
	var raw []byte
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT setting_value FROM platform.college_settings
		WHERE college_id = $1 AND setting_key IN ($2, $3)
		ORDER BY setting_key DESC LIMIT 1
	`, collegeID, StructurePolicyKeyPrefix, hostelLockKey).Scan(&raw)
	if err == nil && len(raw) > 0 {
		var policy models.StructureEditPolicy
		if json.Unmarshal(raw, &policy) == nil && policy.IsLocked {
			return true
		}
	}
	return false
}

// --- Hostel CRUD ---

func (r *Repository) ListHostels(ctx context.Context, collegeID uuid.UUID) ([]models.Hostel, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT id, college_id, code, name, category, description, address, total_capacity, status, created_at, updated_at
		FROM app.hostels
		WHERE college_id = $1
		ORDER BY name ASC
	`, collegeID)
	if err != nil {
		return nil, fmt.Errorf("list hostels error: %w", err)
	}
	defer rows.Close()

	list := make([]models.Hostel, 0)
	for rows.Next() {
		var h models.Hostel
		if err := rows.Scan(&h.ID, &h.CollegeID, &h.Code, &h.Name, &h.Category, &h.Description, &h.Address, &h.TotalCapacity, &h.Status, &h.CreatedAt, &h.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, h)
	}
	return list, nil
}

func (r *Repository) GetHostel(ctx context.Context, collegeID, hostelID uuid.UUID) (*models.Hostel, error) {
	var h models.Hostel
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT id, college_id, code, name, category, description, address, total_capacity, status, created_at, updated_at
		FROM app.hostels
		WHERE college_id = $1 AND id = $2
	`, collegeID, hostelID).Scan(&h.ID, &h.CollegeID, &h.Code, &h.Name, &h.Category, &h.Description, &h.Address, &h.TotalCapacity, &h.Status, &h.CreatedAt, &h.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &h, nil
}

func (r *Repository) CreateHostel(ctx context.Context, h *models.Hostel) error {
	if h.ID == uuid.Nil {
		h.ID = uuid.New()
	}
	now := time.Now()
	h.CreatedAt = now
	h.UpdatedAt = now

	_, err := r.Executor(ctx).Exec(ctx, `
		INSERT INTO app.hostels (id, college_id, code, name, category, description, address, total_capacity, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, h.ID, h.CollegeID, h.Code, h.Name, h.Category, h.Description, h.Address, h.TotalCapacity, h.Status, h.CreatedAt, h.UpdatedAt)
	return err
}

func (r *Repository) UpdateHostel(ctx context.Context, h *models.Hostel) error {
	h.UpdatedAt = time.Now()
	_, err := r.Executor(ctx).Exec(ctx, `
		UPDATE app.hostels
		SET code = $3, name = $4, category = $5, description = $6, address = $7, total_capacity = $8, status = $9, updated_at = $10
		WHERE college_id = $1 AND id = $2
	`, h.CollegeID, h.ID, h.Code, h.Name, h.Category, h.Description, h.Address, h.TotalCapacity, h.Status, h.UpdatedAt)
	return err
}

func (r *Repository) DeleteHostel(ctx context.Context, collegeID, hostelID uuid.UUID) error {
	// Check for active bed allocations
	var activeAlloc int
	_ = r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*) FROM app.bed_allocations ba
		JOIN app.beds b ON b.id = ba.bed_id
		WHERE ba.college_id = $1 AND b.hostel_id = $2 AND ba.status = 'ACTIVE'
	`, collegeID, hostelID).Scan(&activeAlloc)
	if activeAlloc > 0 {
		return fmt.Errorf("cannot delete hostel with %d active student bed allocations; deactivate hostel instead", activeAlloc)
	}

	_, err := r.Executor(ctx).Exec(ctx, `
		DELETE FROM app.hostels WHERE college_id = $1 AND id = $2
	`, collegeID, hostelID)
	return err
}

// --- Block CRUD ---

func (r *Repository) ListBlocks(ctx context.Context, collegeID, hostelID uuid.UUID) ([]models.Block, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT id, college_id, hostel_id, code, name, description, total_capacity, status, created_at, updated_at
		FROM app.blocks
		WHERE college_id = $1 AND hostel_id = $2
		ORDER BY name ASC
	`, collegeID, hostelID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Block, 0)
	for rows.Next() {
		var b models.Block
		if err := rows.Scan(&b.ID, &b.CollegeID, &b.HostelID, &b.Code, &b.Name, &b.Description, &b.TotalCapacity, &b.Status, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	return list, nil
}

func (r *Repository) GetBlock(ctx context.Context, collegeID, blockID uuid.UUID) (*models.Block, error) {
	var b models.Block
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT id, college_id, hostel_id, code, name, description, total_capacity, status, created_at, updated_at
		FROM app.blocks
		WHERE college_id = $1 AND id = $2
	`, collegeID, blockID).Scan(&b.ID, &b.CollegeID, &b.HostelID, &b.Code, &b.Name, &b.Description, &b.TotalCapacity, &b.Status, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *Repository) CreateBlock(ctx context.Context, b *models.Block) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	now := time.Now()
	b.CreatedAt = now
	b.UpdatedAt = now

	_, err := r.Executor(ctx).Exec(ctx, `
		INSERT INTO app.blocks (id, college_id, hostel_id, code, name, description, total_capacity, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, b.ID, b.CollegeID, b.HostelID, b.Code, b.Name, b.Description, b.TotalCapacity, b.Status, b.CreatedAt, b.UpdatedAt)
	return err
}

func (r *Repository) UpdateBlock(ctx context.Context, b *models.Block) error {
	b.UpdatedAt = time.Now()
	_, err := r.Executor(ctx).Exec(ctx, `
		UPDATE app.blocks
		SET code = $3, name = $4, description = $5, total_capacity = $6, status = $7, updated_at = $8
		WHERE college_id = $1 AND id = $2
	`, b.CollegeID, b.ID, b.Code, b.Name, b.Description, b.TotalCapacity, b.Status, b.UpdatedAt)
	return err
}

func (r *Repository) DeleteBlock(ctx context.Context, collegeID, blockID uuid.UUID) error {
	_, err := r.Executor(ctx).Exec(ctx, `
		DELETE FROM app.blocks WHERE college_id = $1 AND id = $2
	`, collegeID, blockID)
	return err
}

// --- Floor CRUD ---

func (r *Repository) ListFloors(ctx context.Context, collegeID, blockID uuid.UUID) ([]models.Floor, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT id, college_id, hostel_id, block_id, code, name, floor_number, description, total_capacity, status, created_at, updated_at
		FROM app.floors
		WHERE college_id = $1 AND block_id = $2
		ORDER BY floor_number ASC, name ASC
	`, collegeID, blockID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Floor, 0)
	for rows.Next() {
		var f models.Floor
		if err := rows.Scan(&f.ID, &f.CollegeID, &f.HostelID, &f.BlockID, &f.Code, &f.Name, &f.FloorNumber, &f.Description, &f.TotalCapacity, &f.Status, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, f)
	}
	return list, nil
}

func (r *Repository) GetFloor(ctx context.Context, collegeID, floorID uuid.UUID) (*models.Floor, error) {
	var f models.Floor
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT id, college_id, hostel_id, block_id, code, name, floor_number, description, total_capacity, status, created_at, updated_at
		FROM app.floors
		WHERE college_id = $1 AND id = $2
	`, collegeID, floorID).Scan(&f.ID, &f.CollegeID, &f.HostelID, &f.BlockID, &f.Code, &f.Name, &f.FloorNumber, &f.Description, &f.TotalCapacity, &f.Status, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &f, nil
}

func (r *Repository) CreateFloor(ctx context.Context, f *models.Floor) error {
	if f.ID == uuid.Nil {
		f.ID = uuid.New()
	}
	now := time.Now()
	f.CreatedAt = now
	f.UpdatedAt = now

	_, err := r.Executor(ctx).Exec(ctx, `
		INSERT INTO app.floors (id, college_id, hostel_id, block_id, code, name, floor_number, description, total_capacity, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, f.ID, f.CollegeID, f.HostelID, f.BlockID, f.Code, f.Name, f.FloorNumber, f.Description, f.TotalCapacity, f.Status, f.CreatedAt, f.UpdatedAt)
	return err
}

func (r *Repository) UpdateFloor(ctx context.Context, f *models.Floor) error {
	f.UpdatedAt = time.Now()
	_, err := r.Executor(ctx).Exec(ctx, `
		UPDATE app.floors
		SET code = $3, name = $4, floor_number = $5, description = $6, total_capacity = $7, status = $8, updated_at = $9
		WHERE college_id = $1 AND id = $2
	`, f.CollegeID, f.ID, f.Code, f.Name, f.FloorNumber, f.Description, f.TotalCapacity, f.Status, f.UpdatedAt)
	return err
}

func (r *Repository) DeleteFloor(ctx context.Context, collegeID, floorID uuid.UUID) error {
	_, err := r.Executor(ctx).Exec(ctx, `
		DELETE FROM app.floors WHERE college_id = $1 AND id = $2
	`, collegeID, floorID)
	return err
}

// --- Room CRUD ---

func (r *Repository) ListRooms(ctx context.Context, collegeID, floorID uuid.UUID) ([]models.Room, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT id, college_id, hostel_id, block_id, floor_id, code, name, room_type, capacity, description, status, created_at, updated_at
		FROM app.rooms
		WHERE college_id = $1 AND floor_id = $2
		ORDER BY code ASC
	`, collegeID, floorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Room, 0)
	for rows.Next() {
		var rm models.Room
		if err := rows.Scan(&rm.ID, &rm.CollegeID, &rm.HostelID, &rm.BlockID, &rm.FloorID, &rm.Code, &rm.Name, &rm.RoomType, &rm.Capacity, &rm.Description, &rm.Status, &rm.CreatedAt, &rm.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, rm)
	}
	return list, nil
}

func (r *Repository) GetRoom(ctx context.Context, collegeID, roomID uuid.UUID) (*models.Room, error) {
	var rm models.Room
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT id, college_id, hostel_id, block_id, floor_id, code, name, room_type, capacity, description, status, created_at, updated_at
		FROM app.rooms
		WHERE college_id = $1 AND id = $2
	`, collegeID, roomID).Scan(&rm.ID, &rm.CollegeID, &rm.HostelID, &rm.BlockID, &rm.FloorID, &rm.Code, &rm.Name, &rm.RoomType, &rm.Capacity, &rm.Description, &rm.Status, &rm.CreatedAt, &rm.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &rm, nil
}

func (r *Repository) CreateRoom(ctx context.Context, rm *models.Room) error {
	if rm.ID == uuid.Nil {
		rm.ID = uuid.New()
	}
	now := time.Now()
	rm.CreatedAt = now
	rm.UpdatedAt = now

	_, err := r.Executor(ctx).Exec(ctx, `
		INSERT INTO app.rooms (id, college_id, hostel_id, block_id, floor_id, code, name, room_type, capacity, description, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`, rm.ID, rm.CollegeID, rm.HostelID, rm.BlockID, rm.FloorID, rm.Code, rm.Name, rm.RoomType, rm.Capacity, rm.Description, rm.Status, rm.CreatedAt, rm.UpdatedAt)
	return err
}

func (r *Repository) UpdateRoom(ctx context.Context, rm *models.Room) error {
	rm.UpdatedAt = time.Now()
	_, err := r.Executor(ctx).Exec(ctx, `
		UPDATE app.rooms
		SET code = $3, name = $4, room_type = $5, capacity = $6, description = $7, status = $8, updated_at = $9
		WHERE college_id = $1 AND id = $2
	`, rm.CollegeID, rm.ID, rm.Code, rm.Name, rm.RoomType, rm.Capacity, rm.Description, rm.Status, rm.UpdatedAt)
	return err
}

func (r *Repository) DeleteRoom(ctx context.Context, collegeID, roomID uuid.UUID) error {
	_, err := r.Executor(ctx).Exec(ctx, `
		DELETE FROM app.rooms WHERE college_id = $1 AND id = $2
	`, collegeID, roomID)
	return err
}

// --- Bed CRUD ---

func (r *Repository) ListBeds(ctx context.Context, collegeID, roomID uuid.UUID) ([]models.Bed, error) {
	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT id, college_id, hostel_id, block_id, floor_id, room_id, code, name, status, created_at, updated_at
		FROM app.beds
		WHERE college_id = $1 AND room_id = $2
		ORDER BY code ASC
	`, collegeID, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]models.Bed, 0)
	for rows.Next() {
		var b models.Bed
		if err := rows.Scan(&b.ID, &b.CollegeID, &b.HostelID, &b.BlockID, &b.FloorID, &b.RoomID, &b.Code, &b.Name, &b.Status, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	return list, nil
}

func (r *Repository) GetBed(ctx context.Context, collegeID, bedID uuid.UUID) (*models.Bed, error) {
	var b models.Bed
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT id, college_id, hostel_id, block_id, floor_id, room_id, code, name, status, created_at, updated_at
		FROM app.beds
		WHERE college_id = $1 AND id = $2
	`, collegeID, bedID).Scan(&b.ID, &b.CollegeID, &b.HostelID, &b.BlockID, &b.FloorID, &b.RoomID, &b.Code, &b.Name, &b.Status, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &b, nil
}

func (r *Repository) CreateBed(ctx context.Context, b *models.Bed) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	now := time.Now()
	b.CreatedAt = now
	b.UpdatedAt = now

	_, err := r.Executor(ctx).Exec(ctx, `
		INSERT INTO app.beds (id, college_id, hostel_id, block_id, floor_id, room_id, code, name, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, b.ID, b.CollegeID, b.HostelID, b.BlockID, b.FloorID, b.RoomID, b.Code, b.Name, b.Status, b.CreatedAt, b.UpdatedAt)
	return err
}

func (r *Repository) UpdateBed(ctx context.Context, b *models.Bed) error {
	b.UpdatedAt = time.Now()
	_, err := r.Executor(ctx).Exec(ctx, `
		UPDATE app.beds
		SET code = $3, name = $4, status = $5, updated_at = $6
		WHERE college_id = $1 AND id = $2
	`, b.CollegeID, b.ID, b.Code, b.Name, b.Status, b.UpdatedAt)
	return err
}

func (r *Repository) DeleteBed(ctx context.Context, collegeID, bedID uuid.UUID) error {
	_, err := r.Executor(ctx).Exec(ctx, `
		DELETE FROM app.beds WHERE college_id = $1 AND id = $2
	`, collegeID, bedID)
	return err
}

// --- Policy & Locking ---

func (r *Repository) GetStructurePolicy(ctx context.Context, collegeID uuid.UUID) (*models.StructureEditPolicy, error) {
	var raw []byte
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT setting_value FROM platform.college_settings
		WHERE college_id = $1 AND setting_key = $2
	`, collegeID, StructurePolicyKeyPrefix).Scan(&raw)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Return default policy
			return &models.StructureEditPolicy{
				AllowBulkGeneration:      true,
				AllowCSVImport:           true,
				AllowCloning:             true,
				PreventOccupiedMod:       true,
				IsLocked:                 false,
				RequireApprovalForDelete: false,
				UpdatedAt:                time.Now(),
			}, nil
		}
		return nil, err
	}

	var p models.StructureEditPolicy
	if err := json.Unmarshal(raw, &p); err != nil {
		return nil, fmt.Errorf("unmarshal policy error: %w", err)
	}
	return &p, nil
}

func (r *Repository) SaveStructurePolicy(ctx context.Context, collegeID uuid.UUID, p *models.StructureEditPolicy) error {
	p.UpdatedAt = time.Now()
	bytes, err := json.Marshal(p)
	if err != nil {
		return err
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.college_settings (college_id, setting_key, setting_value, updated_at)
		VALUES ($1, $2, $3::jsonb, $4)
		ON CONFLICT (college_id, setting_key)
		DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = EXCLUDED.updated_at
	`, collegeID, StructurePolicyKeyPrefix, bytes, p.UpdatedAt)
	return err
}

func (r *Repository) SetHostelLock(ctx context.Context, collegeID uuid.UUID, hostelID *uuid.UUID, locked bool, actorID uuid.UUID, reason string) error {
	now := time.Now()
	if hostelID == nil || *hostelID == uuid.Nil {
		// College-wide policy lock
		p, err := r.GetStructurePolicy(ctx, collegeID)
		if err != nil {
			return err
		}
		p.IsLocked = locked
		if locked {
			p.LockedBy = &actorID
			p.LockedAt = &now
			p.LockReason = reason
		} else {
			p.LockedBy = nil
			p.LockedAt = nil
			p.LockReason = ""
		}
		return r.SaveStructurePolicy(ctx, collegeID, p)
	}

	// Specific hostel lock setting
	key := fmt.Sprintf("%s%s", StructureLockKeyPrefix, hostelID.String())
	payload := models.StructureEditPolicy{
		IsLocked:   locked,
		LockedBy:   &actorID,
		LockedAt:   &now,
		LockReason: reason,
		UpdatedAt:  now,
	}
	bytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.college_settings (college_id, setting_key, setting_value, updated_at)
		VALUES ($1, $2, $3::jsonb, $4)
		ON CONFLICT (college_id, setting_key)
		DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = EXCLUDED.updated_at
	`, collegeID, key, bytes, now)
	return err
}

// --- Audit Logging ---

func (r *Repository) RecordStructureAudit(
	ctx context.Context,
	collegeID uuid.UUID,
	actorID uuid.UUID,
	actorRole string,
	action string,
	entityType string,
	entityID uuid.UUID,
	oldData interface{},
	newData interface{},
	reason string,
) error {
	var oldBytes, newBytes []byte
	var err error
	if oldData != nil {
		oldBytes, _ = json.Marshal(oldData)
	}
	if newData != nil {
		newBytes, _ = json.Marshal(newData)
	}

	_, err = r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.audit_logs (
			audit_id, college_id, actor_user_id, actor_role, module, action,
			entity_type, entity_id, old_data, new_data, reason, created_at, severity
		)
		VALUES (
			$1, $2, $3, $4, 'hostel_structure', $5,
			$6, $7, $8::jsonb, $9::jsonb, $10, NOW(), 'INFO'
		)
	`, uuid.New(), collegeID, actorID, actorRole, action, entityType, entityID, string(oldBytes), string(newBytes), reason)
	return err
}

// ListStructureAudits returns the most recent hostel structure audit entries.
func (r *Repository) ListStructureAudits(ctx context.Context, collegeID uuid.UUID, limit int) ([]map[string]interface{}, error) {
	if limit <= 0 || limit > 100 {
		limit = 30
	}

	rows, err := r.Executor(ctx).Query(ctx, `
		SELECT audit_id, actor_user_id, actor_role, action, entity_type, entity_id,
		       old_data, new_data, reason, created_at
		FROM platform.audit_logs
		WHERE college_id = $1 AND module = 'hostel_structure'
		ORDER BY created_at DESC
		LIMIT $2
	`, collegeID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]map[string]interface{}, 0)
	for rows.Next() {
		var auditID, actorID, entityID uuid.UUID
		var actorRole, action, entityType string
		var oldData, newData []byte
		var reason *string
		var createdAt time.Time

		if err := rows.Scan(&auditID, &actorID, &actorRole, &action, &entityType, &entityID, &oldData, &newData, &reason, &createdAt); err != nil {
			return nil, err
		}

		item := map[string]interface{}{
			"audit_id":      auditID,
			"actor_user_id": actorID,
			"actor_role":    actorRole,
			"action":        action,
			"entity_type":   entityType,
			"entity_id":     entityID,
			"created_at":    createdAt,
		}
		if reason != nil {
			item["reason"] = *reason
		}
		if len(oldData) > 0 {
			var o interface{}
			_ = json.Unmarshal(oldData, &o)
			item["old_data"] = o
		}
		if len(newData) > 0 {
			var n interface{}
			_ = json.Unmarshal(newData, &n)
			item["new_data"] = n
		}
		list = append(list, item)
	}
	return list, nil
}
