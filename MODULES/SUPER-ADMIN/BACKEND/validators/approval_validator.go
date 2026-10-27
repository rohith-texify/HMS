package validators

import (
	"strings"
	"time"

	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// ValidateRequestID validates that a request ID is a valid UUID.
func ValidateRequestID(requestIDStr string) (uuid.UUID, error) {
	if requestIDStr == "" {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"Request ID is required",
		)
	}

	requestID, err := uuid.Parse(requestIDStr)
	if err != nil {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"Invalid request ID format",
		)
	}

	return requestID, nil
}

// ValidateStepID validates that a step ID is a valid UUID.
func ValidateStepID(stepIDStr string) (uuid.UUID, error) {
	if stepIDStr == "" {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"Step ID is required",
		)
	}

	stepID, err := uuid.Parse(stepIDStr)
	if err != nil {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"Invalid step ID format",
		)
	}

	return stepID, nil
}

// ValidateListApprovalRequestsParams validates query parameters for listing approval requests.
func ValidateListApprovalRequestsParams(params *models.ListApprovalRequestsParams) error {
	// Validate status if provided
	if params.Status != "" {
		validStatuses := map[string]bool{
			"PENDING":   true,
			"APPROVED":  true,
			"REJECTED":  true,
			"CANCELLED": true,
			"EXPIRED":   true,
			"EXECUTED":  true,
		}
		if !validStatuses[params.Status] {
			return apierrors.New(
				apierrors.ValidationError,
				"Invalid status. Must be one of: PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED, EXECUTED",
			)
		}
	}

	// Validate pagination limits
	if params.Limit < 0 {
		return apierrors.New(
			apierrors.ValidationError,
			"Limit must be greater than or equal to 0",
		)
	}

	if params.Limit > 100 {
		return apierrors.New(
			apierrors.ValidationError,
			"Limit cannot exceed 100",
		)
	}

	if params.Offset < 0 {
		return apierrors.New(
			apierrors.ValidationError,
			"Offset must be greater than or equal to 0",
		)
	}

	return nil
}

// ValidateApprovalDecisionRequest validates the approval decision request payload.
func ValidateApprovalDecisionRequest(req *models.ApprovalDecisionRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	// Validate decision
	validDecisions := map[string]bool{
		"APPROVED": true,
		"REJECTED": true,
	}

	decision := strings.ToUpper(strings.TrimSpace(req.Decision))
	if decision == "APPROVE" {
		decision = "APPROVED"
	} else if decision == "REJECT" {
		decision = "REJECTED"
	}
	req.Decision = decision

	if req.Decision == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"Decision is required",
		)
	}

	if !validDecisions[req.Decision] {
		return apierrors.New(
			apierrors.ValidationError,
			"Invalid decision. Must be either APPROVED or REJECTED",
		)
	}

	// If decision is REJECTED, reason or comment is required
	if req.Decision == "REJECTED" {
		hasReason := req.Reason != nil && strings.TrimSpace(*req.Reason) != ""
		hasComment := req.Comment != nil && strings.TrimSpace(*req.Comment) != ""
		if !hasReason && !hasComment {
			return apierrors.New(
				apierrors.ValidationError,
				"Rejection requires a non-empty reason or comment",
			)
		}
	}

	// Validate comment length if provided
	if req.Comment != nil {
		trimmedComment := strings.TrimSpace(*req.Comment)
		if len(trimmedComment) > 1000 {
			return apierrors.New(
				apierrors.ValidationError,
				"Comment cannot exceed 1000 characters",
			)
		}
		if trimmedComment == "" {
			req.Comment = nil
		} else {
			req.Comment = &trimmedComment
		}
	}

	// Validate reason length if provided
	if req.Reason != nil {
		trimmedReason := strings.TrimSpace(*req.Reason)
		if len(trimmedReason) > 500 {
			return apierrors.New(
				apierrors.ValidationError,
				"Reason cannot exceed 500 characters",
			)
		}
		if trimmedReason == "" {
			req.Reason = nil
		} else {
			req.Reason = &trimmedReason
		}
	}

	return nil
}

// SupportedOperationTypes lists all valid platform approval operation types.
var SupportedOperationTypes = map[string]bool{
	"COLLEGE_STATUS_UPDATE":   true,
	"COLLEGE_MODULE_UPDATE":   true,
	"COLLEGE_SETTING_UPDATE":  true,
	"MODULE_CATALOGUE_UPDATE": true,
	"COLLEGE_CREATE":          true,
}

// ValidateCreateApprovalRequest validates input payload for creating an approval request.
func ValidateCreateApprovalRequest(req *models.CreateApprovalRequestInput) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	req.OperationType = strings.ToUpper(strings.TrimSpace(req.OperationType))
	if req.OperationType == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"operation_type is required",
		)
	}

	if !SupportedOperationTypes[req.OperationType] {
		return apierrors.New(
			apierrors.ValidationError,
			"Unsupported operation type: "+req.OperationType,
		)
	}

	if req.Payload == nil || len(req.Payload) == 0 {
		return apierrors.New(
			apierrors.ValidationError,
			"Payload cannot be empty",
		)
	}

	if req.ExpiresAt != nil && req.ExpiresAt.Before(time.Now()) {
		return apierrors.New(
			apierrors.ValidationError,
			"Expiry time must be in the future",
		)
	}

	if req.Reason != nil {
		trimmed := strings.TrimSpace(*req.Reason)
		if len(trimmed) > 500 {
			return apierrors.New(
				apierrors.ValidationError,
				"Reason cannot exceed 500 characters",
			)
		}
		if trimmed == "" {
			req.Reason = nil
		} else {
			req.Reason = &trimmed
		}
	}

	if len(req.Steps) == 0 {
		return apierrors.New(
			apierrors.ValidationError,
			"At least one approval step is required",
		)
	}

	if req.CollegeID != nil && *req.CollegeID == uuid.Nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Invalid college_id: cannot be nil UUID",
		)
	}

	if req.ApproverID != nil && *req.ApproverID == uuid.Nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Invalid approver_id: cannot be nil UUID",
		)
	}

	orderMap := make(map[int]bool)
	for _, step := range req.Steps {
		if step.StepOrder < 1 {
			return apierrors.New(
				apierrors.ValidationError,
				"Step order must be greater than 0",
			)
		}
		if orderMap[step.StepOrder] {
			return apierrors.New(
				apierrors.ValidationError,
				"Duplicate step_order found in approval steps",
			)
		}
		if step.ApproverID != nil && *step.ApproverID == uuid.Nil {
			return apierrors.New(
				apierrors.ValidationError,
				"Invalid step approver_id: cannot be nil UUID",
			)
		}
		orderMap[step.StepOrder] = true
	}

	return nil
}
