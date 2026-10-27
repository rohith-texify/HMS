package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

var (
	validCategories = map[string]bool{
		"BOYS":  true,
		"GIRLS": true,
		"MIXED": true,
		"OTHER": true,
	}

	validRoomTypes = map[string]bool{
		"STANDARD":  true,
		"SINGLE":    true,
		"DOUBLE":    true,
		"TRIPLE":    true,
		"DORMITORY": true,
		"SPECIAL":   true,
	}

	validEntityStatuses = map[string]bool{
		"ACTIVE":      true,
		"INACTIVE":    true,
		"MAINTENANCE": true,
	}

	validBedStatuses = map[string]bool{
		"AVAILABLE":   true,
		"OCCUPIED":    true,
		"RESERVED":    true,
		"MAINTENANCE": true,
		"INACTIVE":    true,
	}
)

type HostelStructureService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewHostelStructureService(db *database.Database, repo *repository.Repository) *HostelStructureService {
	return &HostelStructureService{
		db:   db,
		repo: repo,
	}
}

// checkLock verifies whether writes to the target hostel (or entire college) are blocked.
func (s *HostelStructureService) checkLock(ctx context.Context, collegeID uuid.UUID, hostelID *uuid.UUID) error {
	policy, err := s.repo.GetStructurePolicy(ctx, collegeID)
	if err == nil && policy.IsLocked {
		reason := "Hostel structure modifications are currently locked for this college"
		if policy.LockReason != "" {
			reason += ": " + policy.LockReason
		}
		return apierrors.New(apierrors.Conflict, reason)
	}

	if hostelID != nil && *hostelID != uuid.Nil {
		if s.repo.CheckHostelLockFast(ctx, collegeID, *hostelID) {
			return apierrors.New(apierrors.Conflict, "This hostel is locked against structural modifications")
		}
	}
	return nil
}

// --- Overview & Hierarchy ---

func (s *HostelStructureService) GetOverview(ctx context.Context, collegeID uuid.UUID) (*models.OccupancySummary, error) {
	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "college ID is required")
	}
	return s.repo.GetStructureOverview(ctx, collegeID)
}

func (s *HostelStructureService) GetHierarchy(ctx context.Context, collegeID uuid.UUID, hostelID *uuid.UUID) ([]models.HierarchyHostel, error) {
	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "college ID is required")
	}
	return s.repo.GetHostelHierarchy(ctx, collegeID, hostelID)
}

// --- Hostel Operations ---

func (s *HostelStructureService) CreateHostel(ctx context.Context, collegeID uuid.UUID, h *models.Hostel, actorID uuid.UUID, actorRole string) (*models.Hostel, error) {
	if err := s.checkLock(ctx, collegeID, nil); err != nil {
		return nil, err
	}

	h.Code = strings.ToUpper(strings.TrimSpace(h.Code))
	h.Name = strings.TrimSpace(h.Name)
	h.Category = strings.ToUpper(strings.TrimSpace(h.Category))

	if h.Code == "" || h.Name == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Hostel code and name are required")
	}
	if !validCategories[h.Category] {
		return nil, apierrors.New(apierrors.ValidationError, fmt.Sprintf("Invalid category '%s'. Must be BOYS, GIRLS, MIXED, or OTHER", h.Category))
	}
	if h.Status == "" {
		h.Status = "ACTIVE"
	}
	if !validEntityStatuses[h.Status] {
		return nil, apierrors.New(apierrors.ValidationError, "Invalid hostel status")
	}

	h.CollegeID = collegeID
	if err := s.repo.CreateHostel(ctx, h); err != nil {
		return nil, fmt.Errorf("failed to create hostel: %w", err)
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "CREATE_HOSTEL", "hostel", h.ID, nil, h, "Created physical hostel")
	return h, nil
}

func (s *HostelStructureService) UpdateHostel(ctx context.Context, collegeID, hostelID uuid.UUID, h *models.Hostel, actorID uuid.UUID, actorRole string) (*models.Hostel, error) {
	if err := s.checkLock(ctx, collegeID, &hostelID); err != nil {
		return nil, err
	}

	existing, err := s.repo.GetHostel(ctx, collegeID, hostelID)
	if err != nil || existing == nil {
		return nil, apierrors.New(apierrors.NotFound, "Hostel not found")
	}

	h.Code = strings.ToUpper(strings.TrimSpace(h.Code))
	h.Name = strings.TrimSpace(h.Name)
	h.Category = strings.ToUpper(strings.TrimSpace(h.Category))

	if h.Code == "" || h.Name == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Hostel code and name are required")
	}
	if !validCategories[h.Category] {
		return nil, apierrors.New(apierrors.ValidationError, "Invalid category")
	}
	if !validEntityStatuses[h.Status] {
		return nil, apierrors.New(apierrors.ValidationError, "Invalid status")
	}

	h.ID = hostelID
	h.CollegeID = collegeID
	if err := s.repo.UpdateHostel(ctx, h); err != nil {
		return nil, err
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "UPDATE_HOSTEL", "hostel", hostelID, existing, h, "Updated hostel metadata")
	return h, nil
}

func (s *HostelStructureService) DeleteHostel(ctx context.Context, collegeID, hostelID uuid.UUID, actorID uuid.UUID, actorRole string) error {
	if err := s.checkLock(ctx, collegeID, &hostelID); err != nil {
		return err
	}

	existing, err := s.repo.GetHostel(ctx, collegeID, hostelID)
	if err != nil || existing == nil {
		return apierrors.New(apierrors.NotFound, "Hostel not found")
	}

	if err := s.repo.DeleteHostel(ctx, collegeID, hostelID); err != nil {
		return apierrors.New(apierrors.Conflict, err.Error())
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "DELETE_HOSTEL", "hostel", hostelID, existing, nil, "Deleted physical hostel")
	return nil
}

// --- Block Operations ---

func (s *HostelStructureService) CreateBlock(ctx context.Context, collegeID uuid.UUID, b *models.Block, actorID uuid.UUID, actorRole string) (*models.Block, error) {
	if err := s.checkLock(ctx, collegeID, &b.HostelID); err != nil {
		return nil, err
	}

	b.Code = strings.ToUpper(strings.TrimSpace(b.Code))
	b.Name = strings.TrimSpace(b.Name)
	if b.Code == "" || b.Name == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Block code and name are required")
	}
	if b.Status == "" {
		b.Status = "ACTIVE"
	}
	if !validEntityStatuses[b.Status] {
		return nil, apierrors.New(apierrors.ValidationError, "Invalid block status")
	}

	b.CollegeID = collegeID
	if err := s.repo.CreateBlock(ctx, b); err != nil {
		return nil, fmt.Errorf("failed to create block: %w", err)
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "CREATE_BLOCK", "block", b.ID, nil, b, "Created block")
	return b, nil
}

