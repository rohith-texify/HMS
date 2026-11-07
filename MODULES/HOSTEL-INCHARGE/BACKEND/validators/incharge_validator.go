package validators

import (
	"strings"
	"time"

	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/models"
)

// NewValidationError creates a new validation error.
func NewValidationError(message string) *apierrors.APIError {
	return apierrors.New(apierrors.ValidationError, message)
}

// ValidateHostelID validates that a hostel ID string is a valid UUID.
func ValidateHostelID(idStr string) (uuid.UUID, error) {
	trimmed := strings.TrimSpace(idStr)
	if trimmed == "" {
		return uuid.Nil, NewValidationError("Hostel ID is required")
	}
	id, err := uuid.Parse(trimmed)
	if err != nil || id == uuid.Nil {
		return uuid.Nil, NewValidationError("Invalid hostel ID format")
	}
	return id, nil
}

// ValidateStaffID validates that a staff ID string is a valid UUID.
func ValidateStaffID(idStr string) (uuid.UUID, error) {
	trimmed := strings.TrimSpace(idStr)
	if trimmed == "" {
		return uuid.Nil, NewValidationError("Staff ID is required")
	}
	id, err := uuid.Parse(trimmed)
	if err != nil || id == uuid.Nil {
		return uuid.Nil, NewValidationError("Invalid staff ID format")
	}
	return id, nil
}

// ValidateAssignmentID validates that an assignment ID string is a valid UUID.
func ValidateAssignmentID(idStr string) (uuid.UUID, error) {
	trimmed := strings.TrimSpace(idStr)
	if trimmed == "" {
		return uuid.Nil, NewValidationError("Assignment ID is required")
	}
	id, err := uuid.Parse(trimmed)
	if err != nil || id == uuid.Nil {
		return uuid.Nil, NewValidationError("Invalid assignment ID format")
	}
	return id, nil
}

// ValidateCreateInchargeAccountInput validates input for provisioning an in-charge account.
func ValidateCreateInchargeAccountInput(input *models.CreateInchargeAccountInput) error {
	if strings.TrimSpace(input.Name) == "" {
		return NewValidationError("In-charge name is required")
	}
	if input.HostelID == uuid.Nil {
		return NewValidationError("Target hostel ID is required")
	}
	email := strings.TrimSpace(input.Email)
	if email == "" {
		return NewValidationError("Email is required")
	}
	if !strings.Contains(email, "@") || !strings.Contains(email, ".") {
		return NewValidationError("Invalid email address format")
	}
	if len(input.Password) < 8 {
		return NewValidationError("Password must be at least 8 characters")
	}
	if input.Password != input.ConfirmPassword {
		return NewValidationError("Passwords do not match")
	}
	return nil
}

// ValidateInchargeDates checks that assigned_from precedes assigned_until if specified.
func ValidateInchargeDates(assignedFrom time.Time, assignedUntil *time.Time) error {
	if assignedUntil != nil && !assignedUntil.IsZero() {
		if assignedUntil.Before(assignedFrom) {
			return NewValidationError("Assigned until date must be after assigned from date")
		}
	}
	return nil
}
