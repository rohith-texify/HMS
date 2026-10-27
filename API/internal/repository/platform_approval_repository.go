package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type ApprovalRequest struct {
	RequestID     uuid.UUID       `json:"request_id"`
	OperationType string          `json:"operation_type"`
	CollegeID     *uuid.UUID      `json:"college_id,omitempty"`
	Payload       json.RawMessage `json:"payload"`
	RequestedBy   uuid.UUID       `json:"requested_by"`
	Status        string          `json:"status"`
	ExpiresAt     *time.Time      `json:"expires_at,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
	Reason        *string         `json:"reason,omitempty"`
	Snapshot      json.RawMessage `json:"snapshot,omitempty"`
	ExecutedAt    *time.Time      `json:"executed_at,omitempty"`
}

type ApprovalStep struct {
	ApprovalStepID uuid.UUID  `json:"approval_step_id"`
	RequestID      uuid.UUID  `json:"request_id"`
	StepOrder      int        `json:"step_order"`
	ApproverID     *uuid.UUID `json:"approver_id,omitempty"`
	Decision       string     `json:"decision"`
	Comment        *string    `json:"comment,omitempty"`
	DecidedAt      *time.Time `json:"decided_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DecisionReason *string    `json:"decision_reason,omitempty"`
}

type CreateApprovalRequestParams struct {
	OperationType string
	CollegeID     *uuid.UUID
	Payload       json.RawMessage
	RequestedBy   uuid.UUID
	ExpiresAt     *time.Time
	Reason        *string
	Snapshot      json.RawMessage
}

func (r *Repository) CreateApprovalRequest(
	ctx context.Context,
	params CreateApprovalRequestParams,
) (ApprovalRequest, error) {
	var request ApprovalRequest

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		INSERT INTO platform.approval_requests (
			request_id,
			operation_type,
			college_id,
			payload,
			requested_by,
			status,
			expires_at,
			reason,
			snapshot
		)
		VALUES (
			gen_random_uuid(),
			$1,
			$2,
			$3,
			$4,
			'PENDING',
			$5,
			$6,
			$7
		)
		RETURNING
			request_id,
			operation_type,
			college_id,
			payload,
			requested_by,
			status,
			expires_at,
			created_at,
			updated_at,
			reason,
			snapshot,
			executed_at
		`,
		params.OperationType,
		params.CollegeID,
		params.Payload,
		params.RequestedBy,
		params.ExpiresAt,
		params.Reason,
		params.Snapshot,
	).Scan(
		&request.RequestID,
		&request.OperationType,
		&request.CollegeID,
		&request.Payload,
		&request.RequestedBy,
		&request.Status,
		&request.ExpiresAt,
		&request.CreatedAt,
		&request.UpdatedAt,
		&request.Reason,
		&request.Snapshot,
		&request.ExecutedAt,
	)
	if err != nil {
		return ApprovalRequest{}, fmt.Errorf(
			"failed to create approval request: %w",
			err,
		)
	}

	return request, nil
}

func (r *Repository) CreateApprovalStep(
	ctx context.Context,
	requestID uuid.UUID,
	stepOrder int,
	approverID *uuid.UUID,
) (ApprovalStep, error) {
	var step ApprovalStep

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		INSERT INTO platform.approval_steps (
			approval_step_id,
			request_id,
			step_order,
			approver_id,
			decision
		)
		VALUES (
			gen_random_uuid(),
			$1,
			$2,
			$3,
			'PENDING'
		)
		RETURNING
			approval_step_id,
			request_id,
			step_order,
			approver_id,
			decision,
			comment,
			decided_at,
			created_at,
			updated_at,
			decision_reason
		`,
		requestID,
		stepOrder,
		approverID,
	).Scan(
		&step.ApprovalStepID,
		&step.RequestID,
		&step.StepOrder,
		&step.ApproverID,
		&step.Decision,
		&step.Comment,
		&step.DecidedAt,
		&step.CreatedAt,
		&step.UpdatedAt,
		&step.DecisionReason,
	)
	if err != nil {
		return ApprovalStep{}, fmt.Errorf(
			"failed to create approval step: %w",
			err,
		)
	}

	return step, nil
}