func (s *HostelStructureService) UpdateBlock(ctx context.Context, collegeID, blockID uuid.UUID, b *models.Block, actorID uuid.UUID, actorRole string) (*models.Block, error) {
	existing, err := s.repo.GetBlock(ctx, collegeID, blockID)
	if err != nil || existing == nil {
		return nil, apierrors.New(apierrors.NotFound, "Block not found")
	}

	if err := s.checkLock(ctx, collegeID, &existing.HostelID); err != nil {
		return nil, err
	}

	b.Code = strings.ToUpper(strings.TrimSpace(b.Code))
	b.Name = strings.TrimSpace(b.Name)
	if b.Code == "" || b.Name == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Block code and name are required")
	}

	b.ID = blockID
	b.CollegeID = collegeID
	b.HostelID = existing.HostelID
	if err := s.repo.UpdateBlock(ctx, b); err != nil {
		return nil, err
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "UPDATE_BLOCK", "block", blockID, existing, b, "Updated block")
	return b, nil
}

func (s *HostelStructureService) DeleteBlock(ctx context.Context, collegeID, blockID uuid.UUID, actorID uuid.UUID, actorRole string) error {
	existing, err := s.repo.GetBlock(ctx, collegeID, blockID)
	if err != nil || existing == nil {
		return apierrors.New(apierrors.NotFound, "Block not found")
	}

	if err := s.checkLock(ctx, collegeID, &existing.HostelID); err != nil {
		return err
	}

	if err := s.repo.DeleteBlock(ctx, collegeID, blockID); err != nil {
		return apierrors.New(apierrors.Conflict, "Cannot delete block with associated floors or rooms")
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "DELETE_BLOCK", "block", blockID, existing, nil, "Deleted block")
	return nil
}

// --- Floor Operations ---

func (s *HostelStructureService) CreateFloor(ctx context.Context, collegeID uuid.UUID, f *models.Floor, actorID uuid.UUID, actorRole string) (*models.Floor, error) {
	block, err := s.repo.GetBlock(ctx, collegeID, f.BlockID)
	if err != nil || block == nil {
		return nil, apierrors.New(apierrors.NotFound, "Parent block not found")
	}

	if err := s.checkLock(ctx, collegeID, &block.HostelID); err != nil {
		return nil, err
	}

	f.Code = strings.ToUpper(strings.TrimSpace(f.Code))
	f.Name = strings.TrimSpace(f.Name)
	if f.Code == "" || f.Name == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Floor code and name are required")
	}
	if f.FloorNumber < 0 {
		return nil, apierrors.New(apierrors.ValidationError, "Floor number cannot be negative")
	}
	if f.Status == "" {
		f.Status = "ACTIVE"
	}

	f.CollegeID = collegeID
	f.HostelID = block.HostelID
	if err := s.repo.CreateFloor(ctx, f); err != nil {
		return nil, fmt.Errorf("failed to create floor: %w", err)
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "CREATE_FLOOR", "floor", f.ID, nil, f, "Created floor")
	return f, nil
}

func (s *HostelStructureService) UpdateFloor(ctx context.Context, collegeID, floorID uuid.UUID, f *models.Floor, actorID uuid.UUID, actorRole string) (*models.Floor, error) {
	existing, err := s.repo.GetFloor(ctx, collegeID, floorID)
	if err != nil || existing == nil {
		return nil, apierrors.New(apierrors.NotFound, "Floor not found")
	}

	if err := s.checkLock(ctx, collegeID, &existing.HostelID); err != nil {
		return nil, err
	}

	f.Code = strings.ToUpper(strings.TrimSpace(f.Code))
	f.Name = strings.TrimSpace(f.Name)
	if f.Code == "" || f.Name == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Floor code and name are required")
	}

	f.ID = floorID
	f.CollegeID = collegeID
	if err := s.repo.UpdateFloor(ctx, f); err != nil {
		return nil, err
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "UPDATE_FLOOR", "floor", floorID, existing, f, "Updated floor")
	return f, nil
}

func (s *HostelStructureService) DeleteFloor(ctx context.Context, collegeID, floorID uuid.UUID, actorID uuid.UUID, actorRole string) error {
	existing, err := s.repo.GetFloor(ctx, collegeID, floorID)
	if err != nil || existing == nil {
		return apierrors.New(apierrors.NotFound, "Floor not found")
	}

	if err := s.checkLock(ctx, collegeID, &existing.HostelID); err != nil {
		return err
	}

	if err := s.repo.DeleteFloor(ctx, collegeID, floorID); err != nil {
		return apierrors.New(apierrors.Conflict, "Cannot delete floor with associated rooms")
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "DELETE_FLOOR", "floor", floorID, existing, nil, "Deleted floor")
	return nil
}

// --- Room Operations ---

func (s *HostelStructureService) CreateRoom(ctx context.Context, collegeID uuid.UUID, rm *models.Room, actorID uuid.UUID, actorRole string) (*models.Room, error) {
	floor, err := s.repo.GetFloor(ctx, collegeID, rm.FloorID)
	if err != nil || floor == nil {
		return nil, apierrors.New(apierrors.NotFound, "Parent floor not found")
	}

	if err := s.checkLock(ctx, collegeID, &floor.HostelID); err != nil {
		return nil, err
	}

	rm.Code = strings.ToUpper(strings.TrimSpace(rm.Code))
	rm.Name = strings.TrimSpace(rm.Name)
	rm.RoomType = strings.ToUpper(strings.TrimSpace(rm.RoomType))

	if rm.Code == "" || rm.Name == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Room code and name are required")
	}
	if !validRoomTypes[rm.RoomType] {
		return nil, apierrors.New(apierrors.ValidationError, fmt.Sprintf("Invalid room type '%s'", rm.RoomType))
	}
	if rm.Capacity < 0 {
		return nil, apierrors.New(apierrors.ValidationError, "Capacity cannot be negative")
	}
	if rm.Status == "" {
		rm.Status = "ACTIVE"
	}

	rm.CollegeID = collegeID
	rm.HostelID = floor.HostelID
	rm.BlockID = floor.BlockID
	if err := s.repo.CreateRoom(ctx, rm); err != nil {
		return nil, fmt.Errorf("failed to create room: %w", err)
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "CREATE_ROOM", "room", rm.ID, nil, rm, "Created room")
	return rm, nil
}

