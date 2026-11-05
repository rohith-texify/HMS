package models

import (
	"time"

	"github.com/google/uuid"
)

// InchargeHostel represents the assignment of a staff member as incharge of a hostel.
type InchargeHostel struct {
	ID            uuid.UUID  `json:"id"`
	CollegeID     uuid.UUID  `json:"college_id"`
	StaffID       uuid.UUID  `json:"staff_id"`
	HostelID      uuid.UUID  `json:"hostel_id"`
	AssignedFrom  time.Time  `json:"assigned_from"`
	AssignedUntil *time.Time `json:"assigned_until,omitempty"`
	IsPrimary     bool       `json:"is_primary"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// InchargeAssignmentRequest defines input payload for assigning an existing staff member.
type InchargeAssignmentRequest struct {
	StaffID       string  `json:"staff_id" binding:"required"`
	AssignedFrom  string  `json:"assigned_from"`
	AssignedUntil *string `json:"assigned_until"`
	IsPrimary     bool    `json:"is_primary"`
}

// CreateInchargeAccountInput encapsulates input parameters for creating a new incharge account.
type CreateInchargeAccountInput struct {
	Name            string    `json:"name" binding:"required"`
	HostelID        uuid.UUID `json:"hostel_id" binding:"required"`
	Email           string    `json:"email" binding:"required"`
	Password        string    `json:"password" binding:"required,min=8"`
	ConfirmPassword string    `json:"confirm_password" binding:"required"`
	Phone           string    `json:"phone"`
	Designation     string    `json:"designation"`
	IsPrimary       bool      `json:"is_primary"`
}

// CreateInchargeAccountResult represents the response payload after account provisioning.
type CreateInchargeAccountResult struct {
	UserID       uuid.UUID `json:"user_id"`
	StaffID      uuid.UUID `json:"staff_id"`
	Email        string    `json:"email"`
	FullName     string    `json:"full_name"`
	HostelID     uuid.UUID `json:"hostel_id"`
	HostelName   string    `json:"hostel_name"`
	HostelCode   string    `json:"hostel_code"`
	AssignmentID uuid.UUID `json:"assignment_id"`
	RoleCode     string    `json:"role_code"`
	Message      string    `json:"message"`
}

// MyHostelResult describes the assigned hostel facility for the authenticated in-charge.
type MyHostelResult struct {
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

// HostelResidentResult details an individual student resident residing in the hostel.
type HostelResidentResult struct {
	StudentID       uuid.UUID  `json:"student_id"`
	AdmissionNumber string     `json:"admission_number"`
	RollNumber      string     `json:"roll_number"`
	FirstName       string     `json:"first_name"`
	LastName        string     `json:"last_name"`
	FullName        string     `json:"full_name"`
	Email           string     `json:"email"`
	Phone           string     `json:"phone"`
	Gender          string     `json:"gender"`
	BloodGroup      string     `json:"blood_group"`
	HostelStatus    string     `json:"hostel_status"`
	AllocationID    uuid.UUID  `json:"allocation_id"`
	AllocationType  string     `json:"allocation_type"`
	AllocatedAt     time.Time  `json:"allocated_at"`
	BedID           uuid.UUID  `json:"bed_id"`
	BedName         string     `json:"bed_name"`
	RoomID          uuid.UUID  `json:"room_id"`
	RoomName        string     `json:"room_name"`
	RoomCode        string     `json:"room_code"`
	BlockID         *uuid.UUID `json:"block_id,omitempty"`
	BlockName       string     `json:"block_name"`
}

// VacantBedResult details available beds within the in-charge's assigned facility.
type VacantBedResult struct {
	BedID     uuid.UUID  `json:"bed_id"`
	BedName   string     `json:"bed_name"`
	RoomID    uuid.UUID  `json:"room_id"`
	RoomCode  string     `json:"room_code"`
	RoomName  string     `json:"room_name"`
	BlockID   *uuid.UUID `json:"block_id,omitempty"`
	BlockName string     `json:"block_name"`
}

// UnallocatedStudentResult represents students pending residential allotment.
type UnallocatedStudentResult struct {
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

// InchargeDashboardSummary aggregates real-time residential operational metrics.
type InchargeDashboardSummary struct {
	HostelID       uuid.UUID `json:"hostel_id"`
	HostelName     string    `json:"hostel_name"`
	TotalCapacity  int       `json:"total_capacity"`
	OccupiedBeds   int       `json:"occupied_beds"`
	VacantBeds     int       `json:"vacant_beds"`
	OccupancyRate  float64   `json:"occupancy_rate"`
	TotalResidents int       `json:"total_residents"`
	TodayPresent   int       `json:"today_present"`
	TodayAbsent    int       `json:"today_absent"`
	TodayOnLeave   int       `json:"today_on_leave"`
	OpenComplaints int       `json:"open_complaints"`
	ActiveAnnounce int       `json:"active_announcements"`
}

// Backward-compatible type aliases
type MyHostelProfile = MyHostelResult
type ResidentStudent = HostelResidentResult
type VacantBed = VacantBedResult
type UnallocatedStudent = UnallocatedStudentResult
type InchargeHostelAssignment = InchargeHostel
