package models

import (
	"time"

	"github.com/google/uuid"
)

// ActionEntitlement represents granular action-level access within a feature or module.
type ActionEntitlement struct {
	ActionCode      string `json:"action_code"`
	ActionName      string `json:"action_name"`
	IsMutateAction  bool   `json:"is_mutate_action"`
	EffectiveAccess string `json:"effective_access"` // ALLOWED, RESTRICTED_READ_ONLY, DISABLED
	RestrictionNote string `json:"restriction_note,omitempty"`
}

// HierarchicalAccessItem represents an App, Module, or Feature in the access hierarchy.
type HierarchicalAccessItem struct {
	ModuleID              uuid.UUID                `json:"module_id"`
	ModuleCode            string                   `json:"module_code"`
	ModuleName            string                   `json:"module_name"`
	Kind                  string                   `json:"kind"` // APP, MODULE, FEATURE
	ParentID              *uuid.UUID               `json:"parent_id,omitempty"`
	ParentCode            string                   `json:"parent_code,omitempty"`
	ParentName            string                   `json:"parent_name,omitempty"`
	Priority              string                   `json:"priority"`
	IsCore                bool                     `json:"is_core"`
	CatalogueActive       bool                     `json:"catalogue_active"`
	CollegeModuleID       *uuid.UUID               `json:"college_module_id,omitempty"`
	CollegeID             uuid.UUID                `json:"college_id"`
	ConfiguredStatus      string                   `json:"configured_status"` // ACTIVE, DISABLED, SCHEDULED, NOT_CONFIGURED
	ConfiguredMode        string                   `json:"configured_mode"`   // FULL, READ_ONLY
	EffectiveStatus       string                   `json:"effective_status"`  // ACTIVE, DISABLED, SCHEDULED
	EffectiveMode         string                   `json:"effective_mode"`    // FULL, READ_ONLY
	InheritedDisabled     bool                     `json:"inherited_disabled"`
	InheritanceSource     string                   `json:"inheritance_source,omitempty"`
	EffectiveFrom         *time.Time               `json:"effective_from,omitempty"`
	EffectiveTo           *time.Time               `json:"effective_to,omitempty"`
	Reason                *string                  `json:"reason,omitempty"`
	Actions               []ActionEntitlement      `json:"actions,omitempty"`
	Children              []HierarchicalAccessItem `json:"children,omitempty"`
	DependenciesSatisfied bool                     `json:"dependencies_satisfied"`
	MissingDependencies   []string                 `json:"missing_dependencies,omitempty"`
}

// HierarchicalAccessMatrixResponse represents the tenant's full access tree.
type HierarchicalAccessMatrixResponse struct {
	CollegeID   uuid.UUID                `json:"college_id"`
	CollegeCode string                   `json:"college_code"`
	CollegeName string                   `json:"college_name"`
	Status      string                   `json:"college_status"`
	Hierarchy   []HierarchicalAccessItem `json:"hierarchy"`
	TotalItems  int                      `json:"total_items"`
	ActiveItems int                      `json:"active_items"`
}

// UpdateFeatureAccessRequest represents payload to configure a feature or module entitlement.
type UpdateFeatureAccessRequest struct {
	Status        string     `json:"status" binding:"required,oneof=ACTIVE DISABLED SCHEDULED"`
	Mode          string     `json:"mode" binding:"required,oneof=FULL READ_ONLY"`
	EffectiveFrom *time.Time `json:"effective_from,omitempty"`
	EffectiveTo   *time.Time `json:"effective_to,omitempty"`
	Reason        string     `json:"reason" binding:"required,min=3,max=500"`
}

// EvaluateAccessRequest specifies parameters to test access and explain outcomes.
type EvaluateAccessRequest struct {
	CollegeID           uuid.UUID  `json:"college_id,omitempty"`
	UserID              *uuid.UUID `json:"user_id,omitempty"`
	ModuleOrFeatureCode string     `json:"module_or_feature_code" binding:"required"`
	Action              string     `json:"action,omitempty"`       // e.g. "view", "manage", "edit", "delete"
	HTTPMethod          string     `json:"http_method,omitempty"`   // e.g. "GET", "POST", "PUT", "PATCH", "DELETE"
}

// EvaluationStep describes a single check in the access evaluation pipeline.
type EvaluationStep struct {
	Stage   string `json:"stage"`   // TENANT_STATUS, CATALOGUE_STATUS, PARENT_INHERITANCE, TENANT_ENTITLEMENT, READ_ONLY_CHECK, USER_PERMISSION
	Rule    string `json:"rule"`    // Explanation of the rule evaluated
	Status  string `json:"status"`  // PASS, FAIL, SKIPPED
	Details string `json:"details"` // Diagnostic details
}

// WhyDeniedEvaluationReport provides transparent "Why is this denied?" diagnostic trace.
type WhyDeniedEvaluationReport struct {
	Allowed           bool             `json:"allowed"`
	PrimaryReason     string           `json:"primary_reason"`
	DenialStage       string           `json:"denial_stage"` // NONE if allowed
	EffectiveStatus   string           `json:"effective_status"`
	EffectiveMode     string           `json:"effective_mode"`
	TargetModuleCode  string           `json:"target_module_code"`
	TargetKind        string           `json:"target_kind"`
	EvaluatedAction   string           `json:"evaluated_action"`
	EvaluationSteps   []EvaluationStep `json:"evaluation_steps"`
	RemediationAdvice string           `json:"remediation_advice,omitempty"`
}