func (s *HostelStructureService) UpdateRoom(ctx context.Context, collegeID, roomID uuid.UUID, rm *models.Room, actorID uuid.UUID, actorRole string) (*models.Room, error) {
	existing, err := s.repo.GetRoom(ctx, collegeID, roomID)
	if err != nil || existing == nil {
		return nil, apierrors.New(apierrors.NotFound, "Room not found")
	}

	if err := s.checkLock(ctx, collegeID, &existing.HostelID); err != nil {
		return nil, err
	}

	// If policy prevents modifying occupied rooms, verify active allocations
	policy, _ := s.repo.GetStructurePolicy(ctx, collegeID)
	if policy != nil && policy.PreventOccupiedMod {
		var activeAlloc int
		_ = s.db.GetPlatformPool().QueryRow(ctx, `
			SELECT COUNT(*) FROM app.bed_allocations ba
			JOIN app.beds b ON b.id = ba.bed_id
			WHERE ba.college_id = $1 AND b.room_id = $2 AND ba.status = 'ACTIVE'
		`, collegeID, roomID).Scan(&activeAlloc)
		if activeAlloc > 0 && rm.Capacity < activeAlloc {
			return nil, apierrors.New(apierrors.Conflict, fmt.Sprintf("Cannot reduce room capacity below current active bed allocations (%d)", activeAlloc))
		}
	}

	rm.Code = strings.ToUpper(strings.TrimSpace(rm.Code))
	rm.Name = strings.TrimSpace(rm.Name)
	rm.RoomType = strings.ToUpper(strings.TrimSpace(rm.RoomType))

	if rm.Code == "" || rm.Name == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Room code and name are required")
	}
	if !validRoomTypes[rm.RoomType] {
		return nil, apierrors.New(apierrors.ValidationError, "Invalid room type")
	}
	if rm.Capacity < 0 {
		return nil, apierrors.New(apierrors.ValidationError, "Capacity cannot be negative")
	}

	rm.ID = roomID
	rm.CollegeID = collegeID
	if err := s.repo.UpdateRoom(ctx, rm); err != nil {
		return nil, err
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "UPDATE_ROOM", "room", roomID, existing, rm, "Updated room")
	return rm, nil
}

func (s *HostelStructureService) DeleteRoom(ctx context.Context, collegeID, roomID uuid.UUID, actorID uuid.UUID, actorRole string) error {
	existing, err := s.repo.GetRoom(ctx, collegeID, roomID)
	if err != nil || existing == nil {
		return apierrors.New(apierrors.NotFound, "Room not found")
	}

	if err := s.checkLock(ctx, collegeID, &existing.HostelID); err != nil {
		return err
	}

	if err := s.repo.DeleteRoom(ctx, collegeID, roomID); err != nil {
		return apierrors.New(apierrors.Conflict, "Cannot delete room with assigned beds or active allocations")
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "DELETE_ROOM", "room", roomID, existing, nil, "Deleted room")
	return nil
}

// --- Bed Operations ---

func (s *HostelStructureService) CreateBed(ctx context.Context, collegeID uuid.UUID, b *models.Bed, actorID uuid.UUID, actorRole string) (*models.Bed, error) {
	room, err := s.repo.GetRoom(ctx, collegeID, b.RoomID)
	if err != nil || room == nil {
		return nil, apierrors.New(apierrors.NotFound, "Parent room not found")
	}

	if err := s.checkLock(ctx, collegeID, &room.HostelID); err != nil {
		return nil, err
	}

	b.Code = strings.ToUpper(strings.TrimSpace(b.Code))
	if b.Code == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Bed code is required")
	}
	if b.Status == "" {
		b.Status = "AVAILABLE"
	}
	if !validBedStatuses[b.Status] {
		return nil, apierrors.New(apierrors.ValidationError, fmt.Sprintf("Invalid bed status '%s'", b.Status))
	}

	b.CollegeID = collegeID
	b.HostelID = room.HostelID
	b.BlockID = room.BlockID
	b.FloorID = room.FloorID
	if err := s.repo.CreateBed(ctx, b); err != nil {
		return nil, fmt.Errorf("failed to create bed: %w", err)
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "CREATE_BED", "bed", b.ID, nil, b, "Created physical bed")
	return b, nil
}

func (s *HostelStructureService) UpdateBed(ctx context.Context, collegeID, bedID uuid.UUID, b *models.Bed, actorID uuid.UUID, actorRole string) (*models.Bed, error) {
	existing, err := s.repo.GetBed(ctx, collegeID, bedID)
	if err != nil || existing == nil {
		return nil, apierrors.New(apierrors.NotFound, "Bed not found")
	}

	if err := s.checkLock(ctx, collegeID, &existing.HostelID); err != nil {
		return nil, err
	}

	b.Code = strings.ToUpper(strings.TrimSpace(b.Code))
	if b.Code == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Bed code is required")
	}
	if !validBedStatuses[b.Status] {
		return nil, apierrors.New(apierrors.ValidationError, "Invalid bed status")
	}

	b.ID = bedID
	b.CollegeID = collegeID
	if err := s.repo.UpdateBed(ctx, b); err != nil {
		return nil, err
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "UPDATE_BED", "bed", bedID, existing, b, "Updated bed")
	return b, nil
}

func (s *HostelStructureService) DeleteBed(ctx context.Context, collegeID, bedID uuid.UUID, actorID uuid.UUID, actorRole string) error {
	existing, err := s.repo.GetBed(ctx, collegeID, bedID)
	if err != nil || existing == nil {
		return apierrors.New(apierrors.NotFound, "Bed not found")
	}

	if err := s.checkLock(ctx, collegeID, &existing.HostelID); err != nil {
		return err
	}

	if err := s.repo.DeleteBed(ctx, collegeID, bedID); err != nil {
		return apierrors.New(apierrors.Conflict, "Cannot delete bed with existing allocation or history")
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "DELETE_BED", "bed", bedID, existing, nil, "Deleted bed")
	return nil
}

