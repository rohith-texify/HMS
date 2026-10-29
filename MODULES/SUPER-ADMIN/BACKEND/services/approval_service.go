package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// ApprovalService handles business logic for approval workflows.
type ApprovalService struct {
	repo *repository.Repository
	db   *database.Database
}

// NewApprovalService creates a new approval service.
func NewApprovalService(
	db *database.Database,
	repo *repository.Repository,
) *ApprovalService {
	return &ApprovalService{
		repo: repo,
		db:   db,
	}
}

// ListApprovalRequests retrieves a list of approval requests with optional filtering and pagination.
func (s *ApprovalService) ListApprovalRequests(
	ctx context.Context,
	params models.ListApprovalRequestsParams,
	authenticatedActorID uuid.UUID,
) ([]models.ApprovalRequest, *models.PaginationMeta, error) {
	if s == nil || s.repo == nil {
		return nil, nil, apierrors.New(
			apierrors.InternalError,
			"Repository not configured",
		)
	}

	if err := validators.ValidateListApprovalRequestsParams(&params); err != nil {
		return nil, nil, err
	}

	// Set defaults for pagination
	limit := 20
	if params.Limit > 0 {
		limit = params.Limit
	}

	offset := 0
	if params.Offset > 0 {
		offset = params.Offset
	}

	// Prepare filters
	var statusFilter *string
	if params.Status != "" {
		statusFilter = &params.Status
	}

	var requestedByFilter *uuid.UUID
	var excludeRequesterFilter *uuid.UUID

	if params.RequestedBy != nil && *params.RequestedBy != uuid.Nil {
		requestedByFilter = params.RequestedBy
	}

	// If Inbox view is requested, exclude own requests so approvers only see requests made by others (Maker-Checker)
	if params.Inbox && authenticatedActorID != uuid.Nil {
		excludeRequesterFilter = &authenticatedActorID
	}

	// Call repository
	requests, total, err := s.repo.ListApprovalRequests(ctx, statusFilter, params.CollegeID, requestedByFilter, excludeRequesterFilter, limit, offset)
	if err != nil {
		return nil, nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve approval requests",
		)
	}

	meta := models.NewPaginationMeta(limit, offset, total)

	return requests, meta, nil
}

// CancelApprovalRequest allows the requester (or an authorized admin) to withdraw/cancel a pending approval request.
func (s *ApprovalService) CancelApprovalRequest(
	ctx context.Context,
	requestID uuid.UUID,
	actorUserID uuid.UUID,
	actorRole string,
	reason string,
) (*models.ApprovalRequestWithSteps, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Approval service is not configured")
	}

	if requestID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "Request ID is required")
	}

	if actorUserID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}

	trimmedReason := strings.TrimSpace(reason)
	if trimmedReason == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Cancellation reason is required")
	}

	ctx = database.WithPlatformUserID(ctx, actorUserID)
	ctx = database.WithPlatformReason(ctx, trimmedReason)

	var result *models.ApprovalRequestWithSteps

	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		request, err := s.repo.GetApprovalRequestByIDForUpdate(txCtx, requestID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apierrors.New(apierrors.NotFound, "Approval request not found")
			}
			return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to load approval request: %v", err))
		}

		if request.Status != "PENDING" {
			return apierrors.New(
				apierrors.Conflict,
				fmt.Sprintf("Cannot cancel approval request with status '%s'. Only PENDING requests can be cancelled/withdrawn.", request.Status),
			)
		}

		// Requester can always cancel/withdraw their own request. Other platform admins can cancel if authorized.
		if request.RequestedBy != actorUserID && actorRole != "SUPER_ADMIN" && actorRole != "PLATFORM_OWNER" {
			return apierrors.New(
				apierrors.Forbidden,
				"Only the original requester or a platform super administrator can withdraw this approval request",
			)
		}

		if err := s.repo.UpdateApprovalRequestStatus(txCtx, requestID, "CANCELLED"); err != nil {
			return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update request status: %v", err))
		}

		// Record audit log
		if auditErr := s.repo.RecordApprovalAudit(txCtx, models.ApprovalAuditParams{
			CollegeID:   request.CollegeID,
			ActorUserID: actorUserID,
			ActorRole:   actorRole,
			Module:      "platform_approvals",
			Action:      "APPROVAL_REQUEST_CANCELLED",
			EntityType:  "APPROVAL_REQUEST",
			EntityID:    requestID,
			OldData: models.JSONB{
				"status": request.Status,
			},
			NewData: models.JSONB{
				"status": "CANCELLED",
			},
			Reason:   &trimmedReason,
			Severity: "WARN",
		}); auditErr != nil {
			return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to record cancellation audit: %v", auditErr))
		}

		updatedReq, err := s.repo.GetApprovalRequestByID(txCtx, requestID)
		if err != nil {
			return apierrors.New(apierrors.InternalError, "Failed to load updated request")
		}

		steps, err := s.repo.GetApprovalStepsByRequestID(txCtx, requestID)
		if err != nil {
			return apierrors.New(apierrors.InternalError, "Failed to load approval steps")
		}

		result = &models.ApprovalRequestWithSteps{
			ApprovalRequest: *updatedReq,
			Steps:           steps,
		}
		return nil
	})

	if err != nil {
		var apiErr *apierrors.APIError
		if errors.As(err, &apiErr) {
			return nil, apiErr
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to cancel request: %v", err))
	}

	return result, nil
}

