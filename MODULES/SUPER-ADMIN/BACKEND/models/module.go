package models

import (
	"time"

	"github.com/google/uuid"
)

// Module represents a platform module in the catalogue.
type Module struct {
	ModuleID   uuid.UUID  `json:"module_id" db:"module_id"`
	ModuleCode string     `json:"module_code" db:"module_code"`
	ModuleName string     `json:"module_name" db:"module_name"`
	ParentID   *uuid.UUID `json:"parent_id,omitempty" db:"parent_id"`
	Kind       string     `json:"kind" db:"kind"`
	Priority   string     `json:"priority" db:"priority"`
	IsCore     bool       `json:"is_core" db:"is_core"`
	IsActive   bool       `json:"is_active" db:"is_active"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at" db:"updated_at"`
}

// CreateModuleRequest represents the payload for creating a new module.
type CreateModuleRequest struct {
	ModuleCode string     `json:"module_code" binding:"required"`
	ModuleName string     `json:"module_name" binding:"required"`
	ParentID   *uuid.UUID `json:"parent_id,omitempty"`
	Kind       string     `json:"kind" binding:"required,oneof=APP MODULE FEATURE"`
	Priority   string     `json:"priority,omitempty" binding:"omitempty,oneof=M S R"`
	IsCore     bool       `json:"is_core"`
	IsActive   *bool      `json:"is_active,omitempty"`
}

// UpdateModuleRequest represents the payload for updating an existing module.
type UpdateModuleRequest struct {
	ModuleName *string    `json:"module_name,omitempty"`
	ParentID   *uuid.UUID `json:"parent_id,omitempty"`
	Kind       *string    `json:"kind,omitempty"`
	Priority   *string    `json:"priority,omitempty"`
	IsCore     *bool      `json:"is_core,omitempty"`
	IsActive   *bool      `json:"is_active,omitempty"`
}

// ToggleModuleStatusRequest represents the payload for enabling or disabling a module.
type ToggleModuleStatusRequest struct {
	IsActive bool   `json:"is_active"`
	Reason   string `json:"reason,omitempty"`
}

