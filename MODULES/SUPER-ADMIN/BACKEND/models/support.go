package models

import (
	"time"

	"github.com/google/uuid"
)

// SupportGrant represents a row in platform.support_access_grants for scoped, time-boxed tenant access.
type SupportGrant struct {
	GrantID         uuid.UUID  `json:"grant_id"`
	GranteeID       uuid.UUID  `json:"grantee_id"`
	GranteeEmail    string     `json:"grantee_email,omitempty"`
	CollegeID       uuid.UUID  `json:"college_id"`
	CollegeCode     string     `json:"college_code,omitempty"`
	CollegeName     string     `json:"college_name,omitempty"`
	Scope           JSONB      `json:"scope"`
	Reason          string     `json:"reason"`
	TicketRef       string     `json:"ticket_ref"`
	ApprovedBy      uuid.UUID  `json:"approved_by"`
	ApprovedByName  string     `json:"approved_by_name,omitempty"`
	StartsAt        time.Time  `json:"starts_at"`
	ExpiresAt       time.Time  `json:"expires_at"`
	RevokedAt       *time.Time `json:"revoked_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	IsActive        bool       `json:"is_active"`
}

// CreateSupportGrantRequest defines the parameters to create a scoped support access grant.
type CreateSupportGrantRequest struct {
	CollegeID       uuid.UUID `json:"college_id" binding:"required"`
	GranteeID       uuid.UUID `json:"grantee_id" binding:"required"`
	DurationMinutes int       `json:"duration_minutes" binding:"required"` // e.g., 30, 60, 120
	Reason          string    `json:"reason" binding:"required"`
	TicketRef       string    `json:"ticket_ref" binding:"required"`
	Scope           JSONB     `json:"scope"`
}

// EntitlementDiagnosticReport details why a module or setting access is granted or denied for a college.
type EntitlementDiagnosticReport struct {
	CollegeID            uuid.UUID              `json:"college_id"`
	CollegeCode          string                 `json:"college_code"`
	CollegeStatus        string                 `json:"college_status"`
	ModuleCode           string                 `json:"module_code"`
	ModuleFound          bool                   `json:"module_found"`
	ModuleActiveInCatalog bool                  `json:"module_active_in_catalog"`
	IsEntitled           bool                   `json:"is_entitled"`
	EntitlementStatus    string                 `json:"entitlement_status"` // ACTIVE, DISABLED, INHERITED, NOT_FOUND
	EntitlementMode      string                 `json:"entitlement_mode"`   // FULL, READ_ONLY
	IsAccessPermitted    bool                   `json:"is_access_permitted"`
	EvaluationVerdict    string                 `json:"evaluation_verdict"`
	Blockers             []string               `json:"blockers,omitempty"`
	EvaluatedAt          time.Time              `json:"evaluated_at"`
}

// MaskedStudentLookupResult represents a privacy-safe, minimally scoped student record for support troubleshooting.
type MaskedStudentLookupResult struct {
	StudentID       uuid.UUID `json:"student_id"`
	CollegeID       uuid.UUID `json:"college_id"`
	CollegeCode     string    `json:"college_code"`
	AdmissionNumber string    `json:"admission_number"`
	MaskedName      string    `json:"masked_name"`
	MaskedEmail     string    `json:"masked_email"`
	StudentStatus   string    `json:"student_status"`
	HostelStatus    string    `json:"hostel_status"`
	LookupAudited   bool      `json:"lookup_audited"`
}
