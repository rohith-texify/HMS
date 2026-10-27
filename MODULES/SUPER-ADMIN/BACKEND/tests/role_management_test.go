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

// TestRole_SecuritySerialization verifies that Role and RoleDetail structs
// serialize safe fields without leaking credentials or internal secrets.
func TestRole_SecuritySerialization(t *testing.T) {
	now := time.Now()
	desc := "View all hostel information"
	role := models.RoleDetail{
		Role: models.Role{
			RoleID:          uuid.New(),
			RoleCode:        "CUSTOM_AUDITOR",
			RoleName:        "Custom Auditor",
			Scope:           "COLLEGE",
			IsSystemRole:    false,
			CreatedAt:       now,
			UpdatedAt:       now,
			PermissionCount: 1,
			UserCount:       0,
		},
		Permissions: []models.Permission{
			{
				PermissionID:   uuid.New(),
				ModuleID:       uuid.New(),
				ModuleCode:     "HOSTEL",
				ModuleName:     "Hostel Management",
				PermissionCode: "hostel.view",
				ScopeType:      "COLLEGE",
				Description:    &desc,
			},
		},
	}

	data, err := json.Marshal(role)
	if err != nil {
		t.Fatalf("Failed to marshal RoleDetail: %v", err)
	}

	jsonStr := string(data)

	// Ensure no password hashes or secret tokens exist
	if strings.Contains(jsonStr, "password") {
		t.Errorf("Security violation: password field found in Role JSON: %s", jsonStr)
	}
	if strings.Contains(jsonStr, "secret") {
		t.Errorf("Security violation: secret field found in Role JSON: %s", jsonStr)
	}

	// Verify required public fields are present
	if !strings.Contains(jsonStr, "CUSTOM_AUDITOR") {
		t.Errorf("Expected role_code in JSON output")
	}
	if !strings.Contains(jsonStr, "hostel.view") {
		t.Errorf("Expected permission_code in JSON output")
	}
	if !strings.Contains(jsonStr, `"is_system_role":false`) {
		t.Errorf("Expected is_system_role in JSON output")
	}
}

// TestRoleService_UnconfiguredFailClosed verifies fail-closed security when service/repo is nil.
func TestRoleService_UnconfiguredFailClosed(t *testing.T) {
	var nilService *services.RoleService

	ctx := context.Background()

	_, err := nilService.ListRoles(ctx, models.ListRolesParams{})
	if err == nil || !strings.Contains(err.Error(), "not configured") {
		t.Errorf("Expected fail-closed error for ListRoles, got: %v", err)
	}

	_, err = nilService.GetRole(ctx, uuid.New())
	if err == nil || !strings.Contains(err.Error(), "not configured") {
		t.Errorf("Expected fail-closed error for GetRole, got: %v", err)
	}

	_, err = nilService.CreateCustomRole(ctx, models.CreateRoleRequest{
		RoleCode: "TEST",
		RoleName: "Test Role",
		Scope:    "COLLEGE",
	})
	if err == nil || !strings.Contains(err.Error(), "not configured") {
		t.Errorf("Expected fail-closed error for CreateCustomRole, got: %v", err)
	}

	_, err = nilService.CloneRole(ctx, uuid.New(), models.CloneRoleRequest{
		NewRoleCode: "TEST_CLONE",
		NewRoleName: "Test Clone",
	})
	if err == nil || !strings.Contains(err.Error(), "not configured") {
		t.Errorf("Expected fail-closed error for CloneRole, got: %v", err)
	}

	_, err = nilService.UpdateCustomRole(ctx, uuid.New(), models.UpdateRoleRequest{
		RoleName: "Updated Name",
	})
	if err == nil || !strings.Contains(err.Error(), "not configured") {
		t.Errorf("Expected fail-closed error for UpdateCustomRole, got: %v", err)
	}

	_, err = nilService.UpdateRolePermissions(ctx, uuid.New(), models.UpdateRolePermissionsRequest{
		PermissionIDs: []uuid.UUID{uuid.New()},
		Reason:        "Audit test",
	})
	if err == nil || !strings.Contains(err.Error(), "not configured") {
		t.Errorf("Expected fail-closed error for UpdateRolePermissions, got: %v", err)
	}

	err = nilService.DeleteCustomRole(ctx, uuid.New())
	if err == nil || !strings.Contains(err.Error(), "not configured") {
		t.Errorf("Expected fail-closed error for DeleteCustomRole, got: %v", err)
	}
}

