package tests

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/HOSTEL-INCHARGE/BACKEND/validators"
)

func TestInchargeValidators_HostelID(t *testing.T) {
	// Empty string should fail
	_, err := validators.ValidateHostelID("")
	if err == nil {
		t.Errorf("Expected error for empty hostel ID, got nil")
	}

	// Invalid UUID format should fail
	_, err = validators.ValidateHostelID("not-a-valid-uuid")
	if err == nil {
		t.Errorf("Expected error for malformed UUID, got nil")
	}

	// Valid UUID should pass
	validID := uuid.New()
	parsed, err := validators.ValidateHostelID(validID.String())
	if err != nil {
		t.Errorf("Unexpected error for valid UUID: %v", err)
	}
	if parsed != validID {
		t.Errorf("Parsed UUID %s != expected %s", parsed, validID)
	}
}

func TestInchargeValidators_CreateAccountInput(t *testing.T) {
	validHostelID := uuid.New()

	tests := []struct {
		name        string
		input       models.CreateInchargeAccountInput
		expectError bool
	}{
		{
			name: "Valid input",
			input: models.CreateInchargeAccountInput{
				Name:            "Warden John",
				HostelID:        validHostelID,
				Email:           "warden.john@college.edu",
				Password:        "SecurePassword123!",
				ConfirmPassword: "SecurePassword123!",
			},
			expectError: false,
		},
		{
			name: "Missing name",
			input: models.CreateInchargeAccountInput{
				Name:            "",
				HostelID:        validHostelID,
				Email:           "warden.john@college.edu",
				Password:        "SecurePassword123!",
				ConfirmPassword: "SecurePassword123!",
			},
			expectError: true,
		},
		{
			name: "Missing hostel ID",
			input: models.CreateInchargeAccountInput{
				Name:            "Warden John",
				HostelID:        uuid.Nil,
				Email:           "warden.john@college.edu",
				Password:        "SecurePassword123!",
				ConfirmPassword: "SecurePassword123!",
			},
			expectError: true,
		},
		{
			name: "Password too short",
			input: models.CreateInchargeAccountInput{
				Name:            "Warden John",
				HostelID:        validHostelID,
				Email:           "warden.john@college.edu",
				Password:        "short",
				ConfirmPassword: "short",
			},
			expectError: true,
		},
		{
			name: "Passwords do not match",
			input: models.CreateInchargeAccountInput{
				Name:            "Warden John",
				HostelID:        validHostelID,
				Email:           "warden.john@college.edu",
				Password:        "SecurePassword123!",
				ConfirmPassword: "DifferentPassword123!",
			},
			expectError: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateCreateInchargeAccountInput(&tc.input)
			if tc.expectError && err == nil {
				t.Errorf("Expected validation error but got nil")
			}
			if !tc.expectError && err != nil {
				t.Errorf("Unexpected validation error: %v", err)
			}
		})
	}
}

func TestInchargeValidators_Dates(t *testing.T) {
	now := time.Now()
	later := now.Add(24 * time.Hour)
	earlier := now.Add(-24 * time.Hour)

	// Assigned until after assigned from should pass
	if err := validators.ValidateInchargeDates(now, &later); err != nil {
		t.Errorf("Unexpected error: %v", err)
	}

	// Assigned until nil should pass
	if err := validators.ValidateInchargeDates(now, nil); err != nil {
		t.Errorf("Unexpected error with nil end date: %v", err)
	}

	// Assigned until before assigned from must fail
	if err := validators.ValidateInchargeDates(now, &earlier); err == nil {
		t.Errorf("Expected error when end date is before start date, got nil")
	}
}
