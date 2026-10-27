package models

import (
	"time"

	"github.com/google/uuid"
)

// College represents a platform college/tenant.
type College struct {
	CollegeID       uuid.UUID  `json:"college_id" db:"college_id"`
	CollegeCode     string     `json:"college_code" db:"college_code"`
	Name            string     `json:"name" db:"name"`
	City            *string    `json:"city,omitempty" db:"city"`
	State           *string    `json:"state,omitempty" db:"state"`
	Timezone        string     `json:"timezone" db:"timezone"`
	Status          string     `json:"status" db:"status"`
	ContactEmail    *string    `json:"contact_email,omitempty" db:"contact_email"`
	LocationType    *string    `json:"location_type,omitempty" db:"location_type"`
	StateCode       *string    `json:"state_code,omitempty" db:"state_code"`
	DistrictCode    *string    `json:"district_code,omitempty" db:"district_code"`
	SubdistrictCode *string    `json:"subdistrict_code,omitempty" db:"subdistrict_code"`
	BlockCode       *string    `json:"block_code,omitempty" db:"block_code"`
	CityCode        *string    `json:"city_code,omitempty" db:"city_code"`
	WardCode        *string    `json:"ward_code,omitempty" db:"ward_code"`
	VillageCode     *string    `json:"village_code,omitempty" db:"village_code"`
	CampusLocality  *string    `json:"campus_locality,omitempty" db:"campus_locality"`
	ActivatedAt     *time.Time `json:"activated_at,omitempty" db:"activated_at"`
	SuspendedAt     *time.Time `json:"suspended_at,omitempty" db:"suspended_at"`
	DeactivatedAt   *time.Time `json:"deactivated_at,omitempty" db:"deactivated_at"`
	ArchivedAt      *time.Time `json:"archived_at,omitempty" db:"archived_at"`
	LifecycleReason *string    `json:"lifecycle_reason,omitempty" db:"lifecycle_reason"`
	CreatedAt       time.Time            `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time            `json:"updated_at" db:"updated_at"`
	Admin           *CollegeAdminAccount `json:"admin,omitempty" db:"-"`
}

// CollegeAdminAccount represents the administrator account associated with a college.
type CollegeAdminAccount struct {
	UserID      uuid.UUID  `json:"user_id" db:"user_id"`
	CollegeID   uuid.UUID  `json:"college_id" db:"college_id"`
	Email       string     `json:"email" db:"email"`
	Phone       *string    `json:"phone,omitempty" db:"phone"`
	Status      string     `json:"status" db:"status"`
	RoleCode    string     `json:"role_code" db:"role_code"`
	RoleName    string     `json:"role_name" db:"role_name"`
	HasPassword bool       `json:"has_password" db:"has_password"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty" db:"last_login_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// ListCollegeAdminsParams represents query parameters for listing college administrators.
type ListCollegeAdminsParams struct {
	Status string `form:"status" binding:"omitempty,oneof=ACTIVE LOCKED SUSPENDED DEACTIVATED INVITED"`
	Limit  int    `form:"limit" binding:"omitempty,min=1,max=100"`
	Offset int    `form:"offset" binding:"omitempty,min=0"`
}

// ListCollegeAdminsResponse represents the paginated response for college administrators.
type ListCollegeAdminsResponse struct {
	CollegeID uuid.UUID             `json:"college_id"`
	Admins    []CollegeAdminAccount `json:"admins"`
	Total     int                   `json:"total"`
	Limit     int                   `json:"limit"`
	Offset    int                   `json:"offset"`
}

// ProvisionFirstCollegeAdminRequest represents the payload for provisioning a college's first admin.
type ProvisionFirstCollegeAdminRequest struct {
	Email    string  `json:"email" binding:"required,email,max=255"`
	Phone    *string `json:"phone,omitempty" binding:"omitempty,max=30"`
	Password string  `json:"password" binding:"required,min=8,max=128"`
}

// UpdateCollegeAdminProfileRequest represents the payload for editing permitted administrator fields.
type UpdateCollegeAdminProfileRequest struct {
	Phone *string `json:"phone,omitempty" binding:"omitempty,max=30"`
}

// UpdateCollegeAdminStatusRequest represents the payload for updating an administrator's account status.
type UpdateCollegeAdminStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=ACTIVE SUSPENDED DEACTIVATED"`
	Reason string `json:"reason" binding:"required,min=3,max=500"`
}

