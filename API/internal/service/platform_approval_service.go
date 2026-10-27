package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type PlatformApprovalService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewPlatformApprovalService(
	db *database.Database,
	repo *repository.Repository,
) *PlatformApprovalService {
	return &PlatformApprovalService{
		db:   db,
		repo: repo,
	}
}

type CreateApprovalRequestInput struct {
	OperationType string
	CollegeID     *uuid.UUID
	Payload       json.RawMessage
	RequestedBy   uuid.UUID
	ExpiresAt     *time.Time
	Reason        *string
	Snapshot      json.RawMessage
	ApproverID    *uuid.UUID
}

type ApprovalRequestResult struct {
	Request repository.ApprovalRequest `json:"request"`
	Step    repository.ApprovalStep    `json:"step"`
}

func (s *PlatformApprovalService) CreateApprovalRequest(
	ctx context.Context,
	input CreateApprovalRequestInput,
) (ApprovalRequestResult, error) {
	input.OperationType = strings.TrimSpace(input.OperationType)

	if input.OperationType == "" {
		return ApprovalRequestResult{}, fmt.Errorf(
			"operation_type is required",
		)
	}

	if input.RequestedBy == uuid.Nil {
		return ApprovalRequestResult{}, fmt.Errorf(
			"requested_by is required",
		)
	}

	if input.ApproverID == nil || *input.ApproverID == uuid.Nil {
		return ApprovalRequestResult{}, fmt.Errorf(
			"approver_id is required",
		)
	}

	if *input.ApproverID == input.RequestedBy {
		return ApprovalRequestResult{}, fmt.Errorf(
			"maker-checker violation: requester cannot be assigned as approver",
		)
	}

	if len(input.Payload) == 0 ||
		!json.Valid(input.Payload) {
		return ApprovalRequestResult{}, fmt.Errorf(
			"payload must be valid JSON",
		)
	}

	if input.ExpiresAt != nil {
		if input.ExpiresAt.Before(time.Now()) {
			return ApprovalRequestResult{}, fmt.Errorf(
				"expires_at must be in the future",
			)
		}
	}

	if input.Reason != nil {
		reason := strings.TrimSpace(*input.Reason)

		if reason == "" {
			input.Reason = nil
		} else {
			input.Reason = &reason
		}
	}

	if len(input.Snapshot) > 0 &&
		!json.Valid(input.Snapshot) {
		return ApprovalRequestResult{}, fmt.Errorf(
			"snapshot must be valid JSON",
		)
	}

	var result ApprovalRequestResult

	err := s.db.WithPlatformTransaction(
		ctx,
		func(txCtx context.Context, _ pgx.Tx) error {
			request, err := s.repo.CreateApprovalRequest(
				txCtx,
				repository.CreateApprovalRequestParams{
					OperationType: input.OperationType,
					CollegeID:     input.CollegeID,
					Payload:       input.Payload,
					RequestedBy:   input.RequestedBy,
					ExpiresAt:     input.ExpiresAt,
					Reason:        input.Reason,
					Snapshot:      input.Snapshot,
				},
			)
			if err != nil {
				return err
			}

			step, err := s.repo.CreateApprovalStep(
				txCtx,
				request.RequestID,
				1,
				input.ApproverID,
			)
			if err != nil {
				return err
			}

			result = ApprovalRequestResult{
				Request: request,
				Step:    step,
			}

			return nil
		},
	)

	if err != nil {
		return ApprovalRequestResult{}, fmt.Errorf(
			"failed to create approval request: %w",
			err,
		)
	}

	return result, nil
}

func (s *PlatformApprovalService) GetApprovalRequest(
	ctx context.Context,
	requestID uuid.UUID,
) (repository.ApprovalRequest, error) {
	if requestID == uuid.Nil {
		return repository.ApprovalRequest{}, fmt.Errorf(
			"request_id is required",
		)
	}

	return s.repo.GetApprovalRequest(ctx, requestID)
}