// --- Bulk Structure Generation ---

func (s *HostelStructureService) ValidateAndPreviewBulk(ctx context.Context, collegeID uuid.UUID, input *models.BulkGenerationInput) (*models.BulkGenerationPreview, error) {
	if input.FloorCount <= 0 || input.FloorCount > 50 {
		return nil, apierrors.New(apierrors.ValidationError, "Floor count must be between 1 and 50")
	}
	if input.RoomsPerFloor <= 0 || input.RoomsPerFloor > 100 {
		return nil, apierrors.New(apierrors.ValidationError, "Rooms per floor must be between 1 and 100")
	}
	if input.RoomCapacity <= 0 || input.RoomCapacity > 20 {
		return nil, apierrors.New(apierrors.ValidationError, "Room capacity must be between 1 and 20")
	}
	if input.RoomType == "" {
		input.RoomType = "STANDARD"
	}
	if !validRoomTypes[strings.ToUpper(input.RoomType)] {
		return nil, apierrors.New(apierrors.ValidationError, "Invalid room type")
	}

	hostel, err := s.repo.GetHostel(ctx, collegeID, input.HostelID)
	if err != nil || hostel == nil {
		return nil, apierrors.New(apierrors.NotFound, "Target hostel not found")
	}

	targetBlockName := "Main Building"
	if input.BlockID != nil && *input.BlockID != uuid.Nil {
		b, err := s.repo.GetBlock(ctx, collegeID, *input.BlockID)
		if err != nil || b == nil {
			return nil, apierrors.New(apierrors.NotFound, "Selected block not found")
		}
		targetBlockName = b.Name
	} else if strings.TrimSpace(input.BlockName) != "" {
		targetBlockName = strings.TrimSpace(input.BlockName)
	}

	totalRooms := input.FloorCount * input.RoomsPerFloor
	totalBeds := 0
	if input.GenerateBeds {
		totalBeds = totalRooms * input.RoomCapacity
	}

	sampleRooms := make([]string, 0, 5)
	sampleBeds := make([]string, 0, 5)

	startFloor := input.StartingFloor
	if startFloor < 0 {
		startFloor = 0
	}

	for f := 0; f < input.FloorCount && f < 2; f++ {
		floorNum := startFloor + f
		for r := 1; r <= input.RoomsPerFloor && r <= 3; r++ {
			rCode := fmt.Sprintf("%d%02d", floorNum, r)
			sampleRooms = append(sampleRooms, rCode)
			if input.GenerateBeds {
				for b := 0; b < input.RoomCapacity && b < 2; b++ {
					bSuffix := string(rune('A' + b))
					if strings.ToUpper(input.BedNamingPattern) == "NUMERIC" {
						bSuffix = strconv.Itoa(b + 1)
					}
					sampleBeds = append(sampleBeds, fmt.Sprintf("%s-%s", rCode, bSuffix))
				}
			}
		}
	}

	return &models.BulkGenerationPreview{
		TargetHostelName:  hostel.Name,
		TargetBlockName:   targetBlockName,
		FloorsToCreate:    input.FloorCount,
		RoomsToCreate:     totalRooms,
		BedsToCreate:      totalBeds,
		SampleRoomCodes:   sampleRooms,
		SampleBedCodes:    sampleBeds,
		EstimatedCapacity: totalRooms * input.RoomCapacity,
	}, nil
}

func (s *HostelStructureService) GenerateBulkStructure(
	ctx context.Context,
	collegeID uuid.UUID,
	input *models.BulkGenerationInput,
	actorID uuid.UUID,
	actorRole string,
) (*models.BulkGenerationPreview, error) {
	if err := s.checkLock(ctx, collegeID, &input.HostelID); err != nil {
		return nil, err
	}

	preview, err := s.ValidateAndPreviewBulk(ctx, collegeID, input)
	if err != nil {
		return nil, err
	}

	// Execute within database transaction
	pool := s.db.GetPlatformPool()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Ensure block exists or create one
	var blockID uuid.UUID
	if input.BlockID != nil && *input.BlockID != uuid.Nil {
		blockID = *input.BlockID
	} else {
		// Find or create default block
		bName := strings.TrimSpace(input.BlockName)
		if bName == "" {
			bName = "Main Block"
		}
		bCode := strings.ToUpper(strings.TrimSpace(input.BlockCode))
		if bCode == "" {
			bCode = "BLK-" + strings.ToUpper(strconv.FormatInt(time.Now().Unix()%10000, 10))
		}

		err = tx.QueryRow(ctx, `
			INSERT INTO app.blocks (id, college_id, hostel_id, code, name, total_capacity, status)
			VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
			ON CONFLICT (hostel_id, code) DO UPDATE SET name = EXCLUDED.name
			RETURNING id
		`, uuid.New(), collegeID, input.HostelID, bCode, bName, preview.EstimatedCapacity).Scan(&blockID)
		if err != nil {
			return nil, fmt.Errorf("failed to ensure block: %w", err)
		}
	}

	startFloor := input.StartingFloor
	if startFloor < 0 {
		startFloor = 0
	}
	prefix := input.FloorNamePrefix
	if prefix == "" {
		prefix = "Floor "
	}

	now := time.Now()
	for f := 0; f < input.FloorCount; f++ {
		floorNum := startFloor + f
		floorID := uuid.New()
		floorCode := fmt.Sprintf("F%d", floorNum)
		floorName := fmt.Sprintf("%s%d", prefix, floorNum)

		_, err = tx.Exec(ctx, `
			INSERT INTO app.floors (id, college_id, hostel_id, block_id, code, name, floor_number, total_capacity, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE', $9, $9)
		`, floorID, collegeID, input.HostelID, blockID, floorCode, floorName, floorNum, input.RoomsPerFloor*input.RoomCapacity, now)
		if err != nil {
			return nil, fmt.Errorf("failed to create floor %s: %w", floorCode, err)
		}

		for r := 1; r <= input.RoomsPerFloor; r++ {
			roomID := uuid.New()
			roomCode := fmt.Sprintf("%d%02d", floorNum, r)
			roomName := fmt.Sprintf("Room %s", roomCode)

			_, err = tx.Exec(ctx, `
				INSERT INTO app.rooms (id, college_id, hostel_id, block_id, floor_id, code, name, room_type, capacity, status, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10, $10)
			`, roomID, collegeID, input.HostelID, blockID, floorID, roomCode, roomName, strings.ToUpper(input.RoomType), input.RoomCapacity, now)
			if err != nil {
				return nil, fmt.Errorf("failed to create room %s: %w", roomCode, err)
			}

			if input.GenerateBeds {
				for b := 0; b < input.RoomCapacity; b++ {
					bedID := uuid.New()
					bSuffix := string(rune('A' + b))
					if strings.ToUpper(input.BedNamingPattern) == "NUMERIC" {
						bSuffix = strconv.Itoa(b + 1)
					}
					bedCode := fmt.Sprintf("%s-%s", roomCode, bSuffix)
					bedName := fmt.Sprintf("Bed %s", bSuffix)

					_, err = tx.Exec(ctx, `
						INSERT INTO app.beds (id, college_id, hostel_id, block_id, floor_id, room_id, code, name, status, created_at, updated_at)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AVAILABLE', $9, $9)
					`, bedID, collegeID, input.HostelID, blockID, floorID, roomID, bedCode, bedName, now)
					if err != nil {
						return nil, fmt.Errorf("failed to create bed %s: %w", bedCode, err)
					}
				}
			}
		}
	}

	// Update hostel total capacity
	_, _ = tx.Exec(ctx, `
		UPDATE app.hostels
		SET total_capacity = (
			SELECT COALESCE(SUM(capacity), 0) FROM app.rooms WHERE hostel_id = $1 AND college_id = $2
		)
		WHERE id = $1 AND college_id = $2
	`, input.HostelID, collegeID)

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit bulk generation: %w", err)
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "BULK_GENERATE", "hostel", input.HostelID, nil, preview, "Bulk generated structure")
	return preview, nil
}

