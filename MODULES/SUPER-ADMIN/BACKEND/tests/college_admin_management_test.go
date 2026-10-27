package tests

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

// TestCollegeAdminAccount_SecuritySerialization verifies that sensitive credential fields
// such as password hashes or secret tokens are never accidentally serialized to JSON.
func TestCollegeAdminAccount_SecuritySerialization(t *testing.T) {
	now := time.Now()
	phone := "+919876543210"
	account := models.CollegeAdminAccount{
		UserID:      uuid.New(),
		CollegeID:   uuid.New(),
		Email:       "admin@testcollege.edu",
		Phone:       &phone,
		Status:      "ACTIVE",
		RoleCode:    "COLLEGE_ADMIN",
		RoleName:    "College Administrator",
		HasPassword: true,
		LastLoginAt: &now,
		CreatedAt:   now,
	}

	raw, err := json.Marshal(account)
	if err != nil {
		t.Fatalf("Failed to marshal CollegeAdminAccount: %v", err)
	}

	jsonStr := string(raw)

	// Ensure no password hashes or secret tokens exist
	if strings.Contains(jsonStr, "password_hash") {
		t.Errorf("Security violation: password_hash found in JSON output: %s", jsonStr)
	}
	if strings.Contains(jsonStr, "token") {
		t.Errorf("Security violation: token found in JSON output: %s", jsonStr)
	}
	if strings.Contains(jsonStr, "$2a$") || strings.Contains(jsonStr, "$2b$") {
		t.Errorf("Security violation: bcrypt hash signature found in JSON output: %s", jsonStr)
	}

	// Verify safe fields are preserved
	if !strings.Contains(jsonStr, "admin@testcollege.edu") {
		t.Errorf("Expected email to be serialized")
	}
	if !strings.Contains(jsonStr, "+919876543210") {
		t.Errorf("Expected phone to be serialized")
	}
	if !strings.Contains(jsonStr, "COLLEGE_ADMIN") {
		t.Errorf("Expected role_code to be serialized")
	}
}

// TestCollegeAdminService_UnconfiguredFailClosed verifies that unconfigured service
// components fail closed with an internal error rather than panicking or bypassing security.
func TestCollegeAdminService_UnconfiguredFailClosed(t *testing.T) {
	var svc *services.CollegeService
	ctx := context.Background()
	collegeID := uuid.New()
	adminID := uuid.New()

	// 1. List
	_, err := svc.ListCollegeAdmins(ctx, collegeID, models.ListCollegeAdminsParams{})
	if err == nil {
		t.Error("Expected error from nil service on ListCollegeAdmins, got nil")
	}

	// 2. Provision First
	_, err = svc.ProvisionFirstCollegeAdmin(ctx, collegeID, models.ProvisionFirstCollegeAdminRequest{
		Email:    "test@college.edu",
		Password: "Password123!",
	})
	if err == nil {
		t.Error("Expected error from nil service on ProvisionFirstCollegeAdmin, got nil")
	}

	// 3. Update Profile
	_, err = svc.UpdateCollegeAdminProfile(ctx, collegeID, adminID, models.UpdateCollegeAdminProfileRequest{})
	if err == nil {
		t.Error("Expected error from nil service on UpdateCollegeAdminProfile, got nil")
	}

	// 4. Update Status
	_, err = svc.UpdateCollegeAdminStatus(ctx, collegeID, adminID, models.UpdateCollegeAdminStatusRequest{
		Status: "DEACTIVATED",
		Reason: "Testing",
	})
	if err == nil {
		t.Error("Expected error from nil service on UpdateCollegeAdminStatus, got nil")
	}

	// 5. Unlock
	_, err = svc.UnlockCollegeAdminAccount(ctx, collegeID, adminID)
	if err == nil {
		t.Error("Expected error from nil service on UnlockCollegeAdminAccount, got nil")
	}

	// 6. Revoke Sessions
	_, err = svc.RevokeCollegeAdminSessions(ctx, collegeID, adminID)
	if err == nil {
		t.Error("Expected error from nil service on RevokeCollegeAdminSessions, got nil")
	}

	// 7. Login History
	_, err = svc.GetCollegeAdminLoginHistory(ctx, collegeID, adminID, 10)
	if err == nil {
		t.Error("Expected error from nil service on GetCollegeAdminLoginHistory, got nil")
	}
}

// TestCollegeAdminService_ValidationGuards verifies that invalid identifiers and empty inputs
// are rejected before database access.
func TestCollegeAdminService_ValidationGuards(t *testing.T) {
	svc := services.NewCollegeService(nil, nil)
	ctx := context.Background()

	// 1. Nil College ID for List
	_, err := svc.ListCollegeAdmins(ctx, uuid.Nil, models.ListCollegeAdminsParams{})
	if err == nil || !strings.Contains(err.Error(), "College ID is required") {
		t.Errorf("Expected 'College ID is required', got: %v", err)
	}

	// 2. Nil College ID for Provision
	_, err = svc.ProvisionFirstCollegeAdmin(ctx, uuid.Nil, models.ProvisionFirstCollegeAdminRequest{
		Email:    "valid@college.edu",
		Password: "Password123!",
	})
	if err == nil || !strings.Contains(err.Error(), "College ID is required") {
		t.Errorf("Expected 'College ID is required', got: %v", err)
	}

	// 3. Nil User ID for Status Update
	validCollegeID := uuid.New()
	_, err = svc.UpdateCollegeAdminStatus(ctx, validCollegeID, uuid.Nil, models.UpdateCollegeAdminStatusRequest{
		Status: "DEACTIVATED",
		Reason: "Test deactivation",
	})
	if err == nil || !strings.Contains(err.Error(), "User ID are required") {
		t.Errorf("Expected 'User ID are required', got: %v", err)
	}

	// 4. Empty Reason for Status Update
	validUserID := uuid.New()
	_, err = svc.UpdateCollegeAdminStatus(ctx, validCollegeID, validUserID, models.UpdateCollegeAdminStatusRequest{
		Status: "DEACTIVATED",
		Reason: "   ",
	})
	if err == nil || !strings.Contains(err.Error(), "Reason") {
		t.Errorf("Expected reason validation error, got: %v", err)
	}
}
