package models

import (
	"time"

	"github.com/google/uuid"
)

// PermissionDetail represents a permission with module details and mapped roles.
type PermissionDetail struct {
	PermissionID     uuid.UUID `json:"permission_id" db:"permission_id"`
	ModuleID         uuid.UUID `json:"module_id" db:"module_id"`
	ModuleCode       string    `json:"module_code" db:"module_code"`
	ModuleName       string    `json:"module_name" db:"module_name"`
	PermissionCode   string    `json:"permission_code" db:"permission_code"`
	ScopeType        string    `json:"scope_type" db:"scope_type"`
	Description      *string   `json:"description" db:"description"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
	MappedRolesCount int       `json:"mapped_roles_count"`
	IsOrphan         bool      `json:"is_orphan"`
	MappedRoles      []RoleRef `json:"mapped_roles,omitempty"`
}

// RoleRef is a lightweight summary of a role mapped to a permission.
type RoleRef struct {
	RoleID       uuid.UUID `json:"role_id"`
	RoleCode     string    `json:"role_code"`
	RoleName     string    `json:"role_name"`
	Scope        string    `json:"scope"`
	IsSystemRole bool      `json:"is_system_role"`
}

// ListPermissionsFilter defines parameters for listing permissions.
type ListPermissionsFilter struct {
	ScopeType  string `form:"scope_type"`
	ModuleCode string `form:"module_code"`
	Search     string `form:"search"`
	IsOrphan   *bool  `form:"is_orphan"`
	Limit      int    `form:"limit"`
	Offset     int    `form:"offset"`
}

// ListPermissionsCatalogResponse represents the paginated response for permissions.
type ListPermissionsCatalogResponse struct {
	Permissions []PermissionDetail `json:"permissions"`
	Total       int                `json:"total"`
	Limit       int                `json:"limit"`
	Offset      int                `json:"offset"`
}

// PermissionUserAssignment represents a user assigned a role holding the permission.
// Safe fields only - excludes passwords, hashes, MFA secrets, and sensitive tokens.
type PermissionUserAssignment struct {
	UserID           uuid.UUID  `json:"user_id"`
	Email            string     `json:"email"`
	RoleID           uuid.UUID  `json:"role_id"`
	RoleCode         string     `json:"role_code"`
	RoleName         string     `json:"role_name"`
	Scope            string     `json:"scope"`
	CollegeID        *uuid.UUID `json:"college_id,omitempty"`
	CollegeName      *string    `json:"college_name,omitempty"`
	UserStatus       string     `json:"user_status"`
	AssignmentStatus string     `json:"assignment_status"`
	AssignedAt       time.Time  `json:"assigned_at"`
	ExpiresAt        *time.Time `json:"expires_at,omitempty"`
}

// WhoHasWhatResponse represents the response for the who-has-what view.
type WhoHasWhatResponse struct {
	Permission      PermissionDetail           `json:"permission"`
	MappedRoles     []RoleRef                  `json:"mapped_roles"`
	AssignedUsers   []PermissionUserAssignment `json:"assigned_users"`
	TotalRolesCount int                        `json:"total_roles_count"`
	TotalUsersCount int                        `json:"total_users_count"`
	ScopeNotice     string                     `json:"scope_notice"`
}

// OrphanPermissionsReport represents the orphan permissions audit report.
type OrphanPermissionsReport struct {
	Definition  string             `json:"definition"`
	Notice      string             `json:"notice"`
	TotalCount  int                `json:"total_count"`
	CatalogSize int                `json:"catalog_size"`
	Orphans     []PermissionDetail `json:"orphans"`
}

// DeprecationAdvisoryStatus documents the blocked deprecation lifecycle.
type DeprecationAdvisoryStatus struct {
	Supported           bool     `json:"supported"`
	Status              string   `json:"status"`
	Reason              string   `json:"reason"`
	SchemaBlocker       string   `json:"schema_blocker"`
	BlockedCapabilities []string `json:"blocked_capabilities"`
}

// PermissionAuditParams holds fields for recording permission operations in platform.audit_logs.
type PermissionAuditParams struct {
	ActorUserID  uuid.UUID
	ActorRole    string
	PermissionID uuid.UUID
	Action       string
	Details      map[string]interface{}
	Reason       string
}
