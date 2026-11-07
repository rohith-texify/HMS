package validators

import (
	"errors"
	"strings"

	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
)

var (
	ErrEmptyID             = errors.New("id cannot be empty")
	ErrInvalidUUID         = errors.New("invalid uuid format")
	ErrEmptyFirstName      = errors.New("first name is required")
	ErrInvalidPagination   = errors.New("limit must be between 1 and 100, and offset >= 0")
	ErrEmptyRelationship   = errors.New("relationship is required")
	ErrPasswordTooShort    = errors.New("password must be at least 8 characters long")
	ErrPasswordMismatch    = errors.New("password and confirm password do not match")
	ErrEmailRequiredForPWD = errors.New("email address is required to create parent portal login credentials")
)

// NewValidationError creates a new validation error with standard error code.
func NewValidationError(message string) *apierrors.APIError {
	return apierrors.New(apierrors.ValidationError, message)
}

// ValidateUUID parses and verifies a UUID string.
func ValidateUUID(paramName, raw string) (uuid.UUID, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return uuid.Nil, NewValidationError(paramName + " is required")
	}
	id, err := uuid.Parse(trimmed)
	if err != nil {
		return uuid.Nil, NewValidationError("invalid " + paramName + " format")
	}
	if id == uuid.Nil {
		return uuid.Nil, NewValidationError(paramName + " cannot be nil")
	}
	return id, nil
}

// ValidatePagination ensures limit and offset are within valid system ranges.
func ValidatePagination(limit, offset int) (int, int, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		return 0, 0, NewValidationError("limit cannot exceed 100")
	}
	if offset < 0 {
		return 0, 0, NewValidationError("offset cannot be negative")
	}
	return limit, offset, nil
}

// ValidateParentInput validates parent creation/update basic fields.
func ValidateParentInput(firstName string) error {
	if strings.TrimSpace(firstName) == "" {
		return NewValidationError("first name is required")
	}
	return nil
}

// ValidateParentCredentials validates credentials if a password is supplied.
func ValidateParentCredentials(email *string, password *string, confirmPassword *string) error {
	if password == nil || strings.TrimSpace(*password) == "" {
		return nil
	}
	pwd := strings.TrimSpace(*password)
	if len(pwd) < 8 {
		return NewValidationError("password must be at least 8 characters long")
	}
	if confirmPassword != nil && strings.TrimSpace(*confirmPassword) != "" {
		if pwd != strings.TrimSpace(*confirmPassword) {
			return NewValidationError("password and confirm password do not match")
		}
	}
	if email == nil || strings.TrimSpace(*email) == "" {
		return NewValidationError("email address is required to create parent portal login credentials")
	}
	return nil
}

// ValidateStudentParentInput validates relationship payload.
func ValidateStudentParentInput(parentID uuid.UUID, relationship string) error {
	if parentID == uuid.Nil {
		return NewValidationError("parent_id is required")
	}
	if strings.TrimSpace(relationship) == "" {
		return NewValidationError("relationship is required")
	}
	return nil
}
