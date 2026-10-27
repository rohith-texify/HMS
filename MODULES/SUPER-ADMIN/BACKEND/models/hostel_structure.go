package models

import (
	"time"

	"github.com/google/uuid"
)

// Hostel represents a hostel entity in app.hostels.
type Hostel struct {
	ID            uuid.UUID `json:"id"`
	CollegeID     uuid.UUID `json:"college_id"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	Category      string    `json:"category"` // BOYS, GIRLS, MIXED, OTHER
	Description   *string   `json:"description,omitempty"`
	Address       *string   `json:"address,omitempty"`
	TotalCapacity int       `json:"total_capacity"`
	Status        string    `json:"status"` // ACTIVE, INACTIVE, MAINTENANCE
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Block represents a block / building entity in app.blocks.
type Block struct {
	ID            uuid.UUID `json:"id"`
	CollegeID     uuid.UUID `json:"college_id"`
	HostelID      uuid.UUID `json:"hostel_id"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	Description   *string   `json:"description,omitempty"`
	TotalCapacity int       `json:"total_capacity"`
	Status        string    `json:"status"` // ACTIVE, INACTIVE, MAINTENANCE
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Floor represents a floor entity in app.floors.
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
	Status        string    `json:"status"` // ACTIVE, INACTIVE, MAINTENANCE
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Room represents a room entity in app.rooms.
type Room struct {
	ID            uuid.UUID `json:"id"`
	CollegeID     uuid.UUID `json:"college_id"`
	HostelID      uuid.UUID `json:"hostel_id"`
	BlockID       uuid.UUID `json:"block_id"`
	FloorID       uuid.UUID `json:"floor_id"`
	Code          string    `json:"code"`
	Name          string    `json:"name"`
	RoomType      string    `json:"room_type"` // STANDARD, SINGLE, DOUBLE, TRIPLE, DORMITORY, SPECIAL
	Capacity      int       `json:"capacity"`
	Description   *string   `json:"description,omitempty"`
	Status        string    `json:"status"` // ACTIVE, INACTIVE, MAINTENANCE
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Bed represents a bed entity in app.beds.
type Bed struct {
	ID            uuid.UUID `json:"id"`
	CollegeID     uuid.UUID `json:"college_id"`
	HostelID      uuid.UUID `json:"hostel_id"`
	BlockID       uuid.UUID `json:"block_id"`
	FloorID       uuid.UUID `json:"floor_id"`
	RoomID        uuid.UUID `json:"room_id"`
	Code          string    `json:"code"`
	Name          *string   `json:"name,omitempty"`
	Status        string    `json:"status"` // AVAILABLE, OCCUPIED, RESERVED, MAINTENANCE, INACTIVE
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// Hierarchy Bed node
type HierarchyBed struct {
	ID         uuid.UUID `json:"id"`
	Code       string    `json:"code"`
	Name       *string   `json:"name,omitempty"`
	Status     string    `json:"status"`
	IsOccupied bool      `json:"is_occupied"`
}

// Hierarchy Room node
type HierarchyRoom struct {
	ID         uuid.UUID      `json:"id"`
	Code       string         `json:"code"`
	Name       string         `json:"name"`
	RoomType   string         `json:"room_type"`
	Capacity   int            `json:"capacity"`
	Status     string         `json:"status"`
	Occupied   int            `json:"occupied_beds"`
	Available  int            `json:"available_beds"`
	Beds       []HierarchyBed `json:"beds"`
}

// Hierarchy Floor node
type HierarchyFloor struct {
	ID          uuid.UUID       `json:"id"`
	Code        string          `json:"code"`
	Name        string          `json:"name"`
	FloorNumber int             `json:"floor_number"`
	Status      string          `json:"status"`
	Rooms       []HierarchyRoom `json:"rooms"`
}

// Hierarchy Block node
type HierarchyBlock struct {
	ID        uuid.UUID        `json:"ID"`
	Code      string           `json:"code"`
	Name      string           `json:"name"`
	Status    string           `json:"status"`
	IsDefault bool             `json:"is_default"` // true if synthetic/default single-building block
	Floors    []HierarchyFloor `json:"floors"`
}

// Hierarchy Hostel node
type HierarchyHostel struct {
	ID            uuid.UUID        `json:"id"`
	Code          string           `json:"code"`
	Name          string           `json:"name"`
	Category      string           `json:"category"`
	Status        string           `json:"status"`
	TotalCapacity int              `json:"total_capacity"`
	OccupiedBeds  int              `json:"occupied_beds"`
	AvailableBeds int              `json:"available_beds"`
	ActiveRooms   int              `json:"active_rooms"`
	VacantRooms   int              `json:"vacant_rooms"`
	IsLocked      bool             `json:"is_locked"`
	Blocks        []HierarchyBlock `json:"blocks"`
}

// OccupancySummary contains verified occupancy metrics for a college.
type OccupancySummary struct {
	TotalHostels         int `json:"total_hostels"`
	TotalBlocks          int `json:"total_blocks"`
	TotalFloors          int `json:"total_floors"`
	TotalRooms           int `json:"total_rooms"`
	ActiveRooms          int `json:"active_rooms"`
	OccupiedRooms        int `json:"occupied_rooms"`
	VacantRooms          int `json:"vacant_rooms"`
	PartiallyOccupied    int `json:"partially_occupied_rooms"`
	TotalBedCapacity     int `json:"total_bed_capacity"`
	TotalBeds            int `json:"total_beds"`
	OccupiedBeds         int `json:"occupied_beds"`
	AvailableBeds        int `json:"available_beds"`
	ReservedBeds         int `json:"reserved_beds"`
	MaintenanceBeds      int `json:"maintenance_beds"`
	InactiveBeds         int `json:"inactive_beds"`
	OccupancyPercentage  float64 `json:"occupancy_percentage"`
}

// StructureEditPolicy defines platform/college rules for hostel structural changes.
type StructureEditPolicy struct {
	AllowBulkGeneration       bool       `json:"allow_bulk_generation"`
	AllowCSVImport            bool       `json:"allow_csv_import"`
	AllowCloning              bool       `json:"allow_cloning"`
	PreventOccupiedMod        bool       `json:"prevent_occupied_modification"`
	IsLocked                  bool       `json:"is_locked"`
	LockedBy                  *uuid.UUID `json:"locked_by,omitempty"`
	LockedAt                  *time.Time `json:"locked_at,omitempty"`
	LockReason                string     `json:"lock_reason,omitempty"`
	RequireApprovalForDelete  bool       `json:"require_approval_for_delete"`
	UpdatedAt                 time.Time  `json:"updated_at"`
}

// BulkGenerationInput defines parameters for procedural structure generation.
type BulkGenerationInput struct {
	HostelID           uuid.UUID `json:"hostel_id"`
	BlockID            *uuid.UUID `json:"block_id,omitempty"` // Optional
	BlockName          string    `json:"block_name,omitempty"` // If creating a new block
	BlockCode          string    `json:"block_code,omitempty"`
	FloorCount         int       `json:"floor_count"`
	StartingFloor      int       `json:"starting_floor"` // e.g. 0 (Ground) or 1
	FloorNamePrefix    string    `json:"floor_name_prefix"` // e.g. "Floor "
	RoomsPerFloor      int       `json:"rooms_per_floor"`
	RoomNumberFormat   string    `json:"room_number_format"` // "FLOOR_ROOM" (e.g. 101, 102) or "SEQUENTIAL"
	RoomType           string    `json:"room_type"` // STANDARD, SINGLE, DOUBLE, TRIPLE, DORMITORY, SPECIAL
	RoomCapacity       int       `json:"room_capacity"`
	GenerateBeds       bool      `json:"generate_beds"`
	BedNamingPattern   string    `json:"bed_naming_pattern"` // "ALPHA" (A, B, C) or "NUMERIC" (1, 2, 3)
}

// BulkGenerationPreview summarizes what would be created.
type BulkGenerationPreview struct {
	TargetHostelName string   `json:"target_hostel_name"`
	TargetBlockName  string   `json:"target_block_name"`
	FloorsToCreate   int      `json:"floors_to_create"`
	RoomsToCreate    int      `json:"rooms_to_create"`
	BedsToCreate     int      `json:"beds_to_create"`
	SampleRoomCodes  []string `json:"sample_room_codes"`
	SampleBedCodes   []string `json:"sample_bed_codes"`
	EstimatedCapacity int     `json:"estimated_capacity"`
}

// CSVStructureRow represents one row in a structure import file.
type CSVStructureRow struct {
	RowNumber     int    `json:"row_number"`
	HostelCode    string `json:"hostel_code"`
	HostelName    string `json:"hostel_name"`
	Category      string `json:"category"`
	BlockCode     string `json:"block_code"`
	BlockName     string `json:"block_name"`
	FloorNumber   int    `json:"floor_number"`
	FloorCode     string `json:"floor_code"`
	FloorName     string `json:"floor_name"`
	RoomCode      string `json:"room_code"`
	RoomName      string `json:"room_name"`
	RoomType      string `json:"room_type"`
	RoomCapacity  int    `json:"room_capacity"`
	BedCode       string `json:"bed_code,omitempty"`
	BedName       string `json:"bed_name,omitempty"`
}

// CSVValidationResult reports errors and preview for import.
type CSVValidationResult struct {
	IsValid          bool               `json:"is_valid"`
	TotalRows        int                `json:"total_rows"`
	ValidRowsCount   int                `json:"valid_rows_count"`
	Errors           []CSVRowError      `json:"errors"`
	HostelsCount     int                `json:"hostels_count"`
	BlocksCount      int                `json:"blocks_count"`
	FloorsCount      int                `json:"floors_count"`
	RoomsCount       int                `json:"rooms_count"`
	BedsCount        int                `json:"beds_count"`
	PreviewRows      []CSVStructureRow  `json:"preview_rows"`
}

// CSVRowError captures location-specific import issues.
type CSVRowError struct {
	RowNumber int    `json:"row_number"`
	Field     string `json:"field"`
	Message   string `json:"message"`
}

// CloneStructureInput defines cloning source and destination parameters.
type CloneStructureInput struct {
	SourceHostelID   uuid.UUID `json:"source_hostel_id"`
	NewHostelCode    string    `json:"new_hostel_code"`
	NewHostelName    string    `json:"new_hostel_name"`
	NewCategory      string    `json:"new_category"`
	CodePrefix       string    `json:"code_prefix,omitempty"` // Optional prefix for all rooms/beds
}

// CloneStructurePreview outlines the cloned structure.
type CloneStructurePreview struct {
	SourceHostelName string   `json:"source_hostel_name"`
	NewHostelCode    string   `json:"new_hostel_code"`
	NewHostelName    string   `json:"new_hostel_name"`
	BlocksToClone    int      `json:"blocks_to_clone"`
	FloorsToClone    int      `json:"floors_to_clone"`
	RoomsToClone     int      `json:"rooms_to_clone"`
	BedsToClone      int      `json:"beds_to_clone"`
	TotalCapacity    int      `json:"total_capacity"`
}

// LockToggleInput is the request body for locking/unlocking.
type LockToggleInput struct {
	HostelID *uuid.UUID `json:"hostel_id,omitempty"` // if nil, applies to entire college
	Lock     bool       `json:"lock"`
	Reason   string     `json:"reason"`
}