// TestRoleService_ValidationGuards verifies input validation and business guards.
func TestRoleService_ValidationGuards(t *testing.T) {
	service := services.NewRoleService(nil, nil)
	ctx := context.Background()

	// 1. Role ID nil checks
	_, err := service.GetRole(ctx, uuid.Nil)
	if err == nil || !strings.Contains(err.Error(), "Role ID is required") {
		t.Errorf("Expected validation error for nil role ID, got: %v", err)
	}

	// 2. Clone nil source ID
	_, err = service.CloneRole(ctx, uuid.Nil, models.CloneRoleRequest{
		NewRoleCode: "VALID_CODE",
		NewRoleName: "Valid Name",
	})
	if err == nil || !strings.Contains(err.Error(), "Source role ID is required") {
		t.Errorf("Expected validation error for nil source role ID, got: %v", err)
	}

	// 3. Update nil role ID
	_, err = service.UpdateCustomRole(ctx, uuid.Nil, models.UpdateRoleRequest{
		RoleName: "New Name",
	})
	if err == nil || !strings.Contains(err.Error(), "Role ID is required") {
		t.Errorf("Expected validation error for nil role ID in update, got: %v", err)
	}

	// 4. Update permissions nil role ID
	_, err = service.UpdateRolePermissions(ctx, uuid.Nil, models.UpdateRolePermissionsRequest{
		PermissionIDs: []uuid.UUID{uuid.New()},
		Reason:        "Test Reason",
	})
	if err == nil || !strings.Contains(err.Error(), "Role ID is required") {
		t.Errorf("Expected validation error for nil role ID in update permissions, got: %v", err)
	}

	// 5. Update permissions missing reason
	_, err = service.UpdateRolePermissions(ctx, uuid.New(), models.UpdateRolePermissionsRequest{
		PermissionIDs: []uuid.UUID{uuid.New()},
		Reason:        "   ",
	})
	if err == nil || !strings.Contains(err.Error(), "Reason for permission change is required") {
		t.Errorf("Expected validation error for missing reason in update permissions, got: %v", err)
	}

	// 6. Delete nil role ID
	err = service.DeleteCustomRole(ctx, uuid.Nil)
	if err == nil || !strings.Contains(err.Error(), "Role ID is required") {
		t.Errorf("Expected validation error for nil role ID in delete, got: %v", err)
	}
}

// TestRoleService_TemplatesAdvisoryStatus verifies that role template status
// clearly declares the schema blocker rather than fabricating persistent template records.
func TestRoleService_TemplatesAdvisoryStatus(t *testing.T) {
	service := services.NewRoleService(nil, nil)
	ctx := context.Background()

	res, err := service.ListRoleTemplates(ctx)
	if err != nil {
		t.Fatalf("Unexpected error from ListRoleTemplates: %v", err)
	}

	status, ok := res["status"].(string)
	if !ok || status != "BLOCKED_SCHEMA_MIGRATION_REQUIRED" {
		t.Errorf("Expected status BLOCKED_SCHEMA_MIGRATION_REQUIRED, got: %v", res["status"])
	}

	msg, ok := res["message"].(string)
	if !ok || !strings.Contains(msg, "platform.role_templates") {
		t.Errorf("Expected advisory message referencing platform.role_templates, got: %v", res["message"])
	}
}
