package models

import (
	"time"

	"github.com/google/uuid"
)

// PaginationParams represents query pagination options.
type PaginationParams struct {
	Page   int    `form:"page" json:"page"`
	Limit  int    `form:"limit" json:"limit"`
	Search string `form:"search" json:"search"`
	Status string `form:"status" json:"status"`
}

// EnsureDefaults applies sensible defaults to pagination.
func (p *PaginationParams) EnsureDefaults() {
	if p.Page < 1 {
		p.Page = 1
	}
	if p.Limit < 1 || p.Limit > 100 {
		p.Limit = 20
	}
}

// Offset returns the SQL offset.
func (p *PaginationParams) Offset() int {
	return (p.Page - 1) * p.Limit
}

// InchargeHostelAssignment represents a staff member assigned as hostel incharge.
type InchargeHostelAssignment struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	CollegeID     uuid.UUID  `json:"college_id" db:"college_id"`
	StaffID       uuid.UUID  `json:"staff_id" db:"staff_id"`
	HostelID      uuid.UUID  `json:"hostel_id" db:"hostel_id"`
	AssignedFrom  time.Time  `json:"assigned_from" db:"assigned_from"`
	AssignedUntil *time.Time `json:"assigned_until,omitempty" db:"assigned_until"`
	IsPrimary     bool       `json:"is_primary" db:"is_primary"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

// MyHostelProfile represents the verified assigned hostel details for the incharge.
type MyHostelProfile struct {
	HostelID      uuid.UUID  `json:"hostel_id"`
	HostelCode    string     `json:"hostel_code"`
	HostelName    string     `json:"hostel_name"`
	HostelType    string     `json:"hostel_type"`
	TotalCapacity int        `json:"total_capacity"`
	TotalRooms    int        `json:"total_rooms"`
	StaffID       uuid.UUID  `json:"staff_id"`
	StaffName     string     `json:"staff_name"`
	Designation   string     `json:"designation"`
	IsPrimary     bool       `json:"is_primary"`
	AssignedFrom  time.Time  `json:"assigned_from"`
	AssignedUntil *time.Time `json:"assigned_until,omitempty"`
}

// ResidentStudent represents an enrolled resident in the assigned hostel.
type ResidentStudent struct {
	StudentID       uuid.UUID `json:"student_id"`
	AdmissionNumber string    `json:"admission_number"`
	RollNumber      string    `json:"roll_number"`
	FirstName       string    `json:"first_name"`
	LastName        string    `json:"last_name"`
	FullName        string    `json:"full_name"`
	Email           string    `json:"email"`
	Phone           string    `json:"phone"`
	Gender          string    `json:"gender"`
	BloodGroup      string    `json:"blood_group"`
	HostelStatus    string    `json:"hostel_status"`
	AllocationID    uuid.UUID `json:"allocation_id"`
	AllocationType  string    `json:"allocation_type"`
	AllocatedAt     time.Time `json:"allocated_at"`
	BedID           uuid.UUID `json:"bed_id"`
	BedName         string    `json:"bed_name"`
	RoomID          uuid.UUID `json:"room_id"`
	RoomName        string    `json:"room_name"`
	RoomCode        string    `json:"room_code"`
	BlockID         uuid.UUID `json:"block_id"`
	BlockName       string    `json:"block_name"`
}

// VacantBed represents an available bed in the assigned hostel.
type VacantBed struct {
	BedID     uuid.UUID `json:"bed_id"`
	BedName   string    `json:"bed_name"`
	RoomID    uuid.UUID `json:"room_id"`
	RoomCode  string    `json:"room_code"`
	RoomName  string    `json:"room_name"`
	BlockID   uuid.UUID `json:"block_id"`
	BlockName string    `json:"block_name"`
}

// UnallocatedStudent represents a college student waiting for bed allocation.
type UnallocatedStudent struct {
	StudentID       uuid.UUID `json:"student_id"`
	AdmissionNumber string    `json:"admission_number"`
	RollNumber      string    `json:"roll_number"`
	FirstName       string    `json:"first_name"`
	LastName        string    `json:"last_name"`
	FullName        string    `json:"full_name"`
	Email           string    `json:"email"`
	Phone           string    `json:"phone"`
	Gender          string    `json:"gender"`
	YearOfStudy     int       `json:"year_of_study"`
	Department      string    `json:"department"`
}

// CreateInchargeAccountInput encapsulates new incharge credentials and assignment.
type CreateInchargeAccountInput struct {
	Name            string    `json:"name"`
	HostelID        uuid.UUID `json:"hostel_id"`
	Email           string    `json:"email"`
	Password        string    `json:"password"`
	ConfirmPassword string    `json:"confirm_password"`
	Phone           string    `json:"phone"`
	Designation     string    `json:"designation"`
	IsPrimary       bool      `json:"is_primary"`
}

// InchargeDashboardSummary represents KPIs and operational aggregates for the hostel.
type InchargeDashboardSummary struct {
	HostelID         uuid.UUID `json:"hostel_id"`
	HostelName       string    `json:"hostel_name"`
	TotalCapacity    int       `json:"total_capacity"`
	OccupiedBeds     int       `json:"occupied_beds"`
	VacantBeds       int       `json:"vacant_beds"`
	OccupancyRate    float64   `json:"occupancy_rate"`
	TotalResidents   int       `json:"total_residents"`
	TodayPresent     int       `json:"today_present"`
	TodayAbsent      int       `json:"today_absent"`
	TodayOnLeave     int       `json:"today_on_leave"`
	OpenComplaints   int       `json:"open_complaints"`
	ActiveAnnounce   int       `json:"active_announcements"`
}

