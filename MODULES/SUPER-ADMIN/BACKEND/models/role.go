package models

import (
	"time"

	"github.com/google/uuid"
)

// Role represents a system or custom authorization role.
type Role struct {
	RoleID          uuid.UUID `json:"role_id" db:"role_id"`
	RoleCode        string    `json:"role_code" db:"role_code"`
	RoleName        string    `json:"role_name" db:"role_name"`
	Scope           string    `json:"scope" db:"scope"`
	IsSystemRole    bool      `json:"is_system_role" db:"is_system_role"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time `json:"updated_at" db:"updated_at"`
	PermissionCount int       `json:"permission_count"`
	UserCount       int       `json:"user_count"`
}

// RoleDetail represents a role with its full mapped permission list.
type RoleDetail struct {
	Role
	Permissions []Permission `json:"permissions"`
}

// Permission represents an atomic permission in the catalog.
type Permission struct {
	PermissionID   uuid.UUID `json:"permission_id" db:"permission_id"`
	ModuleID       uuid.UUID `json:"module_id" db:"module_id"`
	ModuleCode     string    `json:"module_code" db:"module_code"`
	ModuleName     string    `json:"module_name" db:"module_name"`
	PermissionCode string    `json:"permission_code" db:"permission_code"`
	ScopeType      string    `json:"scope_type" db:"scope_type"`
	Description    *string   `json:"description" db:"description"`
}

// ListRolesParams defines query parameters for listing roles.
type ListRolesParams struct {
	Scope        string `form:"scope" binding:"omitempty,oneof=PLATFORM COLLEGE ALL"`
	IsSystemRole *bool  `form:"is_system_role"`
	Search       string `form:"search"`
	Limit        int    `form:"limit" binding:"omitempty,min=1,max=100"`
	Offset       int    `form:"offset" binding:"omitempty,min=0"`
}

// ListRolesResponse represents the paginated response of roles.
type ListRolesResponse struct {
	Roles  []Role `json:"roles"`
	Total  int    `json:"total"`
	Limit  int    `json:"limit"`
	Offset int    `json:"offset"`
}

// CreateRoleRequest represents the payload for creating a custom role.
type CreateRoleRequest struct {
	RoleCode      string      `json:"role_code" binding:"required,min=2,max=100"`
	RoleName      string      `json:"role_name" binding:"required,min=2,max=150"`
	Scope         string      `json:"scope" binding:"required,oneof=COLLEGE PLATFORM"`
	PermissionIDs []uuid.UUID `json:"permission_ids"`
}

// CloneRoleRequest represents the payload for cloning an existing role into a new custom role.
type CloneRoleRequest struct {
	NewRoleCode        string `json:"new_role_code" binding:"required,min=2,max=100"`
	NewRoleName        string `json:"new_role_name" binding:"required,min=2,max=150"`
	IncludePermissions bool   `json:"include_permissions"`
}

// UpdateRoleRequest represents the payload for updating an existing custom role's metadata.
type UpdateRoleRequest struct {
	RoleName string `json:"role_name" binding:"required,min=2,max=150"`
}

// UpdateRolePermissionsRequest represents the payload for updating mapped permissions.
type UpdateRolePermissionsRequest struct {
	PermissionIDs []uuid.UUID `json:"permission_ids" binding:"required"`
	Reason        string      `json:"reason" binding:"required,min=3,max=500"`
}

// RoleAuditParams holds fields for recording role operations in platform.audit_logs.
type RoleAuditParams struct {
	ActorUserID uuid.UUID
	ActorRole   string
	RoleID      uuid.UUID
	Action      string
	Details     map[string]interface{}
	Reason      string
}