// GetApprovalRequest retrieves a single approval request with its steps.
func (s *ApprovalService) GetApprovalRequest(
	ctx context.Context,
	requestID uuid.UUID,
) (*models.ApprovalRequestWithSteps, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Repository not configured",
		)
	}

	if requestID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Request ID is required",
		)
	}

	request, err := s.repo.GetApprovalRequestByID(ctx, requestID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, apierrors.New(
				apierrors.NotFound,
				"Approval request not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve approval request",
		)
	}

	steps, err := s.repo.GetApprovalStepsByRequestID(ctx, requestID)
	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve approval steps",
		)
	}

	return &models.ApprovalRequestWithSteps{
		ApprovalRequest: *request,
		Steps:           steps,
	}, nil
}

// CreateApprovalRequest creates a new approval request and its steps with maker-checker protections.
func (s *ApprovalService) CreateApprovalRequest(
	ctx context.Context,
	input models.CreateApprovalRequestInput,
	requestedBy uuid.UUID,
	actorRole string,
) (*models.ApprovalRequestWithSteps, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Database or repository not configured",
		)
	}

	if requestedBy == uuid.Nil {
		return nil, apierrors.New(
			apierrors.Unauthorized,
			"Authenticated user is required",
		)
	}

	if err := validators.ValidateCreateApprovalRequest(&input); err != nil {
		return nil, err
	}

	// Maker-checker enforcement at creation:
	// The requester cannot be assigned as an approver on any step.
	if input.ApproverID != nil && *input.ApproverID == requestedBy {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"maker-checker violation: requester cannot be assigned as approver",
		)
	}
	for _, step := range input.Steps {
		if step.ApproverID != nil && *step.ApproverID == requestedBy {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"maker-checker violation: requester cannot be assigned as approver",
			)
		}
	}

	ctx = database.WithPlatformUserID(ctx, requestedBy)
	if input.Reason != nil && *input.Reason != "" {
		ctx = database.WithPlatformReason(ctx, *input.Reason)
	}

	var result *models.ApprovalRequestWithSteps

	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		reqToInsert := models.ApprovalRequest{
			OperationType: input.OperationType,
			CollegeID:     input.CollegeID,
			Payload:       input.Payload,
			RequestedBy:   requestedBy,
			Reason:        input.Reason,
			Snapshot:      input.Snapshot,
			ExpiresAt:     input.ExpiresAt,
		}

		createdReq, err := s.repo.CreateApprovalRequest(txCtx, reqToInsert)
		if err != nil {
			return apierrors.New(
				apierrors.InternalError,
				fmt.Sprintf("Failed to create approval request: %v", err),
			)
		}

		var createdSteps []models.ApprovalStep

		if len(input.Steps) > 0 {
			for _, stepIn := range input.Steps {
				step, err := s.repo.CreateApprovalStep(txCtx, createdReq.RequestID, stepIn.StepOrder, stepIn.ApproverID)
				if err != nil {
					return apierrors.New(
						apierrors.InternalError,
						fmt.Sprintf("Failed to create approval step: %v", err),
					)
				}
				createdSteps = append(createdSteps, *step)
			}
		} else {
			// Shorthand single step
			step, err := s.repo.CreateApprovalStep(txCtx, createdReq.RequestID, 1, input.ApproverID)
			if err != nil {
				return apierrors.New(
					apierrors.InternalError,
					fmt.Sprintf("Failed to create approval step: %v", err),
				)
			}
			createdSteps = append(createdSteps, *step)
		}

		// Audit record - fail-closed: must roll back if audit log write fails
		if auditErr := s.repo.RecordApprovalAudit(txCtx, models.ApprovalAuditParams{
			CollegeID:   createdReq.CollegeID,
			ActorUserID: requestedBy,
			ActorRole:   actorRole,
			Module:      "platform_approvals",
			Action:      "APPROVAL_REQUEST_CREATED",
			EntityType:  "APPROVAL_REQUEST",
			EntityID:    createdReq.RequestID,
			NewData: models.JSONB{
				"operation_type": createdReq.OperationType,
				"status":         createdReq.Status,
				"steps_count":    len(createdSteps),
			},
			Reason:   createdReq.Reason,
			Severity: "INFO",
		}); auditErr != nil {
			return apierrors.New(
				apierrors.InternalError,
				fmt.Sprintf("Failed to record creation audit: %v", auditErr),
			)
		}

		result = &models.ApprovalRequestWithSteps{
			ApprovalRequest: *createdReq,
			Steps:           createdSteps,
		}
		return nil
	})

	if err != nil {
		if apiErr, ok := err.(*apierrors.APIError); ok {
			return nil, apiErr
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to create approval request: %v", err),
		)
	}

	return result, nil
}

