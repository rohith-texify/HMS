package models

import (
	"time"

	"github.com/google/uuid"
)

// ChangeSetCategory represents the domain of configuration or entitlement being altered.
type ChangeSetCategory string

const (
	ChangeCategoryCollegeSetting ChangeSetCategory = "COLLEGE_SETTING"
	ChangeCategoryCollegeModule  ChangeSetCategory = "COLLEGE_MODULE"
	ChangeCategorySystemSetting  ChangeSetCategory = "SYSTEM_SETTING"
	ChangeCategoryCollegeStatus   ChangeSetCategory = "COLLEGE_STATUS"
)

// ChangeSetStatus represents the lifecycle state of a configuration proposal.
type ChangeSetStatus string

const (
	ChangeSetStatusDraft     ChangeSetStatus = "DRAFT"
	ChangeSetStatusPending   ChangeSetStatus = "PENDING"
	ChangeSetStatusApproved  ChangeSetStatus = "APPROVED"
	ChangeSetStatusApplied   ChangeSetStatus = "APPLIED"
	ChangeSetStatusRejected  ChangeSetStatus = "REJECTED"
	ChangeSetStatusCancelled ChangeSetStatus = "CANCELLED"
	ChangeSetStatusRolledBack ChangeSetStatus = "ROLLED_BACK"
	ChangeSetStatusFailed    ChangeSetStatus = "FAILED"
)

// ConfigurationChangeSet represents an auditable, version-controlled configuration proposal.
// It maps the operation, target, before/after snapshots, preconditions, and approval reference.
type ConfigurationChangeSet struct {
	ChangeSetID       uuid.UUID         `json:"change_set_id"`
	Category          ChangeSetCategory `json:"category"`
	OperationType     string            `json:"operation_type"`
	CollegeID         *uuid.UUID        `json:"college_id,omitempty"`
	CollegeName       string            `json:"college_name,omitempty"`
	TargetEntity      string            `json:"target_entity"`
	TargetKey         string            `json:"target_key"`
	RequestedBy       uuid.UUID         `json:"requested_by"`
	RequestedByName   string            `json:"requested_by_name,omitempty"`
	Reason            string            `json:"reason"`
	Status            ChangeSetStatus   `json:"status"`
	BeforeSnapshot    JSONB             `json:"before_snapshot"`
	ProposedSnapshot  JSONB             `json:"proposed_snapshot"`
	ApprovalRequestID *uuid.UUID        `json:"approval_request_id,omitempty"`
	Precondition      JSONB             `json:"precondition,omitempty"`
	RollbackSourceID  *uuid.UUID        `json:"rollback_source_id,omitempty"`
	ExecutedAt        *time.Time        `json:"executed_at,omitempty"`
	ExecutedBy        *uuid.UUID        `json:"executed_by,omitempty"`
	ExecutionResult   string            `json:"execution_result,omitempty"`
	CreatedAt         time.Time         `json:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at"`
}

// CreateChangeSetProposalRequest represents input for creating a configuration change proposal.
type CreateChangeSetProposalRequest struct {
	Category      ChangeSetCategory `json:"category" binding:"required"`
	OperationType string            `json:"operation_type" binding:"required"`
	CollegeID     *uuid.UUID        `json:"college_id,omitempty"`
	TargetKey     string            `json:"target_key" binding:"required"`
	ProposedValue JSONB             `json:"proposed_value" binding:"required"`
	Reason        string            `json:"reason" binding:"required,max=500"`
	RequireApproval bool            `json:"require_approval"`
}

// RollbackChangeProposalRequest represents input to propose or execute a rollback from a previous snapshot.
type RollbackChangeProposalRequest struct {
	AuditID uuid.UUID `json:"audit_id" binding:"required"`
	Reason  string    `json:"reason" binding:"required,max=500"`
}

// ChangeSetFilterParams represents query parameters for filtering change sets.
type ChangeSetFilterParams struct {
	Status    string     `form:"status"`
	Category  string     `form:"category"`
	CollegeID *uuid.UUID `form:"college_id"`
	Limit     int        `form:"limit" binding:"omitempty,min=1,max=100"`
	Offset    int        `form:"offset" binding:"omitempty,min=0"`
}

// SnapshotDiffItem represents a granular comparison between original and proposed values.
type SnapshotDiffItem struct {
	Key           string      `json:"key"`
	OriginalValue interface{} `json:"original_value"`
	ProposedValue interface{} `json:"proposed_value"`
	ChangeType    string      `json:"change_type"` // MODIFIED, ADDED, REMOVED, UNCHANGED
	IsSensitive   bool        `json:"is_sensitive"`
}