// --- CSV Import ---

func (s *HostelStructureService) GetCSVTemplate() []byte {
	var buf bytes.Buffer
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{
		"HostelCode", "HostelName", "Category", "BlockCode", "BlockName",
		"FloorNumber", "FloorCode", "FloorName", "RoomCode", "RoomName",
		"RoomType", "RoomCapacity", "BedCode", "BedName",
	})
	_ = w.Write([]string{
		"BH1", "Boys Hostel 1", "BOYS", "BLK-A", "Block A",
		"1", "F1", "First Floor", "101", "Room 101",
		"DOUBLE", "2", "101-A", "Bed A",
	})
	_ = w.Write([]string{
		"BH1", "Boys Hostel 1", "BOYS", "BLK-A", "Block A",
		"1", "F1", "First Floor", "101", "Room 101",
		"DOUBLE", "2", "101-B", "Bed B",
	})
	w.Flush()
	return buf.Bytes()
}

func (s *HostelStructureService) ValidateCSV(ctx context.Context, collegeID uuid.UUID, r io.Reader) (*models.CSVValidationResult, []models.CSVStructureRow, error) {
	reader := csv.NewReader(r)
	reader.TrimLeadingSpace = true

	headers, err := reader.Read()
	if err != nil {
		return nil, nil, apierrors.New(apierrors.ValidationError, "Failed to read CSV headers: "+err.Error())
	}

	expectedHeaders := []string{"HostelCode", "HostelName", "Category", "BlockCode", "BlockName", "FloorNumber", "FloorCode", "FloorName", "RoomCode", "RoomName", "RoomType", "RoomCapacity"}
	for i, h := range expectedHeaders {
		if i >= len(headers) || !strings.EqualFold(strings.TrimSpace(headers[i]), h) {
			return nil, nil, apierrors.New(apierrors.ValidationError, fmt.Sprintf("Missing or incorrect CSV column at position %d: expected '%s'", i+1, h))
		}
	}

	result := &models.CSVValidationResult{
		Errors:      make([]models.CSVRowError, 0),
		PreviewRows: make([]models.CSVStructureRow, 0),
	}

	validRows := make([]models.CSVStructureRow, 0)
	hostelCodes := make(map[string]bool)
	blockCodes := make(map[string]bool)
	floorCodes := make(map[string]bool)
	roomCodes := make(map[string]bool)
	bedCodes := make(map[string]bool)

	rowIdx := 1
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			result.Errors = append(result.Errors, models.CSVRowError{
				RowNumber: rowIdx,
				Field:     "Row",
				Message:   "Malformed CSV row: " + err.Error(),
			})
			rowIdx++
			continue
		}
		rowIdx++
		result.TotalRows++

		if len(record) < 12 {
			result.Errors = append(result.Errors, models.CSVRowError{
				RowNumber: rowIdx,
				Field:     "Row",
				Message:   "Insufficient columns in row",
			})
			continue
		}

		hCode := strings.ToUpper(strings.TrimSpace(record[0]))
		hName := strings.TrimSpace(record[1])
		cat := strings.ToUpper(strings.TrimSpace(record[2]))
		bCode := strings.ToUpper(strings.TrimSpace(record[3]))
		bName := strings.TrimSpace(record[4])
		fNumStr := strings.TrimSpace(record[5])
		fCode := strings.ToUpper(strings.TrimSpace(record[6]))
		fName := strings.TrimSpace(record[7])
		rCode := strings.ToUpper(strings.TrimSpace(record[8]))
		rName := strings.TrimSpace(record[9])
		rType := strings.ToUpper(strings.TrimSpace(record[10]))
		rCapStr := strings.TrimSpace(record[11])

		var bedCode, bedName string
		if len(record) >= 13 {
			bedCode = strings.ToUpper(strings.TrimSpace(record[12]))
		}
		if len(record) >= 14 {
			bedName = strings.TrimSpace(record[13])
		}

		hasRowErr := false
		if hCode == "" || hName == "" {
			result.Errors = append(result.Errors, models.CSVRowError{RowNumber: rowIdx, Field: "Hostel", Message: "Hostel code and name are required"})
			hasRowErr = true
		}
		if !validCategories[cat] {
			result.Errors = append(result.Errors, models.CSVRowError{RowNumber: rowIdx, Field: "Category", Message: "Invalid category (must be BOYS, GIRLS, MIXED, OTHER)"})
			hasRowErr = true
		}
		fNum, err := strconv.Atoi(fNumStr)
		if err != nil || fNum < 0 {
			result.Errors = append(result.Errors, models.CSVRowError{RowNumber: rowIdx, Field: "FloorNumber", Message: "Floor number must be a non-negative integer"})
			hasRowErr = true
		}
		if fCode == "" || fName == "" {
			result.Errors = append(result.Errors, models.CSVRowError{RowNumber: rowIdx, Field: "Floor", Message: "Floor code and name are required"})
			hasRowErr = true
		}
		if rCode == "" || rName == "" {
			result.Errors = append(result.Errors, models.CSVRowError{RowNumber: rowIdx, Field: "Room", Message: "Room code and name are required"})
			hasRowErr = true
		}
		if !validRoomTypes[rType] {
			result.Errors = append(result.Errors, models.CSVRowError{RowNumber: rowIdx, Field: "RoomType", Message: "Invalid room type"})
			hasRowErr = true
		}
		rCap, err := strconv.Atoi(rCapStr)
		if err != nil || rCap <= 0 {
			result.Errors = append(result.Errors, models.CSVRowError{RowNumber: rowIdx, Field: "RoomCapacity", Message: "Room capacity must be greater than 0"})
			hasRowErr = true
		}

		if bedCode != "" {
			bedComposite := fmt.Sprintf("%s|%s|%s|%s", hCode, bCode, rCode, bedCode)
			if bedCodes[bedComposite] {
				result.Errors = append(result.Errors, models.CSVRowError{RowNumber: rowIdx, Field: "BedCode", Message: fmt.Sprintf("Duplicate bed code '%s' within room '%s'", bedCode, rCode)})
				hasRowErr = true
			}
			bedCodes[bedComposite] = true
		}

		if !hasRowErr {
			rowItem := models.CSVStructureRow{
				RowNumber:    rowIdx,
				HostelCode:   hCode,
				HostelName:   hName,
				Category:     cat,
				BlockCode:    bCode,
				BlockName:    bName,
				FloorNumber:  fNum,
				FloorCode:    fCode,
				FloorName:    fName,
				RoomCode:     rCode,
				RoomName:     rName,
				RoomType:     rType,
				RoomCapacity: rCap,
				BedCode:      bedCode,
				BedName:      bedName,
			}
			validRows = append(validRows, rowItem)
			if len(result.PreviewRows) < 15 {
				result.PreviewRows = append(result.PreviewRows, rowItem)
			}
			hostelCodes[hCode] = true
			blockCodes[hCode+"|"+bCode] = true
			floorCodes[hCode+"|"+bCode+"|"+fCode] = true
			roomCodes[hCode+"|"+bCode+"|"+fCode+"|"+rCode] = true
		}
	}

	result.IsValid = len(result.Errors) == 0
	result.ValidRowsCount = len(validRows)
	result.HostelsCount = len(hostelCodes)
	result.BlocksCount = len(blockCodes)
	result.FloorsCount = len(floorCodes)
	result.RoomsCount = len(roomCodes)
	result.BedsCount = len(bedCodes)

	return result, validRows, nil
}