// ProcessApprovalDecision processes an approval or rejection decision for a step with atomic row locking.
func (s *ApprovalService) ProcessApprovalDecision(
	ctx context.Context,
	stepID uuid.UUID,
	approverID uuid.UUID,
	actorRole string,
	req models.ApprovalDecisionRequest,
) (*models.ApprovalRequestWithSteps, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Database or repository not configured",
		)
	}

	if approverID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.Unauthorized,
			"Authenticated approver ID is required",
		)
	}

	if stepID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Step ID is required",
		)
	}

	if err := validators.ValidateApprovalDecisionRequest(&req); err != nil {
		return nil, err
	}

	ctx = database.WithPlatformUserID(ctx, approverID)
	if req.Reason != nil && *req.Reason != "" {
		ctx = database.WithPlatformReason(ctx, *req.Reason)
	}

	var result *models.ApprovalRequestWithSteps

	// Process within a transaction
	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		// 1. Initial lookup to get the step and parent request ID
		stepLookup, err := s.repo.GetApprovalStepByID(txCtx, stepID)
		if err != nil {
			if err == pgx.ErrNoRows {
				return apierrors.New(
					apierrors.NotFound,
					"Approval step not found",
				)
			}
			return apierrors.New(
				apierrors.InternalError,
				"Failed to retrieve approval step",
			)
		}

		// 2. Lock the parent approval request row FIRST to serialize concurrent decisions on this workflow
		request, err := s.repo.GetApprovalRequestByIDForUpdate(txCtx, stepLookup.RequestID)
		if err != nil {
			if err == pgx.ErrNoRows {
				return apierrors.New(
					apierrors.NotFound,
					"Approval request not found",
				)
			}
			return apierrors.New(
				apierrors.InternalError,
				"Failed to retrieve approval request",
			)
		}

		// 3. Lock the approval step row NEXT
		step, err := s.repo.GetApprovalStepByIDForUpdate(txCtx, stepID)
		if err != nil {
			if err == pgx.ErrNoRows {
				return apierrors.New(
					apierrors.NotFound,
					"Approval step not found",
				)
			}
			return apierrors.New(
				apierrors.InternalError,
				"Failed to retrieve approval step",
			)
		}

		// 4. Validate that the step is still pending (Duplicate Decision Protection)
		if step.Decision != "PENDING" {
			return apierrors.New(
				apierrors.Conflict,
				fmt.Sprintf("Approval step already decided (%s)", step.Decision),
			)
		}

		// 5. Validate request status is actionable (Finalized Request Protection)
		if !isRequestActionable(request.Status) {
			return apierrors.New(
				apierrors.Conflict,
				fmt.Sprintf("Approval request has already been finalized (%s)", request.Status),
			)
		}

		// 6. Check if request has expired
		if request.ExpiresAt != nil && time.Now().After(*request.ExpiresAt) {
			if err := s.repo.UpdateApprovalRequestStatus(txCtx, request.RequestID, "EXPIRED"); err != nil {
				return apierrors.New(
					apierrors.InternalError,
					"Failed to update request status to EXPIRED",
				)
			}
			if auditErr := s.repo.RecordApprovalAudit(txCtx, models.ApprovalAuditParams{
				CollegeID:   request.CollegeID,
				ActorUserID: approverID,
				ActorRole:   actorRole,
				Module:      "platform_approvals",
				Action:      "APPROVAL_REQUEST_EXPIRED",
				EntityType:  "APPROVAL_REQUEST",
				EntityID:    request.RequestID,
				Reason:      req.Reason,
				Severity:    "WARN",
			}); auditErr != nil {
				return apierrors.New(
					apierrors.InternalError,
					fmt.Sprintf("Failed to record expiry audit: %v", auditErr),
				)
			}
			return apierrors.New(
				apierrors.Conflict,
				"Approval request has expired",
			)
		}

		// 7. Maker-checker protection: requester can NEVER decide their own request
		if request.RequestedBy == approverID {
			return apierrors.New(
				apierrors.Forbidden,
				"maker-checker violation: requester cannot approve their own request",
			)
		}

		// 8. Approver assignment rule:
		// If step has an assigned approver, only that approver can decide.
		// If unassigned (nil), any authorized administrator (excluding requester) can decide.
		if step.ApproverID != nil && *step.ApproverID != approverID {
			return apierrors.New(
				apierrors.Forbidden,
				"Approval step is assigned to a different approver",
			)
		}

		// 9. Multi-step sequential validation:
		// All preceding steps (step_order < current) must already be APPROVED or SKIPPED.
		allSteps, err := s.repo.GetApprovalStepsByRequestID(txCtx, step.RequestID)
		if err != nil {
			return apierrors.New(
				apierrors.InternalError,
				"Failed to retrieve approval steps",
			)
		}

		for _, s := range allSteps {
			if s.StepOrder < step.StepOrder && s.Decision != "APPROVED" && s.Decision != "SKIPPED" {
				return apierrors.New(
					apierrors.ValidationError,
					fmt.Sprintf("Previous step %d must be approved first", s.StepOrder),
				)
			}
		}

		// 10. Update the approval step with the decision
		updatedStep, err := s.repo.UpdateApprovalStepDecision(
			txCtx,
			stepID,
			approverID,
			req.Decision,
			req.Comment,
			req.Reason,
		)
		if err != nil {
			return apierrors.New(
				apierrors.InternalError,
				fmt.Sprintf("Failed to update approval decision: %v", err),
			)
		}

		// Record step audit - fail-closed: must roll back if audit log write fails
		if auditErr := s.repo.RecordApprovalAudit(txCtx, models.ApprovalAuditParams{
			CollegeID:   request.CollegeID,
			ActorUserID: approverID,
			ActorRole:   actorRole,
			Module:      "platform_approvals",
			Action:      "APPROVAL_STEP_DECIDED",
			EntityType:  "APPROVAL_STEP",
			EntityID:    stepID,
			NewData: models.JSONB{
				"decision":   req.Decision,
				"step_order": step.StepOrder,
			},
			Reason:   req.Reason,
			Severity: "INFO",
		}); auditErr != nil {
			return apierrors.New(
				apierrors.InternalError,
				fmt.Sprintf("Failed to record approval step audit: %v", auditErr),
			)
		}

		// 11. Determine overall request status based on decision
		var newRequestStatus string
		autoExecute := false

		if req.Decision == "REJECTED" {
			// Any rejection terminates the entire request
			newRequestStatus = "REJECTED"
		} else if req.Decision == "APPROVED" {
			// Check if all steps are now approved or skipped
			allApproved := true
			for i := range allSteps {
				if allSteps[i].ApprovalStepID == updatedStep.ApprovalStepID {
					if updatedStep.Decision != "APPROVED" {
						allApproved = false
						break
					}
				} else {
					if allSteps[i].Decision != "APPROVED" && allSteps[i].Decision != "SKIPPED" {
						allApproved = false
						break
					}
				}
			}

			if allApproved {
				newRequestStatus = "APPROVED"
				autoExecute = true
			} else {
				newRequestStatus = "PENDING" // Keep as pending until all steps are approved
			}
		}

		// Update the approval request status
		if err := s.repo.UpdateApprovalRequestStatus(txCtx, request.RequestID, newRequestStatus); err != nil {
			return apierrors.New(
				apierrors.InternalError,
				"Failed to update approval request status",
			)
		}

		// Record request status audit - fail-closed: must roll back if audit log write fails
		if newRequestStatus != "PENDING" {
			if auditErr := s.repo.RecordApprovalAudit(txCtx, models.ApprovalAuditParams{
				CollegeID:   request.CollegeID,
				ActorUserID: approverID,
				ActorRole:   actorRole,
				Module:      "platform_approvals",
				Action:      "APPROVAL_REQUEST_" + newRequestStatus,
				EntityType:  "APPROVAL_REQUEST",
				EntityID:    request.RequestID,
				OldData: models.JSONB{
					"status": request.Status,
				},
				NewData: models.JSONB{
					"status": newRequestStatus,
				},
				Reason:   req.Reason,
				Severity: "INFO",
			}); auditErr != nil {
				return apierrors.New(
					apierrors.InternalError,
					fmt.Sprintf("Failed to record approval request audit: %v", auditErr),
				)
			}
		}

		// 12. Safe Execution of Approved Operation
		if autoExecute {
			if execErr := s.repo.ExecuteOperation(txCtx, request.OperationType, request.CollegeID, request.Payload, approverID); execErr != nil {
				return apierrors.New(
					apierrors.InternalError,
					fmt.Sprintf("Failed to execute approved operation (%s): %v", request.OperationType, execErr),
				)
			}

			if markErr := s.repo.MarkApprovalRequestAsExecuted(txCtx, request.RequestID); markErr != nil {
				return apierrors.New(
					apierrors.InternalError,
					fmt.Sprintf("Failed to mark request as executed: %v", markErr),
				)
			}

			if auditErr := s.repo.RecordApprovalAudit(txCtx, models.ApprovalAuditParams{
				CollegeID:   request.CollegeID,
				ActorUserID: approverID,
				ActorRole:   actorRole,
				Module:      "platform_approvals",
				Action:      "APPROVAL_REQUEST_EXECUTED",
				EntityType:  "APPROVAL_REQUEST",
				EntityID:    request.RequestID,
				NewData: models.JSONB{
					"operation_type": request.OperationType,
					"status":         "EXECUTED",
				},
				Reason:   req.Reason,
				Severity: "INFO",
			}); auditErr != nil {
				return apierrors.New(
					apierrors.InternalError,
					fmt.Sprintf("Failed to record execution audit: %v", auditErr),
				)
			}
		}

		// Retrieve the updated request with all steps
		updatedRequest, err := s.repo.GetApprovalRequestByID(txCtx, request.RequestID)
		if err != nil {
			return apierrors.New(
				apierrors.InternalError,
				"Failed to retrieve updated request",
			)
		}

		updatedSteps, err := s.repo.GetApprovalStepsByRequestID(txCtx, request.RequestID)
		if err != nil {
			return apierrors.New(
				apierrors.InternalError,
				"Failed to retrieve updated steps",
			)
		}

		result = &models.ApprovalRequestWithSteps{
			ApprovalRequest: *updatedRequest,
			Steps:           updatedSteps,
		}

		return nil
	})

	if err != nil {
		if apiErr, ok := err.(*apierrors.APIError); ok {
			return nil, apiErr
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to process approval decision: %v", err),
		)
	}

	return result, nil
}

