package models

import (
	"time"

	"github.com/google/uuid"
)

// GuardianInfo represents a student's parent or guardian relationship.
type GuardianInfo struct {
	ID                      uuid.UUID `json:"id"`
	FirstName               string    `json:"first_name"`
	MiddleName              *string   `json:"middle_name,omitempty"`
	LastName                *string   `json:"last_name,omitempty"`
	FullName                string    `json:"full_name"`
	Relationship            string    `json:"relationship"`
	Phone                   string    `json:"phone"`
	AlternatePhone          *string   `json:"alternate_phone,omitempty"`
	Email                   *string   `json:"email,omitempty"`
	Occupation              *string   `json:"occupation,omitempty"`
	IsPrimary               bool      `json:"is_primary"`
	CanReceiveNotifications bool      `json:"can_receive_notifications"`
	CanPickupStudent        bool      `json:"can_pickup_student"`
}

// EmergencyContactInfo represents an authorized emergency contact for the student.
type EmergencyContactInfo struct {
	ID             uuid.UUID `json:"id"`
	ContactName    string    `json:"contact_name"`
	Relationship   *string   `json:"relationship,omitempty"`
	Phone          string    `json:"phone"`
	AlternatePhone *string   `json:"alternate_phone,omitempty"`
	Email          *string   `json:"email,omitempty"`
	IsPrimary      bool      `json:"is_primary"`
}

// StudentDocumentInfo represents permitted documents associated with the student.
type StudentDocumentInfo struct {
	ID          uuid.UUID `json:"id"`
	FileName    string    `json:"file_name"`
	StoragePath string    `json:"storage_path"`
	MimeType    *string   `json:"mime_type,omitempty"`
	FileSize    *int64    `json:"file_size,omitempty"`
	UploadedAt  time.Time `json:"uploaded_at"`
	Status      string    `json:"status"`
}

// StudentProfile represents full profile details of an enrolled residential student.
type StudentProfile struct {
	ID                 uuid.UUID  `json:"id"`
	CollegeID          uuid.UUID  `json:"college_id"`
	UserID             *uuid.UUID `json:"user_id,omitempty"`
	AdmissionNumber    string     `json:"admission_number"`
	RegistrationNumber *string    `json:"registration_number,omitempty"`
	RollNumber         *string    `json:"roll_number,omitempty"`
	FirstName          string     `json:"first_name"`
	MiddleName         *string    `json:"middle_name,omitempty"`
	LastName           *string    `json:"last_name,omitempty"`
	FullName           string     `json:"full_name"`
	DateOfBirth        *time.Time `json:"date_of_birth,omitempty"`
	Gender             *string    `json:"gender,omitempty"`
	BloodGroup         *string    `json:"blood_group,omitempty"`
	Phone              *string    `json:"phone,omitempty"`
	Email              string     `json:"email"`
	AddressLine1       *string    `json:"address_line1,omitempty"`
	AddressLine2       *string    `json:"address_line2,omitempty"`
	City               *string    `json:"city,omitempty"`
	State              *string    `json:"state,omitempty"`
	PostalCode         *string    `json:"postal_code,omitempty"`
	Country            *string    `json:"country,omitempty"`
	EmergencyContact   *string    `json:"emergency_contact_phone,omitempty"`

	// Status & Enrollment
	StudentStatus string     `json:"student_status"` // ACTIVE, INACTIVE, SUSPENDED, GRADUATED, etc.
	HostelStatus  string     `json:"hostel_status"`  // NOT_ALLOCATED, ALLOCATED, VACATED, etc.
	AdmissionDate *time.Time `json:"admission_date,omitempty"`

	// Academic & Institution Info
	DepartmentName *string `json:"department_name,omitempty"`
	ProgramName    *string `json:"program_name,omitempty"`
	CourseName     *string `json:"course_name,omitempty"`
	AcademicYear   *string `json:"academic_year,omitempty"`
	SemesterNumber *int    `json:"semester_number,omitempty"`
	BatchName      *string `json:"batch_name,omitempty"`

	// Bed Allotment Summary
	CurrentRoom *BedAllocation `json:"current_room,omitempty"`

	// Guardians, Emergency Contacts & Documents
	Guardians         []GuardianInfo         `json:"guardians"`
	EmergencyContacts []EmergencyContactInfo `json:"emergency_contacts"`
	Documents         []StudentDocumentInfo  `json:"documents"`
}