// CollegeModule represents a module enabled for a specific college.
type CollegeModule struct {
	CollegeModuleID uuid.UUID  `json:"college_module_id" db:"college_module_id"`
	CollegeID       uuid.UUID  `json:"college_id" db:"college_id"`
	ModuleID        uuid.UUID  `json:"module_id" db:"module_id"`
	Status          string     `json:"status" db:"status"`
	Mode            string     `json:"mode" db:"mode"`
	EffectiveFrom   time.Time  `json:"effective_from" db:"effective_from"`
	EffectiveTo     *time.Time `json:"effective_to,omitempty" db:"effective_to"`
	Reason          *string    `json:"reason,omitempty" db:"reason"`
	ChangedBy       *uuid.UUID `json:"changed_by,omitempty" db:"changed_by"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// CollegeModuleWithDetails combines CollegeModule with Module information.
type CollegeModuleWithDetails struct {
	CollegeModuleID uuid.UUID  `json:"college_module_id" db:"college_module_id"`
	CollegeID       uuid.UUID  `json:"college_id" db:"college_id"`
	ModuleID        uuid.UUID  `json:"module_id" db:"module_id"`
	ModuleCode      string     `json:"module_code" db:"module_code"`
	ModuleName      string     `json:"module_name" db:"module_name"`
	Kind            string     `json:"kind,omitempty" db:"kind"`
	ParentID        *uuid.UUID `json:"parent_id,omitempty" db:"parent_id"`
	Priority        string     `json:"priority,omitempty" db:"priority"`
	IsCore          bool       `json:"is_core,omitempty" db:"is_core"`
	Status          string     `json:"status" db:"status"`
	Mode            string     `json:"mode" db:"mode"`
	EffectiveFrom   time.Time  `json:"effective_from" db:"effective_from"`
	EffectiveTo     *time.Time `json:"effective_to,omitempty" db:"effective_to"`
	Reason          *string    `json:"reason,omitempty" db:"reason"`
	ChangedBy       *uuid.UUID `json:"changed_by,omitempty" db:"changed_by"`
	CreatedAt       time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// AssignCollegeModuleRequest represents the payload for assigning a module to a college.
type AssignCollegeModuleRequest struct {
	ModuleID      uuid.UUID  `json:"module_id" binding:"required"`
	Status        string     `json:"status" binding:"required,oneof=ACTIVE DISABLED SCHEDULED"`
	Mode          string     `json:"mode" binding:"required,oneof=FULL READ_ONLY"`
	EffectiveFrom *time.Time `json:"effective_from,omitempty"`
	EffectiveTo   *time.Time `json:"effective_to,omitempty"`
	Reason        *string    `json:"reason,omitempty" binding:"omitempty,max=500"`
	ChangeReason  *string    `json:"change_reason,omitempty" binding:"omitempty,max=500"`
}

// UpdateCollegeModuleRequest represents the payload for updating college module availability.
type UpdateCollegeModuleRequest struct {
	Status        string     `json:"status" binding:"required,oneof=ACTIVE DISABLED SCHEDULED"`
	Mode          string     `json:"mode" binding:"required,oneof=FULL READ_ONLY"`
	EffectiveFrom *time.Time `json:"effective_from,omitempty"`
	EffectiveTo   *time.Time `json:"effective_to,omitempty"`
	Reason        *string    `json:"reason,omitempty" binding:"omitempty,max=500"`
	ChangeReason  *string    `json:"change_reason,omitempty" binding:"omitempty,max=500"`
}

// ListModulesParams represents query parameters for listing modules.
type ListModulesParams struct {
	Kind     string `form:"kind" binding:"omitempty,oneof=APP MODULE FEATURE"`
	IsActive *bool  `form:"is_active"`
	Limit    int    `form:"limit" binding:"omitempty,min=1,max=100"`
	Offset   int    `form:"offset" binding:"omitempty,min=0"`
}

// ModuleAuditParams represents audit logging parameters for module management operations.
type ModuleAuditParams struct {
	CollegeID   *uuid.UUID
	ActorUserID uuid.UUID
	ActorRole   string
	Module      string
	Action      string
	EntityType  string
	EntityID    *uuid.UUID
	OldData     interface{}
	NewData     interface{}
	Reason      *string
	Severity    string
}

// ModuleImpactPreview represents the impact analysis before modifying or disabling an entitlement.
type ModuleImpactPreview struct {
	CollegeID               uuid.UUID `json:"college_id"`
	ModuleID                uuid.UUID `json:"module_id"`
	ModuleCode              string    `json:"module_code"`
	ModuleName              string    `json:"module_name"`
	CurrentStatus           string    `json:"current_status"`
	CurrentMode             string    `json:"current_mode"`
	ProposedStatus          string    `json:"proposed_status"`
	ProposedMode            string    `json:"proposed_mode"`
	IsMandatory             bool      `json:"is_mandatory"`
	DependentModulesCount   int       `json:"dependent_modules_count"`
	DependentModules        []string  `json:"dependent_modules"`
	PendingWorkflowsCount   int       `json:"pending_workflows_count"`
	PendingWorkflowsSummary []string  `json:"pending_workflows_summary"`
	RequiresApproval        bool      `json:"requires_approval"`
	ApprovalReason          string    `json:"approval_reason,omitempty"`
	CanProceedSafely        bool      `json:"can_proceed_safely"`
	RestrictionMessage      string    `json:"restriction_message,omitempty"`
	PendingApprovalID       *uuid.UUID `json:"pending_approval_id,omitempty"`
}

// ModuleHistoryItem represents an immutable audit log record for module and entitlement operations.
type ModuleHistoryItem struct {
	AuditID     uuid.UUID   `json:"audit_id"`
	CollegeID   *uuid.UUID  `json:"college_id,omitempty"`
	ActorUserID uuid.UUID   `json:"actor_user_id"`
	ActorRole   string      `json:"actor_role"`
	Action      string      `json:"action"`
	EntityType  string      `json:"entity_type"`
	EntityID    *uuid.UUID  `json:"entity_id,omitempty"`
	OldData     interface{} `json:"old_data,omitempty"`
	NewData     interface{} `json:"new_data,omitempty"`
	Reason      *string     `json:"reason,omitempty"`
	Severity    string      `json:"severity"`
	CreatedAt   time.Time   `json:"created_at"`
}

// CollegeEntitlementMatrixItem represents an authoritative row in the college module entitlement matrix.
type CollegeEntitlementMatrixItem struct {
	CollegeModuleID       *uuid.UUID `json:"college_module_id,omitempty"`
	CollegeID             uuid.UUID  `json:"college_id"`
	ModuleID              uuid.UUID  `json:"module_id"`
	ModuleCode            string     `json:"module_code"`
	ModuleName            string     `json:"module_name"`
	Kind                  string     `json:"kind"`
	ParentID              *uuid.UUID `json:"parent_id,omitempty"`
	ParentCode            string     `json:"parent_code,omitempty"`
	ParentName            string     `json:"parent_name,omitempty"`
	Priority              string     `json:"priority"`
	IsCore                bool       `json:"is_core"`
	CatalogueActive       bool       `json:"catalogue_active"`
	ConfiguredStatus      string     `json:"configured_status"`
	ConfiguredMode        string     `json:"configured_mode"`
	EffectiveStatus       string     `json:"effective_status"`
	EffectiveMode         string     `json:"effective_mode"`
	EffectiveFrom         *time.Time `json:"effective_from,omitempty"`
	EffectiveTo           *time.Time `json:"effective_to,omitempty"`
	Reason                *string    `json:"reason,omitempty"`
	ChangedBy             *uuid.UUID `json:"changed_by,omitempty"`
	UpdatedAt             *time.Time `json:"updated_at,omitempty"`
	PendingApprovalID     *uuid.UUID `json:"pending_approval_id,omitempty"`
	PendingApprovalStatus string     `json:"pending_approval_status,omitempty"`
	PendingWorkflowsCount int        `json:"pending_workflows_count"`
	DependenciesSatisfied bool       `json:"dependencies_satisfied"`
	MissingDependencies   []string   `json:"missing_dependencies,omitempty"`
	DependentModules      []string   `json:"dependent_modules,omitempty"`
}

