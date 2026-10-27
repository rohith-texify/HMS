package models

import (
	"time"

	"github.com/google/uuid"
)

// PlatformStaffRole defines canonical company staff roles from architecture.
// Note: In current database migrations, only SUPER_ADMIN is seeded with scope PLATFORM.
const (
	RolePlatformOwner       = "PO" // Platform Owner (highest privilege, break-glass)
	RoleSuperAdmin          = "SA" // Super Admin (day-to-day platform administration)
	RoleConfigurationAdmin  = "CA" // Configuration Admin (onboarding, matrix, structure)
	RoleSupportAdmin        = "SU" // Support Admin (troubleshooting, support access)
	RoleOperationsAdmin     = "OP" // Operations Admin (ops, notifications, reporting)
	RoleAuditor             = "AU" // Auditor (read-only audit, security events)

	// Canonical database role code
	CanonicalSuperAdminRole = "SUPER_ADMIN"
)

// PlatformStaffAccount represents a company / platform staff member.
// Sensitive fields like password hashes and internal secrets are NEVER serialized.
type PlatformStaffAccount struct {
	UserID      uuid.UUID  `json:"user_id" db:"user_id"`
	Email       string     `json:"email" db:"email"`
	Phone       *string    `json:"phone,omitempty" db:"phone"`
	Status      string     `json:"status" db:"status"`
	RoleCode    string     `json:"role_code" db:"role_code"`
	RoleName    string     `json:"role_name" db:"role_name"`
	RoleScope   string     `json:"role_scope" db:"role_scope"`
	MFAEnabled  bool       `json:"mfa_enabled" db:"mfa_enabled"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty" db:"last_login_at"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// ListPlatformStaffParams defines query parameters for listing platform staff.
type ListPlatformStaffParams struct {
	Status string `form:"status" binding:"omitempty,oneof=ACTIVE LOCKED SUSPENDED DEACTIVATED INVITED"`
	Limit  int    `form:"limit" binding:"omitempty,min=1,max=100"`
	Offset int    `form:"offset" binding:"omitempty,min=0"`
}

// ListPlatformStaffResponse represents the paginated response for platform staff accounts.
type ListPlatformStaffResponse struct {
	Staff  []PlatformStaffAccount `json:"staff"`
	Total  int                    `json:"total"`
	Limit  int                    `json:"limit"`
	Offset int                    `json:"offset"`
}

// UpdatePlatformStaffProfileRequest represents the payload for editing permitted staff profile fields.
type UpdatePlatformStaffProfileRequest struct {
	Phone *string `json:"phone,omitempty" binding:"omitempty,max=30"`
}

// UpdatePlatformStaffStatusRequest represents the payload for activating, suspending, or deactivating staff.
type UpdatePlatformStaffStatusRequest struct {
	Status string `json:"status" binding:"required,oneof=ACTIVE SUSPENDED DEACTIVATED"`
	Reason string `json:"reason" binding:"required,min=3,max=500"`
}

// StaffPendingApprovalItem represents a pending approval step assigned to a staff member.
type StaffPendingApprovalItem struct {
	ApprovalStepID uuid.UUID  `json:"approval_step_id"`
	RequestID      uuid.UUID  `json:"request_id"`
	OperationType  string     `json:"operation_type"`
	CollegeID      *uuid.UUID `json:"college_id,omitempty"`
	RequestedBy    *uuid.UUID `json:"requested_by,omitempty"`
	StepOrder      int        `json:"step_order"`
	Reason         *string    `json:"reason,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
}

// StaffPendingApprovalsResponse represents the list of pending approvals owned by a staff member.
type StaffPendingApprovalsResponse struct {
	UserID           uuid.UUID                  `json:"user_id"`
	PendingApprovals []StaffPendingApprovalItem `json:"pending_approvals"`
	TotalPending     int                        `json:"total_pending"`
}
