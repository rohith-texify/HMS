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

// CollegeContext represents active tenant context.
type CollegeContext struct {
	TenantID uuid.UUID `json:"tenant_id"`
}

// Student represents a residential student record.
type Student struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	CollegeID      uuid.UUID  `json:"college_id" db:"college_id"`
	UserID         *uuid.UUID `json:"user_id,omitempty" db:"user_id"`
	FullName       string     `json:"full_name" db:"full_name"`
	RollNumber     string     `json:"roll_number" db:"roll_number"`
	Department     string     `json:"department" db:"department"`
	YearOfStudy    int        `json:"year_of_study" db:"year_of_study"`
	Gender         string     `json:"gender" db:"gender"`
	Email          string     `json:"email" db:"email"`
	PhoneNumber    string     `json:"phone_number" db:"phone_number"`
	Status         string     `json:"status" db:"status"`
	AdmissionDate  *time.Time `json:"admission_date,omitempty" db:"admission_date"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

// Parent represents a student guardian profile.
type Parent struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	CollegeID   uuid.UUID  `json:"college_id" db:"college_id"`
	FullName    string     `json:"full_name" db:"full_name"`
	PhoneNumber string     `json:"phone_number" db:"phone_number"`
	Email       *string    `json:"email,omitempty" db:"email"`
	Address     *string    `json:"address,omitempty" db:"address"`
	Occupation  *string    `json:"occupation,omitempty" db:"occupation"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// StudentParent links a student to a parent.