func (s *HostelStructureService) ImportCSV(
	ctx context.Context,
	collegeID uuid.UUID,
	r io.Reader,
	actorID uuid.UUID,
	actorRole string,
) (*models.CSVValidationResult, error) {
	if err := s.checkLock(ctx, collegeID, nil); err != nil {
		return nil, err
	}

	result, validRows, err := s.ValidateCSV(ctx, collegeID, r)
	if err != nil {
		return nil, err
	}
	if !result.IsValid {
		return result, apierrors.New(apierrors.ValidationError, fmt.Sprintf("CSV contains %d validation errors", len(result.Errors)))
	}
	if len(validRows) == 0 {
		return nil, apierrors.New(apierrors.ValidationError, "No valid data rows found in CSV")
	}

	pool := s.db.GetPlatformPool()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	hostelMap := make(map[string]uuid.UUID)
	blockMap := make(map[string]uuid.UUID)
	floorMap := make(map[string]uuid.UUID)
	roomMap := make(map[string]uuid.UUID)

	now := time.Now()
	for _, row := range validRows {
		// 1. Ensure Hostel
		hID, exists := hostelMap[row.HostelCode]
		if !exists {
			hID = uuid.New()
			err = tx.QueryRow(ctx, `
				INSERT INTO app.hostels (id, college_id, code, name, category, total_capacity, status, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, 0, 'ACTIVE', $6, $6)
				ON CONFLICT (college_id, code) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category
				RETURNING id
			`, hID, collegeID, row.HostelCode, row.HostelName, row.Category, now).Scan(&hID)
			if err != nil {
				return nil, fmt.Errorf("failed to insert hostel '%s': %w", row.HostelCode, err)
			}
			hostelMap[row.HostelCode] = hID
		}

		// 2. Ensure Block
		bCode := row.BlockCode
		if bCode == "" {
			bCode = "MAIN"
		}
		bName := row.BlockName
		if bName == "" {
			bName = "Main Block"
		}
		bKey := fmt.Sprintf("%s|%s", row.HostelCode, bCode)
		bID, exists := blockMap[bKey]
		if !exists {
			bID = uuid.New()
			err = tx.QueryRow(ctx, `
				INSERT INTO app.blocks (id, college_id, hostel_id, code, name, total_capacity, status, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, 0, 'ACTIVE', $6, $6)
				ON CONFLICT (hostel_id, code) DO UPDATE SET name = EXCLUDED.name
				RETURNING id
			`, bID, collegeID, hID, bCode, bName, now).Scan(&bID)
			if err != nil {
				return nil, fmt.Errorf("failed to insert block '%s': %w", bCode, err)
			}
			blockMap[bKey] = bID
		}

		// 3. Ensure Floor
		fKey := fmt.Sprintf("%s|%s|%s", row.HostelCode, bCode, row.FloorCode)
		fID, exists := floorMap[fKey]
		if !exists {
			fID = uuid.New()
			err = tx.QueryRow(ctx, `
				INSERT INTO app.floors (id, college_id, hostel_id, block_id, code, name, floor_number, total_capacity, status, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'ACTIVE', $8, $8)
				ON CONFLICT (block_id, code) DO UPDATE SET name = EXCLUDED.name
				RETURNING id
			`, fID, collegeID, hID, bID, row.FloorCode, row.FloorName, row.FloorNumber, now).Scan(&fID)
			if err != nil {
				return nil, fmt.Errorf("failed to insert floor '%s': %w", row.FloorCode, err)
			}
			floorMap[fKey] = fID
		}

		// 4. Ensure Room
		rKey := fmt.Sprintf("%s|%s|%s|%s", row.HostelCode, bCode, row.FloorCode, row.RoomCode)
		rID, exists := roomMap[rKey]
		if !exists {
			rID = uuid.New()
			err = tx.QueryRow(ctx, `
				INSERT INTO app.rooms (id, college_id, hostel_id, block_id, floor_id, code, name, room_type, capacity, status, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10, $10)
				ON CONFLICT (floor_id, code) DO UPDATE SET capacity = EXCLUDED.capacity, room_type = EXCLUDED.room_type
				RETURNING id
			`, rID, collegeID, hID, bID, fID, row.RoomCode, row.RoomName, row.RoomType, row.RoomCapacity, now).Scan(&rID)
			if err != nil {
				return nil, fmt.Errorf("failed to insert room '%s': %w", row.RoomCode, err)
			}
			roomMap[rKey] = rID
		}

		// 5. Ensure Bed (if supplied)
		if row.BedCode != "" {
			bedID := uuid.New()
			bNameVal := row.BedName
			if bNameVal == "" {
				bNameVal = "Bed " + row.BedCode
			}
			_, err = tx.Exec(ctx, `
				INSERT INTO app.beds (id, college_id, hostel_id, block_id, floor_id, room_id, code, name, status, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AVAILABLE', $9, $9)
				ON CONFLICT (room_id, code) DO NOTHING
			`, bedID, collegeID, hID, bID, fID, rID, row.BedCode, bNameVal, now)
			if err != nil {
				return nil, fmt.Errorf("failed to insert bed '%s': %w", row.BedCode, err)
			}
		}
	}

	// Recalculate hostel total capacities
	for _, hID := range hostelMap {
		_, _ = tx.Exec(ctx, `
			UPDATE app.hostels
			SET total_capacity = (
				SELECT COALESCE(SUM(capacity), 0) FROM app.rooms WHERE hostel_id = $1 AND college_id = $2
			)
			WHERE id = $1 AND college_id = $2
		`, hID, collegeID)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit CSV import: %w", err)
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "CSV_IMPORT", "hostel_structure", collegeID, nil, map[string]int{
		"hostels": len(hostelMap),
		"blocks":  len(blockMap),
		"floors":  len(floorMap),
		"rooms":   len(roomMap),
		"rows":    len(validRows),
	}, "Imported hostel structure via CSV")

	return result, nil
}

