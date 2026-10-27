package tests

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

// TestPlatformStaffAccount_SecuritySerialization verifies that password hashes,
// tokens, and internal auth secrets are never exposed in JSON output.
func TestPlatformStaffAccount_SecuritySerialization(t *testing.T) {
	now := time.Now()
	phone := "+919876543210"
	account := models.PlatformStaffAccount{
		UserID:      uuid.New(),
		Email:       "platform.owner@hms.local",
		Phone:       &phone,
		Status:      "ACTIVE",
		RoleCode:    models.RolePlatformOwner,
		RoleName:    "Platform Owner",
		RoleScope:   "PLATFORM",
		MFAEnabled:  true,
		LastLoginAt: &now,
		CreatedAt:   now,
	}

	data, err := json.Marshal(account)
	if err != nil {
		t.Fatalf("Failed to marshal PlatformStaffAccount: %v", err)
	}

	jsonStr := string(data)

	// Ensure sensitive fields are not in JSON
	if strings.Contains(jsonStr, "password_hash") {
		t.Errorf("Security violation: password_hash exposed in PlatformStaffAccount JSON: %s", jsonStr)
	}
	if strings.Contains(jsonStr, "plaintext") {
		t.Errorf("Security violation: plaintext password exposed in PlatformStaffAccount JSON")
	}
	if strings.Contains(jsonStr, "$2a$") || strings.Contains(jsonStr, "$2b$") {
		t.Errorf("Security violation: bcrypt hash signature exposed in JSON")
	}

	// Verify safe fields exist
	if !strings.Contains(jsonStr, "platform.owner@hms.local") {
		t.Errorf("Expected email in JSON output")
	}
	if !strings.Contains(jsonStr, `"role_scope":"PLATFORM"`) {
		t.Errorf("Expected role_scope PLATFORM in JSON output")
	}
}

// TestStaffService_UnconfiguredFailClosed verifies that unconfigured service
// components fail closed with an internal error.
func TestStaffService_UnconfiguredFailClosed(t *testing.T) {
	var svc *services.StaffService
	ctx := context.Background()
	userID := uuid.New()

	// 1. List
	_, err := svc.ListPlatformStaff(ctx, models.ListPlatformStaffParams{})
	if err == nil {
		t.Error("Expected error on nil service for ListPlatformStaff, got nil")
	}

	// 2. Get
	_, err = svc.GetPlatformStaff(ctx, userID)
	if err == nil {
		t.Error("Expected error on nil service for GetPlatformStaff, got nil")
	}

	// 3. Update Profile
	_, err = svc.UpdatePlatformStaffProfile(ctx, userID, models.UpdatePlatformStaffProfileRequest{})
	if err == nil {
		t.Error("Expected error on nil service for UpdatePlatformStaffProfile, got nil")
	}

	// 4. Update Status
	_, err = svc.UpdatePlatformStaffStatus(ctx, userID, models.UpdatePlatformStaffStatusRequest{
		Status: "DEACTIVATED",
		Reason: "Test deactivation",
	})
	if err == nil {
		t.Error("Expected error on nil service for UpdatePlatformStaffStatus, got nil")
	}

	// 5. Pending Approvals
	_, err = svc.GetPlatformStaffPendingApprovals(ctx, userID)
	if err == nil {
		t.Error("Expected error on nil service for GetPlatformStaffPendingApprovals, got nil")
	}
}

// TestStaffService_ValidationGuards verifies that invalid identifiers and empty inputs
// are rejected before database access.
func TestStaffService_ValidationGuards(t *testing.T) {
	svc := services.NewStaffService(nil, nil)
	ctx := context.Background()

	// 1. Nil User ID for Get
	_, err := svc.GetPlatformStaff(ctx, uuid.Nil)
	if err == nil || !strings.Contains(err.Error(), "User ID is required") {
		t.Errorf("Expected 'User ID is required', got: %v", err)
	}

	// 2. Nil User ID for Update Profile
	_, err = svc.UpdatePlatformStaffProfile(ctx, uuid.Nil, models.UpdatePlatformStaffProfileRequest{})
	if err == nil || !strings.Contains(err.Error(), "User ID is required") {
		t.Errorf("Expected 'User ID is required', got: %v", err)
	}

	// 3. Nil User ID for Status
	_, err = svc.UpdatePlatformStaffStatus(ctx, uuid.Nil, models.UpdatePlatformStaffStatusRequest{
		Status: "DEACTIVATED",
		Reason: "Valid reason",
	})
	if err == nil || !strings.Contains(err.Error(), "User ID is required") {
		t.Errorf("Expected 'User ID is required', got: %v", err)
	}

	// 4. Empty Reason for Status
	validID := uuid.New()
	_, err = svc.UpdatePlatformStaffStatus(ctx, validID, models.UpdatePlatformStaffStatusRequest{
		Status: "DEACTIVATED",
		Reason: "   ",
	})
	if err == nil || !strings.Contains(err.Error(), "Reason for status change is required") {
		t.Errorf("Expected 'Reason for status change is required', got: %v", err)
	}

	// 5. Self-deactivation rejection
	actorCtx := database.WithPlatformUserID(ctx, validID)
	_, err = svc.UpdatePlatformStaffStatus(actorCtx, validID, models.UpdatePlatformStaffStatusRequest{
		Status: "DEACTIVATED",
		Reason: "Attempting self deactivation",
	})
	if err == nil || !strings.Contains(err.Error(), "Self-deactivation is prohibited") {
		t.Errorf("Expected 'Self-deactivation is prohibited', got: %v", err)
	}
}

// TestPlatformStaffRoleConstants verifies canonical role names from architecture.
func TestPlatformStaffRoleConstants(t *testing.T) {
	roles := map[string]string{
		"PO": models.RolePlatformOwner,
		"SA": models.RoleSuperAdmin,
		"CA": models.RoleConfigurationAdmin,
		"SU": models.RoleSupportAdmin,
		"OP": models.RoleOperationsAdmin,
		"AU": models.RoleAuditor,
	}

	for expected, actual := range roles {
		if expected != actual {
			t.Errorf("Role mismatch: expected %s, got %s", expected, actual)
		}
	}
}