// CollegeAdminLoginHistoryItem represents an entry from platform.login_events.
type CollegeAdminLoginHistoryItem struct {
	LoginEventID uuid.UUID `json:"login_event_id"`
	UserID       uuid.UUID `json:"user_id"`
	CollegeID    uuid.UUID `json:"college_id"`
	Result       string    `json:"result"`
	IPAddress    *string   `json:"ip_address,omitempty"`
	Device       *string   `json:"device,omitempty"`
	UserAgent    *string   `json:"user_agent,omitempty"`
	EventAt      time.Time `json:"event_at"`
}

// UpdateCollegeAdminPasswordRequest represents the payload for setting or updating a college admin's password.
type UpdateCollegeAdminPasswordRequest struct {
	Password   string  `json:"password" binding:"required,min=8,max=128"`
	AdminEmail *string `json:"admin_email,omitempty" binding:"omitempty,email"`
}

// CreateCollegeRequest represents the payload for creating a college.
type CreateCollegeRequest struct {
	CollegeCode     string  `json:"college_code" binding:"required,max=100"`
	Name            string  `json:"name" binding:"required,max=200"`
	City            *string `json:"city,omitempty" binding:"omitempty,max=100"`
	State           *string `json:"state,omitempty" binding:"omitempty,max=100"`
	Timezone        string  `json:"timezone" binding:"omitempty,max=100"`
	ContactEmail    *string `json:"contact_email,omitempty" binding:"omitempty,email"`
	AdminEmail      *string `json:"admin_email,omitempty" binding:"omitempty,email"`
	Password        *string `json:"password,omitempty" binding:"omitempty,min=8,max=128"`
	LocationType    *string `json:"location_type,omitempty" binding:"omitempty,oneof=URBAN RURAL"`
	StateCode       *string `json:"state_code,omitempty" binding:"omitempty,max=10"`
	DistrictCode    *string `json:"district_code,omitempty" binding:"omitempty,max=20"`
	SubdistrictCode *string `json:"subdistrict_code,omitempty" binding:"omitempty,max=20"`
	BlockCode       *string `json:"block_code,omitempty" binding:"omitempty,max=20"`
	CityCode        *string `json:"city_code,omitempty" binding:"omitempty,max=20"`
	WardCode        *string `json:"ward_code,omitempty" binding:"omitempty,max=20"`
	VillageCode     *string `json:"village_code,omitempty" binding:"omitempty,max=20"`
	CampusLocality  *string `json:"campus_locality,omitempty" binding:"omitempty,max=500"`
}

// UpdateCollegeRequest represents the payload for updating a college.
type UpdateCollegeRequest struct {
	Name            *string `json:"name,omitempty" binding:"omitempty,max=200"`
	City            *string `json:"city,omitempty" binding:"omitempty,max=100"`
	State           *string `json:"state,omitempty" binding:"omitempty,max=100"`
	Timezone        *string `json:"timezone,omitempty" binding:"omitempty,max=100"`
	LocationType    *string `json:"location_type,omitempty" binding:"omitempty,oneof=URBAN RURAL"`
	StateCode       *string `json:"state_code,omitempty" binding:"omitempty,max=10"`
	DistrictCode    *string `json:"district_code,omitempty" binding:"omitempty,max=20"`
	SubdistrictCode *string `json:"subdistrict_code,omitempty" binding:"omitempty,max=20"`
	BlockCode       *string `json:"block_code,omitempty" binding:"omitempty,max=20"`
	CityCode        *string `json:"city_code,omitempty" binding:"omitempty,max=20"`
	WardCode        *string `json:"ward_code,omitempty" binding:"omitempty,max=20"`
	VillageCode     *string `json:"village_code,omitempty" binding:"omitempty,max=20"`
	CampusLocality  *string `json:"campus_locality,omitempty" binding:"omitempty,max=500"`

	ContactEmail *string `json:"contact_email,omitempty" binding:"omitempty,email"`
}

// UpdateCollegeStatusRequest represents the payload for updating college status.
type UpdateCollegeStatusRequest struct {
	Status          string  `json:"status" binding:"required,oneof=ONBOARDING ACTIVE SUSPENDED DEACTIVATED"`
	Reason          *string `json:"reason,omitempty" binding:"omitempty,max=500"`
	LifecycleReason *string `json:"lifecycle_reason,omitempty" binding:"omitempty,max=500"`
}