// --- Structure Cloning ---

func (s *HostelStructureService) PreviewClone(ctx context.Context, collegeID uuid.UUID, input *models.CloneStructureInput) (*models.CloneStructurePreview, error) {
	source, err := s.repo.GetHostel(ctx, collegeID, input.SourceHostelID)
	if err != nil || source == nil {
		return nil, apierrors.New(apierrors.NotFound, "Source hostel not found")
	}

	input.NewHostelCode = strings.ToUpper(strings.TrimSpace(input.NewHostelCode))
	input.NewHostelName = strings.TrimSpace(input.NewHostelName)
	if input.NewHostelCode == "" || input.NewHostelName == "" {
		return nil, apierrors.New(apierrors.ValidationError, "New hostel code and name are required")
	}

	var blockCount, floorCount, roomCount, bedCount, totalCap int
	err = s.db.GetPlatformPool().QueryRow(ctx, `
		SELECT
			COUNT(DISTINCT b.id),
			COUNT(DISTINCT f.id),
			COUNT(DISTINCT r.id),
			COUNT(DISTINCT be.id),
			COALESCE(SUM(r.capacity), 0)
		FROM app.hostels h
		LEFT JOIN app.blocks b ON b.hostel_id = h.id
		LEFT JOIN app.floors f ON f.block_id = b.id
		LEFT JOIN app.rooms r ON r.floor_id = f.id
		LEFT JOIN app.beds be ON be.room_id = r.id
		WHERE h.college_id = $1 AND h.id = $2
	`, collegeID, input.SourceHostelID).Scan(&blockCount, &floorCount, &roomCount, &bedCount, &totalCap)
	if err != nil {
		return nil, fmt.Errorf("failed to count source structure: %w", err)
	}

	return &models.CloneStructurePreview{
		SourceHostelName: source.Name,
		NewHostelCode:    input.NewHostelCode,
		NewHostelName:    input.NewHostelName,
		BlocksToClone:    blockCount,
		FloorsToClone:    floorCount,
		RoomsToClone:     roomCount,
		BedsToClone:      bedCount,
		TotalCapacity:    totalCap,
	}, nil
}