// BedAllocation represents the residential allotment for a student.
type BedAllocation struct {
	ID             uuid.UUID  `json:"id"`
	CollegeID      uuid.UUID  `json:"college_id"`
	StudentID      uuid.UUID  `json:"student_id"`
	BedID          uuid.UUID  `json:"bed_id"`
	BedLabel       string     `json:"bed_label"`
	RoomID         uuid.UUID  `json:"room_id"`
	RoomNumber     string     `json:"room_number"`
	FloorNumber    int        `json:"floor_number"`
	BlockID        uuid.UUID  `json:"block_id"`
	BlockName      string     `json:"block_name"`
	HostelID       uuid.UUID  `json:"hostel_id"`
	HostelName     string     `json:"hostel_name"`
	HostelType     string     `json:"hostel_type"`
	AllocationType string     `json:"allocation_type"`
	AllocatedAt    time.Time  `json:"allocated_at"`
	ReleasedAt     *time.Time `json:"released_at,omitempty"`
	Status         string     `json:"status"`
	Remarks        *string    `json:"remarks,omitempty"`
}

// GatePass represents a digital gate pass generated for student campus entry/exit.
type GatePass struct {
	ID              uuid.UUID  `json:"id"`
	CollegeID       uuid.UUID  `json:"college_id"`
	StudentID       uuid.UUID  `json:"student_id"`
	LeaveRequestID  *uuid.UUID `json:"leave_request_id,omitempty"`
	PassNumber      string     `json:"pass_number"`
	PassType        string     `json:"pass_type"` // DAY, OVERNIGHT, EMERGENCY
	Reason          string     `json:"reason"`
	Destination     *string    `json:"destination,omitempty"`
	ValidFrom       time.Time  `json:"valid_from"`
	ValidUntil      time.Time  `json:"valid_until"`
	Status          string     `json:"status"` // REQUESTED, APPROVED, REJECTED, USED, EXPIRED, CANCELLED
	QRCodeData      string     `json:"qr_code_data"`
	ApprovedBy      *uuid.UUID `json:"approved_by,omitempty"`
	ApprovedAt      *time.Time `json:"approved_at,omitempty"`
	RejectionReason *string    `json:"rejection_reason,omitempty"`
	ActualExitAt    *time.Time `json:"actual_exit_at,omitempty"`
	ActualEntryAt   *time.Time `json:"actual_entry_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// CreateGatePassRequest contains payload to request a gate pass.
type CreateGatePassRequest struct {
	PassType    string    `json:"pass_type" binding:"required"` // DAY, OVERNIGHT, EMERGENCY
	Reason      string    `json:"reason" binding:"required"`
	Destination *string   `json:"destination"`
	ValidFrom   time.Time `json:"valid_from" binding:"required"`
	ValidUntil  time.Time `json:"valid_until" binding:"required"`
}

// AttendanceRecord represents an individual roll-call or biometric verification.
type AttendanceRecord struct {
	ID                 uuid.UUID  `json:"id"`
	StudentID          uuid.UUID  `json:"student_id"`
	AttendanceDate     time.Time  `json:"attendance_date"`
	SessionType        string     `json:"session_type"` // MORNING, EVENING_ROLL_CALL, NIGHT
	Status             string     `json:"status"`       // PRESENT, ABSENT, ON_LEAVE, LATE, EXCUSED
	VerificationMethod string     `json:"verification_method"`
	RecordedAt         time.Time  `json:"recorded_at"`
	Remarks            *string    `json:"remarks,omitempty"`
}

// AttendanceSummary represents roll-call aggregated metrics for the student.
type AttendanceSummary struct {
	StudentID            uuid.UUID          `json:"student_id"`
	TotalSessions        int                `json:"total_sessions"`
	PresentCount         int                `json:"present_count"`
	AbsentCount          int                `json:"absent_count"`
	OnLeaveCount         int                `json:"on_leave_count"`
	AttendancePercentage float64            `json:"attendance_percentage"`
	RecentRecords        []AttendanceRecord `json:"recent_records"`
}

// LeaveRequest represents a formal overnight or multi-day leave application.
type LeaveRequest struct {
	ID                  uuid.UUID  `json:"id"`
	CollegeID           uuid.UUID  `json:"college_id"`
	StudentID           uuid.UUID  `json:"student_id"`
	LeaveType           string     `json:"leave_type"` // HOME, MEDICAL, ACADEMIC, EMERGENCY
	StartDate           time.Time  `json:"start_date"`
	EndDate             time.Time  `json:"end_date"`
	Reason              string     `json:"reason"`
	ParentConsentStatus string     `json:"parent_consent_status"` // NOT_REQUIRED, PENDING, APPROVED, REJECTED
	Status              string     `json:"status"`                // PENDING, APPROVED, REJECTED, CANCELLED
	ApprovedBy          *uuid.UUID `json:"approved_by,omitempty"`
	ApprovedAt          *time.Time `json:"approved_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
}

