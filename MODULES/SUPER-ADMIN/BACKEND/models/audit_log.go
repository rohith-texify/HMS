package models

import (
	"time"

	"github.com/google/uuid"
)

// PlatformAuditLog represents an audit log record from platform.audit_logs.
type PlatformAuditLog struct {
	AuditID           uuid.UUID   `json:"audit_id" db:"audit_id"`
	CollegeID         *uuid.UUID  `json:"college_id,omitempty" db:"college_id"`
	CollegeCode       string      `json:"college_code,omitempty" db:"college_code"`
	CollegeName       string      `json:"college_name,omitempty" db:"college_name"`
	ActorUserID       *uuid.UUID  `json:"actor_user_id,omitempty" db:"actor_user_id"`
	ActorEmail        string      `json:"actor_email,omitempty" db:"actor_email"`
	ActorRole         string      `json:"actor_role" db:"actor_role"`
	Module            string      `json:"module" db:"module"`
	Action            string      `json:"action" db:"action"`
	EntityType        string      `json:"entity_type" db:"entity_type"`
	EntityID          *uuid.UUID  `json:"entity_id,omitempty" db:"entity_id"`
	OldData           JSONB       `json:"old_data,omitempty" db:"old_data"`
	NewData           JSONB       `json:"new_data,omitempty" db:"new_data"`
	Reason            *string     `json:"reason,omitempty" db:"reason"`
	IPAddress         *string     `json:"ip_address,omitempty" db:"ip_address"`
	UserAgent         *string     `json:"user_agent,omitempty" db:"user_agent"`
	CorrelationID     *uuid.UUID  `json:"correlation_id,omitempty" db:"correlation_id"`
	Severity          string      `json:"severity" db:"severity"` // DEBUG, INFO, WARNING, ERROR, CRITICAL
	ResultStatus      string      `json:"result_status" db:"result_status"` // SUCCESS, FAILURE, DENIED
	ErrorCode         *string     `json:"error_code,omitempty" db:"error_code"`
	TicketReference   *string     `json:"ticket_reference,omitempty" db:"ticket_reference"`
	ApprovalReference *string     `json:"approval_reference,omitempty" db:"approval_reference"`
	CurrentHash       *string     `json:"current_hash,omitempty" db:"current_hash"`
	PreviousHash      *string     `json:"previous_hash,omitempty" db:"previous_hash"`
	CreatedAt         time.Time   `json:"created_at" db:"created_at"`
}

// AuditLogFilterParams represents search and filter parameters for platform audit logs.
type AuditLogFilterParams struct {
	Query           string     `form:"query"`
	CollegeID       *uuid.UUID `form:"college_id"`
	ActorUserID     *uuid.UUID `form:"actor_user_id"`
	ActorRole       string     `form:"actor_role"`
	Module          string     `form:"module"`
	Action          string     `form:"action"`
	EntityType      string     `form:"entity_type"`
	Severity        string     `form:"severity"`
	ResultStatus    string     `form:"result_status"`
	TicketReference string     `form:"ticket_reference"`
	CorrelationID   *uuid.UUID `form:"correlation_id"`
	StartDate       *time.Time `form:"start_date"`
	EndDate         *time.Time `form:"end_date"`
	Limit           int        `form:"limit"`
	Offset          int        `form:"offset"`
}

// AuditExportRequest represents a request for bulk audit data export requiring approval.
type AuditExportRequest struct {
	RequestID       uuid.UUID   `json:"request_id" db:"request_id"`
	RequesterUserID uuid.UUID   `json:"requester_user_id" db:"requester_user_id"`
	RequesterEmail  string      `json:"requester_email,omitempty" db:"requester_email"`
	RequesterRole   string      `json:"requester_role" db:"requester_role"`
	Filters         JSONB       `json:"filters" db:"filters"`
	RecordCount     int         `json:"record_count" db:"record_count"`
	Status          string      `json:"status" db:"status"` // PENDING, APPROVED, REJECTED, EXPORTED
	Reason          string      `json:"reason" db:"reason"`
	ApproverUserID  *uuid.UUID  `json:"approver_user_id,omitempty" db:"approver_user_id"`
	ApproverEmail   string      `json:"approver_email,omitempty" db:"approver_email"`
	ApprovedAt      *time.Time  `json:"approved_at,omitempty" db:"approved_at"`
	ExportURL       *string     `json:"export_url,omitempty" db:"export_url"`
	CreatedAt       time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at" db:"updated_at"`
}

// CreateAuditExportRequest represents payload to request a bulk export.
type CreateAuditExportRequest struct {
	Filters JSONB  `json:"filters" binding:"required"`
	Reason  string `json:"reason" binding:"required,min=5,max=500"`
}

// ProcessAuditExportDecision represents payload to approve/reject an export request.
type ProcessAuditExportDecision struct {
	Decision string `json:"decision" binding:"required,oneof=APPROVED REJECTED"`
	Reason   string `json:"reason" binding:"required,min=3,max=500"`
}

// AuditIntegrityCheckReport provides verification status of tamper-evident hash-chaining.
type AuditIntegrityCheckReport struct {
	TotalChecked        int       `json:"total_checked"`
	TamperedRecords     int       `json:"tampered_records"`
	ChainBrokenRecords  int       `json:"chain_broken_records"`
	IsIntegrityIntact   bool      `json:"is_integrity_intact"`
	LastVerifiedAuditID uuid.UUID `json:"last_verified_audit_id"`
	CheckedAt           time.Time `json:"checked_at"`
	Details             string    `json:"details"`
}