func (s *HostelStructureService) ApplyClone(
	ctx context.Context,
	collegeID uuid.UUID,
	input *models.CloneStructureInput,
	actorID uuid.UUID,
	actorRole string,
) (*models.CloneStructurePreview, error) {
	if err := s.checkLock(ctx, collegeID, nil); err != nil {
		return nil, err
	}

	preview, err := s.PreviewClone(ctx, collegeID, input)
	if err != nil {
		return nil, err
	}

	pool := s.db.GetPlatformPool()
	tx, err := pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	newHostelID := uuid.New()
	now := time.Now()

	category := input.NewCategory
	if category == "" {
		source, _ := s.repo.GetHostel(ctx, collegeID, input.SourceHostelID)
		if source != nil {
			category = source.Category
		} else {
			category = "BOYS"
		}
	}

	// 1. Create new Hostel
	_, err = tx.Exec(ctx, `
		INSERT INTO app.hostels (id, college_id, code, name, category, total_capacity, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $7)
	`, newHostelID, collegeID, input.NewHostelCode, input.NewHostelName, category, preview.TotalCapacity, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create cloned hostel: %w", err)
	}

	// 2. Fetch all blocks from source
	bRows, err := tx.Query(ctx, `
		SELECT id, code, name, description, total_capacity
		FROM app.blocks WHERE college_id = $1 AND hostel_id = $2
	`, collegeID, input.SourceHostelID)
	if err != nil {
		return nil, err
	}

	type blkData struct {
		oldID, newID uuid.UUID
		code, name   string
		desc         *string
		cap          int
	}
	blocks := make([]blkData, 0)
	for bRows.Next() {
		var b blkData
		b.newID = uuid.New()
		if err := bRows.Scan(&b.oldID, &b.code, &b.name, &b.desc, &b.cap); err != nil {
			bRows.Close()
			return nil, err
		}
		blocks = append(blocks, b)
	}
	bRows.Close()

	for _, b := range blocks {
		_, err = tx.Exec(ctx, `
			INSERT INTO app.blocks (id, college_id, hostel_id, code, name, description, total_capacity, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8, $8)
		`, b.newID, collegeID, newHostelID, b.code, b.name, b.desc, b.cap, now)
		if err != nil {
			return nil, fmt.Errorf("failed to clone block: %w", err)
		}

		// Fetch and clone floors for this block
		fRows, err := tx.Query(ctx, `
			SELECT id, code, name, floor_number, description, total_capacity
			FROM app.floors WHERE college_id = $1 AND block_id = $2
		`, collegeID, b.oldID)
		if err != nil {
			return nil, err
		}

		type flrData struct {
			oldID, newID uuid.UUID
			code, name   string
			num, cap     int
			desc         *string
		}
		floors := make([]flrData, 0)
		for fRows.Next() {
			var f flrData
			f.newID = uuid.New()
			if err := fRows.Scan(&f.oldID, &f.code, &f.name, &f.num, &f.desc, &f.cap); err != nil {
				fRows.Close()
				return nil, err
			}
			floors = append(floors, f)
		}
		fRows.Close()

		for _, f := range floors {
			_, err = tx.Exec(ctx, `
				INSERT INTO app.floors (id, college_id, hostel_id, block_id, code, name, floor_number, description, total_capacity, status, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', $10, $10)
			`, f.newID, collegeID, newHostelID, b.newID, f.code, f.name, f.num, f.desc, f.cap, now)
			if err != nil {
				return nil, fmt.Errorf("failed to clone floor: %w", err)
			}

			// Fetch and clone rooms
			rRows, err := tx.Query(ctx, `
				SELECT id, code, name, room_type, capacity, description
				FROM app.rooms WHERE college_id = $1 AND floor_id = $2
			`, collegeID, f.oldID)
			if err != nil {
				return nil, err
			}

			type rmData struct {
				oldID, newID uuid.UUID
				code, name   string
				rType        string
				cap          int
				desc         *string
			}
			rooms := make([]rmData, 0)
			for rRows.Next() {
				var rm rmData
				rm.newID = uuid.New()
				if err := rRows.Scan(&rm.oldID, &rm.code, &rm.name, &rm.rType, &rm.cap, &rm.desc); err != nil {
					rRows.Close()
					return nil, err
				}
				rooms = append(rooms, rm)
			}
			rRows.Close()

			for _, rm := range rooms {
				_, err = tx.Exec(ctx, `
					INSERT INTO app.rooms (id, college_id, hostel_id, block_id, floor_id, code, name, room_type, capacity, description, status, created_at, updated_at)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE', $11, $11)
				`, rm.newID, collegeID, newHostelID, b.newID, f.newID, rm.code, rm.name, rm.rType, rm.cap, rm.desc, now)
				if err != nil {
					return nil, fmt.Errorf("failed to clone room: %w", err)
				}

				// Fetch and clone beds (clean state: AVAILABLE, zero allocations copied)
				bedRows, err := tx.Query(ctx, `
					SELECT code, name FROM app.beds WHERE college_id = $1 AND room_id = $2
				`, collegeID, rm.oldID)
				if err != nil {
					return nil, err
				}

				for bedRows.Next() {
					var bCode string
					var bName *string
					if err := bedRows.Scan(&bCode, &bName); err != nil {
						bedRows.Close()
						return nil, err
					}
					_, err = tx.Exec(ctx, `
						INSERT INTO app.beds (id, college_id, hostel_id, block_id, floor_id, room_id, code, name, status, created_at, updated_at)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'AVAILABLE', $9, $9)
					`, uuid.New(), collegeID, newHostelID, b.newID, f.newID, rm.newID, bCode, bName, now)
					if err != nil {
						bedRows.Close()
						return nil, fmt.Errorf("failed to clone bed: %w", err)
					}
				}
				bedRows.Close()
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit cloned structure: %w", err)
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "CLONE_STRUCTURE", "hostel", newHostelID, map[string]interface{}{
		"source_hostel_id": input.SourceHostelID,
	}, preview, "Cloned structure into new hostel")

	return preview, nil
}

// --- Policy & Locking ---

func (s *HostelStructureService) GetPolicy(ctx context.Context, collegeID uuid.UUID) (*models.StructureEditPolicy, error) {
	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "college ID is required")
	}
	return s.repo.GetStructurePolicy(ctx, collegeID)
}

func (s *HostelStructureService) UpdatePolicy(
	ctx context.Context,
	collegeID uuid.UUID,
	policy *models.StructureEditPolicy,
	actorID uuid.UUID,
	actorRole string,
) (*models.StructureEditPolicy, error) {
	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "college ID is required")
	}

	existing, _ := s.repo.GetStructurePolicy(ctx, collegeID)
	if err := s.repo.SaveStructurePolicy(ctx, collegeID, policy); err != nil {
		return nil, fmt.Errorf("failed to save policy: %w", err)
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, "UPDATE_POLICY", "policy", collegeID, existing, policy, "Updated college structure edit policy")
	return policy, nil
}

func (s *HostelStructureService) ToggleLock(
	ctx context.Context,
	collegeID uuid.UUID,
	input *models.LockToggleInput,
	actorID uuid.UUID,
	actorRole string,
) error {
	if collegeID == uuid.Nil {
		return apierrors.New(apierrors.ValidationError, "college ID is required")
	}

	if err := s.repo.SetHostelLock(ctx, collegeID, input.HostelID, input.Lock, actorID, input.Reason); err != nil {
		return fmt.Errorf("failed to update lock state: %w", err)
	}

	action := "LOCK_STRUCTURE"
	if !input.Lock {
		action = "UNLOCK_STRUCTURE"
	}
	targetID := collegeID
	targetType := "college"
	if input.HostelID != nil && *input.HostelID != uuid.Nil {
		targetID = *input.HostelID
		targetType = "hostel"
	}

	_ = s.repo.RecordStructureAudit(ctx, collegeID, actorID, actorRole, action, targetType, targetID, nil, input, input.Reason)
	return nil
}

func (s *HostelStructureService) ListAudits(ctx context.Context, collegeID uuid.UUID, limit int) ([]map[string]interface{}, error) {
	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "college ID is required")
	}
	return s.repo.ListStructureAudits(ctx, collegeID, limit)
}