type StudentParent struct {
	ID               uuid.UUID `json:"id" db:"id"`
	StudentID        uuid.UUID `json:"student_id" db:"student_id"`
	ParentID         uuid.UUID `json:"parent_id" db:"parent_id"`
	RelationshipType string    `json:"relationship_type" db:"relationship_type"`
	IsPrimary        bool      `json:"is_primary" db:"is_primary"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
}

// EmergencyContact represents student emergency priority contacts.
type EmergencyContact struct {
	ID           uuid.UUID `json:"id" db:"id"`
	StudentID    uuid.UUID `json:"student_id" db:"student_id"`
	Name         string    `json:"name" db:"name"`
	Relationship string    `json:"relationship" db:"relationship"`
	PhoneNumber  string    `json:"phone_number" db:"phone_number"`
	Priority     int       `json:"priority" db:"priority"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// Hostel represents a campus residential hostel building.
type Hostel struct {
	ID          uuid.UUID `json:"id" db:"id"`
	CollegeID   uuid.UUID `json:"college_id" db:"college_id"`
	Name        string    `json:"name" db:"name"`
	Code        string    `json:"code" db:"code"`
	Type        string    `json:"type" db:"type"`
	Capacity    int       `json:"capacity" db:"capacity"`
	Address     *string   `json:"address,omitempty" db:"address"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// Block represents a wing or block inside a hostel.
type Block struct {
	ID          uuid.UUID `json:"id" db:"id"`
	CollegeID   uuid.UUID `json:"college_id" db:"college_id"`
	HostelID    uuid.UUID `json:"hostel_id" db:"hostel_id"`
	Name        string    `json:"name" db:"name"`
	Code        string    `json:"code" db:"code"`
	TotalFloors int       `json:"total_floors" db:"total_floors"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// Floor represents a level in a block.
type Floor struct {
	ID          uuid.UUID `json:"id" db:"id"`
	CollegeID   uuid.UUID `json:"college_id" db:"college_id"`
	BlockID     uuid.UUID `json:"block_id" db:"block_id"`
	FloorNumber int       `json:"floor_number" db:"floor_number"`
	Name        string    `json:"name" db:"name"`
	Status      string    `json:"status" db:"status"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// Room represents a room on a floor.
type Room struct {
	ID         uuid.UUID `json:"id" db:"id"`
	CollegeID  uuid.UUID `json:"college_id" db:"college_id"`
	FloorID    uuid.UUID `json:"floor_id" db:"floor_id"`
	RoomNumber string    `json:"room_number" db:"room_number"`
	RoomType   string    `json:"room_type" db:"room_type"`
	Capacity   int       `json:"capacity" db:"capacity"`
	Status     string    `json:"status" db:"status"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// Bed represents an individual bed unit in a room.
type Bed struct {
	ID        uuid.UUID `json:"id" db:"id"`
	CollegeID uuid.UUID `json:"college_id" db:"college_id"`
	RoomID    uuid.UUID `json:"room_id" db:"room_id"`
	BedNumber string    `json:"bed_number" db:"bed_number"`
	Status    string    `json:"status" db:"status"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// BedAllocation represents a resident's assigned bed.
type BedAllocation struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	CollegeID    uuid.UUID  `json:"college_id" db:"college_id"`
	StudentID    uuid.UUID  `json:"student_id" db:"student_id"`
	BedID        uuid.UUID  `json:"bed_id" db:"bed_id"`
	AcademicYear string     `json:"academic_year" db:"academic_year"`
	FromDate     time.Time  `json:"from_date" db:"from_date"`
	ToDate       *time.Time `json:"to_date,omitempty" db:"to_date"`
	Status       string     `json:"status" db:"status"`
	AllocatedBy  uuid.UUID  `json:"allocated_by" db:"allocated_by"`
	Remarks      *string    `json:"remarks,omitempty" db:"remarks"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
}

// Staff represents an institutional staff member.
type Staff struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	CollegeID   uuid.UUID  `json:"college_id" db:"college_id"`
	UserID      *uuid.UUID `json:"user_id,omitempty" db:"user_id"`
	FullName    string     `json:"full_name" db:"full_name"`
	Role        string     `json:"role" db:"role"`
	Designation string     `json:"designation" db:"designation"`
	Email       string     `json:"email" db:"email"`
	PhoneNumber string     `json:"phone_number" db:"phone_number"`
	Status      string     `json:"status" db:"status"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// Gate represents a physical campus entry/exit checkpoint.
type Gate struct {
	ID        uuid.UUID `json:"id" db:"id"`
	CollegeID uuid.UUID `json:"college_id" db:"college_id"`
	Name      string    `json:"name" db:"name"`
	Code      string    `json:"code" db:"code"`
	Location  string    `json:"location" db:"location"`
	Status    string    `json:"status" db:"status"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// SecurityAssignment links a security staff to a gate and shift.
type SecurityAssignment struct {
	ID        uuid.UUID `json:"id" db:"id"`
	CollegeID uuid.UUID `json:"college_id" db:"college_id"`
	StaffID   uuid.UUID `json:"staff_id" db:"staff_id"`
	GateID    uuid.UUID `json:"gate_id" db:"gate_id"`
	Shift     string    `json:"shift" db:"shift"`
	StartDate time.Time `json:"start_date" db:"start_date"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// StudentAttendance represents curfew roll-call records.
type StudentAttendance struct {
	ID        uuid.UUID `json:"id" db:"id"`
	CollegeID uuid.UUID `json:"college_id" db:"college_id"`
	StudentID uuid.UUID `json:"student_id" db:"student_id"`
	Date      time.Time `json:"date" db:"date"`
	Status    string    `json:"status" db:"status"`
	MarkedBy  uuid.UUID `json:"marked_by" db:"marked_by"`
	Remarks   *string   `json:"remarks,omitempty" db:"remarks"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// AttendanceSummary represents roll-call aggregates.
type AttendanceSummary struct {
	Total   int `json:"total"`
	Present int `json:"present"`
	Absent  int `json:"absent"`
	Late    int `json:"late"`
	OnLeave int `json:"on_leave"`
	Excused int `json:"excused"`
	Holiday int `json:"holiday"`
}

// LeaveRequest represents a student outpass application.
type LeaveRequest struct {
	ID           uuid.UUID  `json:"id" db:"id"`
	CollegeID    uuid.UUID  `json:"college_id" db:"college_id"`
	StudentID    uuid.UUID  `json:"student_id" db:"student_id"`
	LeaveType    string     `json:"leave_type" db:"leave_type"`
	StartDate    time.Time  `json:"start_date" db:"start_date"`
	EndDate      time.Time  `json:"end_date" db:"end_date"`
	Reason       string     `json:"reason" db:"reason"`
	Status       string     `json:"status" db:"status"`
	ApprovedBy   *uuid.UUID `json:"approved_by,omitempty" db:"approved_by"`
	DecisionNote *string    `json:"decision_note,omitempty" db:"decision_note"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
}

// LeaveSummary represents leave application counts.
type LeaveSummary struct {
	Total     int `json:"total"`
	Pending   int `json:"pending"`
	Approved  int `json:"approved"`
	Rejected  int `json:"rejected"`
	Cancelled int `json:"cancelled"`
}

// Complaint represents a student facility maintenance work order.
type Complaint struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	CollegeID   uuid.UUID  `json:"college_id" db:"college_id"`
	StudentID   uuid.UUID  `json:"student_id" db:"student_id"`
	Category    string     `json:"category" db:"category"`
	Title       string     `json:"title" db:"title"`
	Description string     `json:"description" db:"description"`
	Priority    string     `json:"priority" db:"priority"`
	Status      string     `json:"status" db:"status"`
	AssignedTo  *uuid.UUID `json:"assigned_to,omitempty" db:"assigned_to"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// ComplaintSummary represents service desk metrics.
type ComplaintSummary struct {
	Total      int `json:"total"`
	Open       int `json:"open"`
	InProgress int `json:"in_progress"`
	Resolved   int `json:"resolved"`
	Closed     int `json:"closed"`
}

// MealTiming represents mess meal serving hours.
type MealTiming struct {
	ID        uuid.UUID `json:"id" db:"id"`
	CollegeID uuid.UUID `json:"college_id" db:"college_id"`
	HostelID  uuid.UUID `json:"hostel_id" db:"hostel_id"`
	MealType  string    `json:"meal_type" db:"meal_type"`
	StartTime string    `json:"start_time" db:"start_time"`
	EndTime   string    `json:"end_time" db:"end_time"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// MealMenu represents dining menu items.
type MealMenu struct {
	ID        uuid.UUID `json:"id" db:"id"`
	CollegeID uuid.UUID `json:"college_id" db:"college_id"`
	HostelID  uuid.UUID `json:"hostel_id" db:"hostel_id"`
	DayOfWeek string    `json:"day_of_week" db:"day_of_week"`
	MealType  string    `json:"meal_type" db:"meal_type"`
	MenuItems string    `json:"menu_items" db:"menu_items"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
}

// Notification represents a broadcast circular.
type Notification struct {
	ID             uuid.UUID `json:"id" db:"id"`
	CollegeID      uuid.UUID `json:"college_id" db:"college_id"`
	Title          string    `json:"title" db:"title"`
	Message        string    `json:"message" db:"message"`
	Priority       string    `json:"priority" db:"priority"`
	TargetAudience string    `json:"target_audience" db:"target_audience"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}