// GetReason returns the lifecycle reason from either LifecycleReason or Reason.
func (r *UpdateCollegeStatusRequest) GetReason() string {
	if r.LifecycleReason != nil && *r.LifecycleReason != "" {
		return *r.LifecycleReason
	}
	if r.Reason != nil && *r.Reason != "" {
		return *r.Reason
	}
	return ""
}

// CollegeOnboardingStep represents an onboarding checklist item.
type CollegeOnboardingStep struct {
	OnboardingID uuid.UUID  `json:"onboarding_id" db:"onboarding_id"`
	CollegeID    uuid.UUID  `json:"college_id" db:"college_id"`
	StepCode     string     `json:"step_code" db:"step_code"`
	Status       string     `json:"status" db:"status"`
	CompletedBy  *uuid.UUID `json:"completed_by,omitempty" db:"completed_by"`
	CompletedAt  *time.Time `json:"completed_at,omitempty" db:"completed_at"`
	Notes        *string    `json:"notes,omitempty" db:"notes"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at" db:"updated_at"`
}

// UpdateCollegeOnboardingRequest represents the payload for updating an onboarding step.
type UpdateCollegeOnboardingRequest struct {
	Status string  `json:"status" binding:"required,oneof=PENDING IN_PROGRESS COMPLETED SKIPPED FAILED"`
	Notes  *string `json:"notes,omitempty" binding:"omitempty,max=1000"`
}

// ListCollegesParams represents query parameters for listing colleges.
type ListCollegesParams struct {
	Status string `form:"status" binding:"omitempty,oneof=ONBOARDING ACTIVE SUSPENDED DEACTIVATED"`
	Search string `form:"search" binding:"omitempty,max=100"`
	Limit  int    `form:"limit" binding:"omitempty,min=1,max=100"`
	Offset int    `form:"offset" binding:"omitempty,min=0"`
}

// CollegeReadinessGate represents a single evaluated go-live gate.
type CollegeReadinessGate struct {
	GateCode    string                 `json:"gate_code"`
	Name        string                 `json:"name"`
	Status      string                 `json:"status"` // PASSED, FAILED, BLOCKED, UNAVAILABLE, PENDING
	IsMandatory bool                   `json:"is_mandatory"`
	Message     string                 `json:"message"`
	Details     map[string]interface{} `json:"details,omitempty"`
	ActionStep  string                 `json:"action_step,omitempty"`
}

// ReadinessSummary provides a high-level tally of passed and mandatory gates.
type ReadinessSummary struct {
	PassedGates     int `json:"passed_gates"`
	TotalGates      int `json:"total_gates"`
	MandatoryPassed int `json:"mandatory_passed"`
	TotalMandatory  int `json:"total_mandatory"`
}

// CollegeReadinessResponse represents the comprehensive onboarding readiness status of a college.
type CollegeReadinessResponse struct {
	CollegeID          uuid.UUID               `json:"college_id"`
	CollegeCode        string                  `json:"college_code"`
	Name               string                  `json:"name"`
	Status             string                  `json:"status"`
	IsReady            bool                    `json:"is_ready"`
	ProgressPercentage int                     `json:"progress_percentage"`
	Summary            ReadinessSummary        `json:"summary"`
	Gates              []CollegeReadinessGate  `json:"gates"`
	CanonicalSteps     []CollegeOnboardingStep `json:"canonical_steps"`
	NextAction         string                  `json:"next_action,omitempty"`
}

// CollegeOnboardingSummary represents a college item in the onboarding pipeline.
type CollegeOnboardingSummary struct {
	CollegeID          uuid.UUID  `json:"college_id"`
	CollegeCode        string     `json:"college_code"`
	Name               string     `json:"name"`
	Status             string     `json:"status"`
	City               *string    `json:"city,omitempty"`
	State              *string    `json:"state,omitempty"`
	CompletedSteps     int        `json:"completed_steps"`
	TotalSteps         int        `json:"total_steps"`
	ProgressPercentage int        `json:"progress_percentage"`
	CurrentStep        string     `json:"current_step"`
	IsReadyForGoLive   bool       `json:"is_ready_for_go_live"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
	ActivatedAt        *time.Time `json:"activated_at,omitempty"`
}

// NotificationTestResult represents the result of testing a tenant notification channel.
type NotificationTestResult struct {
	CollegeID uuid.UUID              `json:"college_id"`
	Status    string                 `json:"status"` // UNAVAILABLE, NOT_CONFIGURED
	Message   string                 `json:"message"`
	Details   map[string]interface{} `json:"details,omitempty"`
}