// ExecuteApprovalRequest explicitly executes an already APPROVED approval request.
func (s *ApprovalService) ExecuteApprovalRequest(
	ctx context.Context,
	requestID uuid.UUID,
	executorID uuid.UUID,
	actorRole string,
) (*models.ApprovalRequestWithSteps, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Database or repository not configured",
		)
	}

	if executorID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.Unauthorized,
			"Authenticated executor ID is required",
		)
	}

	if requestID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Request ID is required",
		)
	}

	ctx = database.WithPlatformUserID(ctx, executorID)

	var result *models.ApprovalRequestWithSteps

	err := s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		request, err := s.repo.GetApprovalRequestByIDForUpdate(txCtx, requestID)
		if err != nil {
			if err == pgx.ErrNoRows {
				return apierrors.New(apierrors.NotFound, "Approval request not found")
			}
			return apierrors.New(apierrors.InternalError, "Failed to load approval request")
		}

		if request.Status == "EXECUTED" {
			return apierrors.New(
				apierrors.Conflict,
				"Approval request has already been executed",
			)
		}

		if request.Status != "APPROVED" {
			return apierrors.New(
				apierrors.ValidationError,
				fmt.Sprintf("Cannot execute request in status %s (must be APPROVED)", request.Status),
			)
		}

		if err := s.repo.ExecuteOperation(txCtx, request.OperationType, request.CollegeID, request.Payload, executorID); err != nil {
			return apierrors.New(
				apierrors.InternalError,
				fmt.Sprintf("Failed to execute approved operation: %v", err),
			)
		}

		if err := s.repo.MarkApprovalRequestAsExecuted(txCtx, requestID); err != nil {
			return apierrors.New(apierrors.InternalError, "Failed to mark request as executed")
		}

		if auditErr := s.repo.RecordApprovalAudit(txCtx, models.ApprovalAuditParams{
			CollegeID:   request.CollegeID,
			ActorUserID: executorID,
			ActorRole:   actorRole,
			Module:      "platform_approvals",
			Action:      "APPROVAL_REQUEST_EXECUTED",
			EntityType:  "APPROVAL_REQUEST",
			EntityID:    requestID,
			NewData: models.JSONB{
				"operation_type": request.OperationType,
				"status":         "EXECUTED",
			},
			Severity: "INFO",
		}); auditErr != nil {
			return apierrors.New(
				apierrors.InternalError,
				fmt.Sprintf("Failed to record execution audit: %v", auditErr),
			)
		}

		updatedRequest, err := s.repo.GetApprovalRequestByID(txCtx, requestID)
		if err != nil {
			return apierrors.New(apierrors.InternalError, "Failed to retrieve updated request")
		}

		steps, err := s.repo.GetApprovalStepsByRequestID(txCtx, requestID)
		if err != nil {
			return apierrors.New(apierrors.InternalError, "Failed to retrieve steps")
		}

		result = &models.ApprovalRequestWithSteps{
			ApprovalRequest: *updatedRequest,
			Steps:           steps,
		}
		return nil
	})

	if err != nil {
		if apiErr, ok := err.(*apierrors.APIError); ok {
			return nil, apiErr
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to execute request: %v", err))
	}

	return result, nil
}

// isRequestActionable checks if an approval request can be acted upon.
func isRequestActionable(status string) bool {
	actionableStatuses := map[string]bool{
		"PENDING": true,
	}
	return actionableStatuses[status]
}
