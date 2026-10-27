package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

type PlatformApprovalDecisionService struct {
	db   *database.Database
	repo *repository.Repository
}

func NewPlatformApprovalDecisionService(
	db *database.Database,
	repo *repository.Repository,
) *PlatformApprovalDecisionService {
	return &PlatformApprovalDecisionService{
		db:   db,
		repo: repo,
	}
}

func (s *PlatformApprovalDecisionService) Approve(
	ctx context.Context,
	requestID uuid.UUID,
	approverID uuid.UUID,
	comment string,
	reason string,
) (repository.ApprovalStep, error) {
	return s.decide(
		ctx,
		requestID,
		approverID,
		"APPROVED",
		comment,
		reason,
	)
}

func (s *PlatformApprovalDecisionService) Reject(
	ctx context.Context,
	requestID uuid.UUID,
	approverID uuid.UUID,
	comment string,
	reason string,
) (repository.ApprovalStep, error) {
	return s.decide(
		ctx,
		requestID,
		approverID,
		"REJECTED",
		comment,
		reason,
	)
}

func (s *PlatformApprovalDecisionService) decide(
	ctx context.Context,
	requestID uuid.UUID,
	approverID uuid.UUID,
	decision string,
	comment string,
	reason string,
) (repository.ApprovalStep, error) {
	// ------------------------------------------------------------
	// Basic validation
	// ------------------------------------------------------------

	if requestID == uuid.Nil {
		return repository.ApprovalStep{}, fmt.Errorf(
			"request_id is required",
		)
	}

	if approverID == uuid.Nil {
		return repository.ApprovalStep{}, fmt.Errorf(
			"approver_id is required",
		)
	}

	decision = strings.TrimSpace(decision)

	if decision != "APPROVED" && decision != "REJECTED" {
		return repository.ApprovalStep{}, fmt.Errorf(
			"invalid approval decision",
		)
	}

	comment = strings.TrimSpace(comment)
	reason = strings.TrimSpace(reason)

	var result repository.ApprovalStep

	// ------------------------------------------------------------
	// Entire decision must be atomic.
	// ------------------------------------------------------------

	err := s.db.WithPlatformTransaction(
		ctx,
		func(txCtx context.Context, _ pgx.Tx) error {

			// ----------------------------------------------------
			// 1. Load parent approval request
			// ----------------------------------------------------

			request, err := s.repo.GetApprovalRequest(
				txCtx,
				requestID,
			)
			if err != nil {
				return fmt.Errorf(
					"failed to load approval request: %w",
					err,
				)
			}

			// ----------------------------------------------------
			// 2. Parent request must still be PENDING
			// ----------------------------------------------------

			if request.Status != "PENDING" {
				return fmt.Errorf(
					"approval request is already %s",
					request.Status,
				)
			}

			// ----------------------------------------------------
			// 3. Maker-checker protection
			//
			// The requester can NEVER approve/reject their own
			// approval request.
			// ----------------------------------------------------

			if request.RequestedBy == approverID {
				return fmt.Errorf(
					"maker-checker violation: requester cannot approve their own request",
				)
			}

			// ----------------------------------------------------
			// 4. Find the pending approval step
			// ----------------------------------------------------

			currentStep, err := s.repo.GetPendingApprovalStep(
				txCtx,
				requestID,
			)
			if err != nil {
				return fmt.Errorf(
					"failed to load pending approval step: %w",
					err,
				)
			}

			// ----------------------------------------------------
			// 5. Approval step MUST have an assigned approver
			//
			// NEVER dynamically assign the caller here.
			// ----------------------------------------------------

			if currentStep.ApproverID == nil {
				return fmt.Errorf(
					"approval step has no assigned approver",
				)
			}

			// ----------------------------------------------------
			// 6. Only the assigned approver can decide
			// ----------------------------------------------------

			if *currentStep.ApproverID != approverID {
				return fmt.Errorf(
					"approval step is assigned to a different approver",
				)
			}

			// ----------------------------------------------------
			// 7. Update the approval step
			// ----------------------------------------------------

			result, err = s.repo.DecideApprovalStep(
				txCtx,
				currentStep.ApprovalStepID,
				approverID,
				decision,
				comment,
				reason,
			)
			if err != nil {
				return fmt.Errorf(
					"failed to decide approval step: %w",
					err,
				)
			}

			// ----------------------------------------------------
			// 8. Update parent request status
			// ----------------------------------------------------

			switch decision {
			case "REJECTED":
				return s.repo.UpdateApprovalRequestStatus(
					txCtx,
					requestID,
					"REJECTED",
				)

			case "APPROVED":
				return s.repo.UpdateApprovalRequestStatus(
					txCtx,
					requestID,
					"APPROVED",
				)
			}

			return nil
		},
	)

	if err != nil {
		return repository.ApprovalStep{}, fmt.Errorf(
			"failed to process approval decision: %w",
			err,
		)
	}

	return result, nil
}
