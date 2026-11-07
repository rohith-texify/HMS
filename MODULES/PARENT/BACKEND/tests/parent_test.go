package tests

import (
	"testing"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/PARENT/BACKEND/validators"
)

func TestParentValidators_UUID(t *testing.T) {
	// Empty string should fail
	_, err := validators.ValidateUUID("parent_id", "")
	if err == nil {
		t.Errorf("Expected error for empty parent ID, got nil")
	}

	// Invalid UUID format should fail
	_, err = validators.ValidateUUID("parent_id", "not-a-valid-uuid")
	if err == nil {
		t.Errorf("Expected error for malformed UUID, got nil")
	}

	// Valid UUID should pass
	validID := uuid.New()
	parsed, err := validators.ValidateUUID("parent_id", validID.String())
	if err != nil {
		t.Errorf("Unexpected error for valid UUID: %v", err)
	}
	if parsed != validID {
		t.Errorf("Parsed UUID %s != expected %s", parsed, validID)
	}
}

func TestParentValidators_Pagination(t *testing.T) {
	// Default limit fallback
	limit, offset, err := validators.ValidatePagination(0, 0)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if limit != 50 || offset != 0 {
		t.Errorf("Expected default limit 50, offset 0; got limit %d, offset %d", limit, offset)
	}

	// Over max limit
	_, _, err = validators.ValidatePagination(101, 0)
	if err == nil {
		t.Errorf("Expected error for limit > 100, got nil")
	}

	// Negative offset
	_, _, err = validators.ValidatePagination(20, -5)
	if err == nil {
		t.Errorf("Expected error for negative offset, got nil")
	}

	// Valid bounds
	limit, offset, err = validators.ValidatePagination(25, 50)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
	}
	if limit != 25 || offset != 50 {
		t.Errorf("Expected limit 25, offset 50; got limit %d, offset %d", limit, offset)
	}
}

func TestParentValidators_ParentInput(t *testing.T) {
	// Empty first name
	err := validators.ValidateParentInput("")
	if err == nil {
		t.Errorf("Expected error for empty first name, got nil")
	}

	// Whitespace only
	err = validators.ValidateParentInput("   ")
	if err == nil {
		t.Errorf("Expected error for whitespace first name, got nil")
	}

	// Valid name
	err = validators.ValidateParentInput("Robert")
	if err != nil {
		t.Errorf("Unexpected error for valid first name: %v", err)
	}
}

func TestParentValidators_Credentials(t *testing.T) {
	email := "parent@example.com"
	shortPwd := "12345"
	validPwd := "Password@123"
	mismatchPwd := "Password@456"

	// Short password
	err := validators.ValidateParentCredentials(&email, &shortPwd, &shortPwd)
	if err == nil {
		t.Errorf("Expected error for short password, got nil")
	}

	// Password mismatch
	err = validators.ValidateParentCredentials(&email, &validPwd, &mismatchPwd)
	if err == nil {
		t.Errorf("Expected error for password mismatch, got nil")
	}

	// Missing email when password is provided
	emptyEmail := ""
	err = validators.ValidateParentCredentials(&emptyEmail, &validPwd, &validPwd)
	if err == nil {
		t.Errorf("Expected error for missing email with password, got nil")
	}

	// Valid credentials
	err = validators.ValidateParentCredentials(&email, &validPwd, &validPwd)
	if err != nil {
		t.Errorf("Unexpected error for valid credentials: %v", err)
	}

	// Nil password (allowed when not provisioning user account)
	err = validators.ValidateParentCredentials(nil, nil, nil)
	if err != nil {
		t.Errorf("Unexpected error for nil password: %v", err)
	}
}

func TestParentValidators_StudentParentInput(t *testing.T) {
	parentID := uuid.New()

	// Empty relationship
	err := validators.ValidateStudentParentInput(parentID, "")
	if err == nil {
		t.Errorf("Expected error for empty relationship, got nil")
	}

	// Nil parent ID
	err = validators.ValidateStudentParentInput(uuid.Nil, "Father")
	if err == nil {
		t.Errorf("Expected error for nil parent ID, got nil")
	}

	// Valid input
	err = validators.ValidateStudentParentInput(parentID, "Father")
	if err != nil {
		t.Errorf("Unexpected error for valid student-parent input: %v", err)
	}
}