// CreateLeaveRequest contains payload to apply for leave.
type CreateLeaveRequest struct {
	LeaveType     string    `json:"leave_type" binding:"required"`
	StartDate     time.Time `json:"start_date" binding:"required"`
	EndDate       time.Time `json:"end_date" binding:"required"`
	Reason        string    `json:"reason" binding:"required"`
	ParentConsent bool      `json:"parent_consent"`
}

// Complaint represents a student grievance or hostel maintenance complaint.
type Complaint struct {
	ID              uuid.UUID  `json:"id"`
	CollegeID       uuid.UUID  `json:"college_id"`
	StudentID       uuid.UUID  `json:"student_id"`
	HostelID        *uuid.UUID `json:"hostel_id,omitempty"`
	RoomID          *uuid.UUID `json:"room_id,omitempty"`
	Category        string     `json:"category"` // ELECTRICAL, PLUMBING, CARPENTRY, CLEANLINESS, INTERNET, OTHER
	Title           string     `json:"title"`
	Description     string     `json:"description"`
	Priority        string     `json:"priority"` // LOW, MEDIUM, HIGH, URGENT
	Status          string     `json:"status"`   // PENDING, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED
	AssignedTo      *uuid.UUID `json:"assigned_to,omitempty"`
	ResolutionNotes *string    `json:"resolution_notes,omitempty"`
	ResolvedAt      *time.Time `json:"resolved_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// CreateComplaintRequest contains payload to log a grievance or maintenance issue.
type CreateComplaintRequest struct {
	Category    string `json:"category" binding:"required"`
	Title       string `json:"title" binding:"required"`
	Description string `json:"description" binding:"required"`
	Priority    string `json:"priority"` // Default: MEDIUM
}

// MessMealItem represents a meal entry in the institutional dining menu.
type MessMealItem struct {
	MealType string   `json:"meal_type"` // BREAKFAST, LUNCH, SNACKS, DINNER
	Items    []string `json:"items"`
	Timings  string   `json:"timings"`
	IsVeg    bool     `json:"is_veg"`
	Special  bool     `json:"is_special"`
}

// TodayMessMenu represents the daily mess schedule.
type TodayMessMenu struct {
	DayOfWeek string         `json:"day_of_week"`
	Date      string         `json:"date"`
	Meals     []MessMealItem `json:"meals"`
	Notice    *string        `json:"notice,omitempty"`
}

// StudentActivity represents an event/audit record for student actions.
type StudentActivity struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // GATE_PASS, LEAVE, COMPLAINT
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
	Status      string    `json:"status"`
}

// DashboardSummary aggregates key status items for the student home screen.
type DashboardSummary struct {
	Profile           StudentProfile     `json:"profile"`
	CurrentRoom       *BedAllocation     `json:"current_room,omitempty"`
	ActiveGatePass    *GatePass          `json:"active_gate_pass,omitempty"`
	ActiveLeave       *LeaveRequest      `json:"active_leave,omitempty"`
	AttendanceSummary *AttendanceSummary `json:"attendance_summary,omitempty"`
	AttendancePercent *float64           `json:"attendance_percentage,omitempty"`
	OpenComplaints    int                `json:"open_complaints_count"`
	TodayMeals        *TodayMessMenu     `json:"today_meals,omitempty"`
	RecentPasses      []GatePass         `json:"recent_passes"`
	RecentLeaves      []LeaveRequest     `json:"recent_leaves"`
	RecentComplaints  []Complaint        `json:"recent_complaints"`
	RecentActivities  []StudentActivity  `json:"recent_activities"`
}