func (r *Repository) GetApprovalRequest(
	ctx context.Context,
	requestID uuid.UUID,
) (ApprovalRequest, error) {
	var request ApprovalRequest

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		SELECT
			request_id,
			operation_type,
			college_id,
			payload,
			requested_by,
			status,
			expires_at,
			created_at,
			updated_at,
			reason,
			snapshot,
			executed_at
		FROM platform.approval_requests
		WHERE request_id = $1
		`,
		requestID,
	).Scan(
		&request.RequestID,
		&request.OperationType,
		&request.CollegeID,
		&request.Payload,
		&request.RequestedBy,
		&request.Status,
		&request.ExpiresAt,
		&request.CreatedAt,
		&request.UpdatedAt,
		&request.Reason,
		&request.Snapshot,
		&request.ExecutedAt,
	)
	if err != nil {
		return ApprovalRequest{}, fmt.Errorf(
			"failed to get approval request: %w",
			err,
		)
	}

	return request, nil
}

func (r *Repository) GetPendingApprovalStep(
	ctx context.Context,
	requestID uuid.UUID,
) (ApprovalStep, error) {
	var step ApprovalStep

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		SELECT
			approval_step_id,
			request_id,
			step_order,
			approver_id,
			decision,
			comment,
			decided_at,
			created_at,
			updated_at,
			decision_reason
		FROM platform.approval_steps
		WHERE request_id = $1 AND decision = 'PENDING'
		ORDER BY step_order ASC
		LIMIT 1
		`,
		requestID,
	).Scan(
		&step.ApprovalStepID,
		&step.RequestID,
		&step.StepOrder,
		&step.ApproverID,
		&step.Decision,
		&step.Comment,
		&step.DecidedAt,
		&step.CreatedAt,
		&step.UpdatedAt,
		&step.DecisionReason,
	)
	if err != nil {
		return ApprovalStep{}, fmt.Errorf(
			"failed to get pending approval step: %w",
			err,
		)
	}

	return step, nil
}

func (r *Repository) AssignApprovalStepApprover(
	ctx context.Context,
	approvalStepID uuid.UUID,
	approverID uuid.UUID,
) (ApprovalStep, error) {
	var step ApprovalStep

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		UPDATE platform.approval_steps
		SET
			approver_id = $1,
			updated_at = NOW()
		WHERE approval_step_id = $2
		RETURNING
			approval_step_id,
			request_id,
			step_order,
			approver_id,
			decision,
			comment,
			decided_at,
			created_at,
			updated_at,
			decision_reason
		`,
		approverID,
		approvalStepID,
	).Scan(
		&step.ApprovalStepID,
		&step.RequestID,
		&step.StepOrder,
		&step.ApproverID,
		&step.Decision,
		&step.Comment,
		&step.DecidedAt,
		&step.CreatedAt,
		&step.UpdatedAt,
		&step.DecisionReason,
	)
	if err != nil {
		return ApprovalStep{}, fmt.Errorf(
			"failed to assign approval step approver: %w",
			err,
		)
	}

	return step, nil
}

func (r *Repository) DecideApprovalStep(
	ctx context.Context,
	approvalStepID uuid.UUID,
	approverID uuid.UUID,
	decision string,
	comment string,
	reason string,
) (ApprovalStep, error) {
	var step ApprovalStep

	var commentPtr *string
	if comment != "" {
		commentPtr = &comment
	}

	var reasonPtr *string
	if reason != "" {
		reasonPtr = &reason
	}

	err := r.Executor(ctx).QueryRow(
		ctx,
		`
		UPDATE platform.approval_steps
		SET
			decision = $1,
			comment = $2,
			decision_reason = $3,
			approver_id = $4,
			decided_at = NOW(),
			updated_at = NOW()
		WHERE approval_step_id = $5
		RETURNING
			approval_step_id,
			request_id,
			step_order,
			approver_id,
			decision,
			comment,
			decided_at,
			created_at,
			updated_at,
			decision_reason
		`,
		decision,
		commentPtr,
		reasonPtr,
		approverID,
		approvalStepID,
	).Scan(
		&step.ApprovalStepID,
		&step.RequestID,
		&step.StepOrder,
		&step.ApproverID,
		&step.Decision,
		&step.Comment,
		&step.DecidedAt,
		&step.CreatedAt,
		&step.UpdatedAt,
		&step.DecisionReason,
	)
	if err != nil {
		return ApprovalStep{}, fmt.Errorf(
			"failed to decide approval step: %w",
			err,
		)
	}

	return step, nil
}

func (r *Repository) UpdateApprovalRequestStatus(
	ctx context.Context,
	requestID uuid.UUID,
	status string,
) error {
	_, err := r.Executor(ctx).Exec(
		ctx,
		`
		UPDATE platform.approval_requests
		SET
			status = $1,
			updated_at = NOW()
		WHERE request_id = $2
		`,
		status,
		requestID,
	)
	if err != nil {
		return fmt.Errorf(
			"failed to update approval request status: %w",
			err,
		)
	}

	return nil
}
