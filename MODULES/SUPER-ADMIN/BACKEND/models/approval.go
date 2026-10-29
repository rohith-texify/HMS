package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// JSONB is a custom type for PostgreSQL JSONB columns.
type JSONB map[string]interface{}

// Value implements the driver.Valuer interface.
func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface.
func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, j)
}

// ApprovalRequest represents a maker-checker approval request.
type ApprovalRequest struct {
	RequestID     uuid.UUID  `json:"request_id" db:"request_id"`
	OperationType string     `json:"operation_type" db:"operation_type"`
	CollegeID     *uuid.UUID `json:"college_id,omitempty" db:"college_id"`
	Payload       JSONB      `json:"payload" db:"payload"`
	RequestedBy   uuid.UUID  `json:"requested_by" db:"requested_by"`
	Status        string     `json:"status" db:"status"`
	Reason        *string    `json:"reason,omitempty" db:"reason"`
	Snapshot      JSONB      `json:"snapshot,omitempty" db:"snapshot"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty" db:"expires_at"`
	ExecutedAt    *time.Time `json:"executed_at,omitempty" db:"executed_at"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

// ApprovalStep represents an individual approval decision within a request.
type ApprovalStep struct {
	ApprovalStepID uuid.UUID  `json:"approval_step_id" db:"approval_step_id"`
	RequestID      uuid.UUID  `json:"request_id" db:"request_id"`
	StepOrder      int        `json:"step_order" db:"step_order"`
	ApproverID     *uuid.UUID `json:"approver_id,omitempty" db:"approver_id"`
	Decision       string     `json:"decision" db:"decision"`
	Comment        *string    `json:"comment,omitempty" db:"comment"`
	DecisionReason *string    `json:"decision_reason,omitempty" db:"decision_reason"`
	DecidedAt      *time.Time `json:"decided_at,omitempty" db:"decided_at"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
}

// ApprovalRequestWithSteps combines ApprovalRequest with its approval steps.
type ApprovalRequestWithSteps struct {
	ApprovalRequest
	Steps []ApprovalStep `json:"steps"`
}

// ApprovalDecisionRequest represents the payload for approving or rejecting a step.
type ApprovalDecisionRequest struct {
	Decision string  `json:"decision" binding:"required,oneof=APPROVED REJECTED APPROVE REJECT"`
	Comment  *string `json:"comment,omitempty" binding:"omitempty,max=1000"`
	Reason   *string `json:"reason,omitempty" binding:"omitempty,max=500"`
}

// ListApprovalRequestsParams represents query parameters for listing approval requests.
type ListApprovalRequestsParams struct {
	Status      string     `form:"status" binding:"omitempty,oneof=PENDING APPROVED REJECTED CANCELLED EXPIRED EXECUTED"`
	CollegeID   *uuid.UUID `form:"college_id"`
	RequestedBy *uuid.UUID `form:"requested_by"`
	Inbox       bool       `form:"inbox"`
	Limit       int        `form:"limit" binding:"omitempty,min=1,max=100"`
	Offset      int        `form:"offset" binding:"omitempty,min=0"`
}

// CancelApprovalRequestInput represents the payload for cancelling/withdrawing an approval request.
type CancelApprovalRequestInput struct {
	Reason string `json:"reason" binding:"required,max=500"`
}

// CreateApprovalStepInput represents an individual step definition when creating an approval request.
type CreateApprovalStepInput struct {
	StepOrder  int        `json:"step_order" binding:"required,min=1"`
	ApproverID *uuid.UUID `json:"approver_id,omitempty"`
}

// CreateApprovalRequestInput represents the payload for creating a new approval request.
type CreateApprovalRequestInput struct {
	OperationType string                    `json:"operation_type" binding:"required"`
	CollegeID     *uuid.UUID                `json:"college_id,omitempty"`
	Payload       JSONB                     `json:"payload" binding:"required"`
	Reason        *string                   `json:"reason,omitempty" binding:"omitempty,max=500"`
	Snapshot      JSONB                     `json:"snapshot,omitempty"`
	ExpiresAt     *time.Time                `json:"expires_at,omitempty"`
	ApproverID    *uuid.UUID                `json:"approver_id,omitempty"`
	Steps         []CreateApprovalStepInput `json:"steps,omitempty"`
}

// ApprovalAuditParams defines attributes for writing an immutable record to platform.audit_logs.
type ApprovalAuditParams struct {
	CollegeID   *uuid.UUID
	ActorUserID uuid.UUID
	ActorRole   string
	Module      string
	Action      string
	EntityType  string
	EntityID    uuid.UUID
	OldData     JSONB
	NewData     JSONB
	Reason      *string
	Severity    string
}
