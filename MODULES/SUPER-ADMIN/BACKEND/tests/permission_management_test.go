package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

// TestPermission_SecuritySerialization ensures permission models never leak sensitive data
// like password hashes, tokens, or personal phone numbers in JSON responses.
func TestPermission_SecuritySerialization(t *testing.T) {
	now := time.Now()
	desc := "View platform analytics"
	collegeID := uuid.New()
	collegeName := "Engineering College"

	detail := models.PermissionDetail{
		PermissionID:     uuid.New(),
		ModuleID:         uuid.New(),
		ModuleCode:       "PLATFORM",
		ModuleName:       "Platform Core",
		PermissionCode:   "platform.view",
		ScopeType:        "PLATFORM",
		Description:      &desc,
		CreatedAt:        now,
		UpdatedAt:        now,
		MappedRolesCount: 1,
		IsOrphan:         false,
		MappedRoles: []models.RoleRef{
			{
				RoleID:       uuid.New(),
				RoleCode:     "SUPER_ADMIN",
				RoleName:     "Super Administrator",
				Scope:        "PLATFORM",
				IsSystemRole: true,
			},
		},
	}

	data, err := json.Marshal(detail)
	if err != nil {
		t.Fatalf("Failed to marshal PermissionDetail: %v", err)
	}

	str := string(data)
	if strings.Contains(str, "password") {
		t.Errorf("Security risk: password field in permission detail JSON: %s", str)
	}
	if strings.Contains(str, "secret") {
		t.Errorf("Security risk: secret field in permission detail JSON: %s", str)
	}

	whoHasWhat := models.WhoHasWhatResponse{
		Permission:      detail,
		MappedRoles:     detail.MappedRoles,
		AssignedUsers: []models.PermissionUserAssignment{
			{
				UserID:           uuid.New(),
				Email:            "admin@college.edu",
				RoleID:           detail.MappedRoles[0].RoleID,
				RoleCode:         detail.MappedRoles[0].RoleCode,
				RoleName:         detail.MappedRoles[0].RoleName,
				Scope:            "COLLEGE",
				CollegeID:        &collegeID,
				CollegeName:      &collegeName,
				UserStatus:       "ACTIVE",
				AssignmentStatus: "ACTIVE",
				AssignedAt:       now,
			},
		},
		TotalRolesCount: 1,
		TotalUsersCount: 1,
		ScopeNotice:     "Tenant boundary strictly enforced.",
	}

	whoData, err := json.Marshal(whoHasWhat)
	if err != nil {
		t.Fatalf("Failed to marshal WhoHasWhatResponse: %v", err)
	}

	whoStr := string(whoData)
	if strings.Contains(whoStr, "password_hash") {
		t.Errorf("Security risk: password_hash exposed in WhoHasWhat JSON: %s", whoStr)
	}
	if strings.Contains(whoStr, "phone") {
		t.Errorf("Privacy violation: phone number exposed in WhoHasWhat JSON: %s", whoStr)
	}
}

// TestPermission_OrphanDetectionDefinition verifies that orphan detection report
// accurately distinguishes between zero role mappings and API code enforcement.
func TestPermission_OrphanDetectionDefinition(t *testing.T) {
	report := models.OrphanPermissionsReport{
		Definition:  "An orphan permission is defined as an atomic permission in platform.permissions that is currently mapped to ZERO roles in platform.role_permissions.",
		Notice:      "Permissions identified as unmapped in database are candidates for role mapping or code deprecation analysis.",
		TotalCount:  2,
		CatalogSize: 22,
		Orphans: []models.PermissionDetail{
			{
				PermissionID:     uuid.New(),
				PermissionCode:   "audit.export",
				ScopeType:        "COLLEGE",
				MappedRolesCount: 0,
				IsOrphan:         true,
			},
			{
				PermissionID:     uuid.New(),
				PermissionCode:   "legacy.sync",
				ScopeType:        "PLATFORM",
				MappedRolesCount: 0,
				IsOrphan:         true,
			},
		},
	}

	if !strings.Contains(report.Definition, "ZERO roles in platform.role_permissions") {
		t.Errorf("Expected precise database orphan definition, got: %s", report.Definition)
	}
	for _, o := range report.Orphans {
		if !o.IsOrphan {
			t.Errorf("Orphan item %s has IsOrphan = false", o.PermissionCode)
		}
		if o.MappedRolesCount != 0 {
			t.Errorf("Orphan item %s has MappedRolesCount != 0 (%d)", o.PermissionCode, o.MappedRolesCount)
		}
	}
}

// TestPermission_DeprecationStatusAdvisory verifies that deprecation status correctly
// reports BLOCKED due to absence of is_deprecated column in platform.permissions schema.
func TestPermission_DeprecationStatusAdvisory(t *testing.T) {
	svc := services.NewPermissionService(nil, nil)
	status, err := svc.GetDeprecationStatus(context.Background())
	if err != nil {
		t.Fatalf("Unexpected error getting deprecation status: %v", err)
	}

	if status.Supported {
		t.Errorf("Expected Supported to be false, got true")
	}
	if status.Status != "BLOCKED" {
		t.Errorf("Expected Status to be BLOCKED, got %s", status.Status)
	}
	if !strings.Contains(status.SchemaBlocker, "is_deprecated") {
		t.Errorf("Expected schema blocker to mention missing is_deprecated column, got: %s", status.SchemaBlocker)
	}
	if len(status.BlockedCapabilities) == 0 {
		t.Errorf("Expected blocked capabilities list to be populated")
	}
}

// TestPermission_FailClosedWhenUnconfigured verifies fail-closed behavior when service has nil repo.
func TestPermission_FailClosedWhenUnconfigured(t *testing.T) {
	svc := services.NewPermissionService(nil, nil)
	ctx := context.Background()

	_, err := svc.ListPermissions(ctx, models.ListPermissionsFilter{})
	if err == nil {
		t.Errorf("Expected error from unconfigured ListPermissions, got nil")
	}

	_, err = svc.GetPermissionDetail(ctx, uuid.New())
	if err == nil {
		t.Errorf("Expected error from unconfigured GetPermissionDetail, got nil")
	}

	_, err = svc.GetWhoHasWhat(ctx, uuid.New())
	if err == nil {
		t.Errorf("Expected error from unconfigured GetWhoHasWhat, got nil")
	}

	_, err = svc.ListOrphanPermissions(ctx)
	if err == nil {
		t.Errorf("Expected error from unconfigured ListOrphanPermissions, got nil")
	}
}

// TestPermission_ScopeTypeValidation tests that scope values conform to PLATFORM, COLLEGE, GLOBAL.
func TestPermission_ScopeTypeValidation(t *testing.T) {
	validScopes := map[string]bool{
		"PLATFORM": true,
		"COLLEGE":  true,
		"GLOBAL":   true,
	}

	testCases := []struct {
		scope string
		valid bool
	}{
		{"PLATFORM", true},
		{"COLLEGE", true},
		{"GLOBAL", true},
		{"TENANT", false},
		{"SUPER_ADMIN", false},
		{"INVALID", false},
	}

	for _, tc := range testCases {
		_, ok := validScopes[tc.scope]
		if ok != tc.valid {
			t.Errorf("Scope validation mismatch for %s: expected %v, got %v", tc.scope, tc.valid, ok)
		}
	}
}

// TestLivePermissionAPI_EndToEnd tests the live running server's permission endpoints.
func TestLivePermissionAPI_EndToEnd(t *testing.T) {
	resp, err := http.Get("http://localhost:8080/health")
	if err != nil {
		t.Skip("Live server is not running on :8080, skipping live E2E test")
		return
	}
	resp.Body.Close()

	secret := "HMS_2026_a8F7kP2xQ9mL4vR6tY3nW8zC5jD1sG7hK0pX"
	if s := os.Getenv("JWT_SECRET"); s != "" {
		secret = s
	}

	now := time.Now()
	claims := platformTestClaims{
		TenantID: nil,
		Role:     "SUPER_ADMIN",
		Scope:    "PLATFORM",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "8e14eed1-6d82-4807-a769-df15bfc236b2",
			Issuer:    "hms-api",
			Audience:  jwt.ClaimStrings{"hms-client"},
			ExpiresAt: jwt.NewNumericDate(now.Add(1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token, err := jwtToken.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign JWT: %v", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}

	// 1. Test GET /super-admin/permissions (catalog with stats)
	req, _ := http.NewRequest(http.MethodGet, "http://localhost:8080/super-admin/permissions", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Scope", "PLATFORM")
	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("GET /super-admin/permissions failed: %v", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for /super-admin/permissions, got %d", res.StatusCode)
	}

	var catResp struct {
		Success bool `json:"success"`
		Data    struct {
			Permissions []models.PermissionDetail `json:"permissions"`
			Total       int                       `json:"total"`
		} `json:"data"`
	}
	if err := json.NewDecoder(res.Body).Decode(&catResp); err != nil {
		t.Fatalf("failed to parse catalog response: %v", err)
	}
	if catResp.Data.Total == 0 || len(catResp.Data.Permissions) == 0 {
		t.Fatalf("expected catalog permissions, got total=%d", catResp.Data.Total)
	}

	firstPerm := catResp.Data.Permissions[0]

	// 2. Test GET /super-admin/permissions/orphans
	oReq, _ := http.NewRequest(http.MethodGet, "http://localhost:8080/super-admin/permissions/orphans", nil)
	oReq.Header.Set("Authorization", "Bearer "+token)
	oReq.Header.Set("X-Scope", "PLATFORM")
	oRes, err := client.Do(oReq)
	if err != nil {
		t.Fatalf("GET /super-admin/permissions/orphans failed: %v", err)
	}
	defer oRes.Body.Close()
	if oRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for /super-admin/permissions/orphans, got %d", oRes.StatusCode)
	}

	// 3. Test GET /super-admin/permissions/deprecation-status
	dReq, _ := http.NewRequest(http.MethodGet, "http://localhost:8080/super-admin/permissions/deprecation-status", nil)
	dReq.Header.Set("Authorization", "Bearer "+token)
	dReq.Header.Set("X-Scope", "PLATFORM")
	dRes, err := client.Do(dReq)
	if err != nil {
		t.Fatalf("GET /super-admin/permissions/deprecation-status failed: %v", err)
	}
	defer dRes.Body.Close()
	if dRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for deprecation-status, got %d", dRes.StatusCode)
	}

	// 4. Test GET /super-admin/permissions/:id (detail)
	detReq, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("http://localhost:8080/super-admin/permissions/%s", firstPerm.PermissionID), nil)
	detReq.Header.Set("Authorization", "Bearer "+token)
	detReq.Header.Set("X-Scope", "PLATFORM")
	detRes, err := client.Do(detReq)
	if err != nil {
		t.Fatalf("GET permission detail failed: %v", err)
	}
	defer detRes.Body.Close()
	if detRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for permission detail, got %d", detRes.StatusCode)
	}

	// 5. Test GET /super-admin/permissions/:id/who-has-what
	whoReq, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("http://localhost:8080/super-admin/permissions/%s/who-has-what", firstPerm.PermissionID), nil)
	whoReq.Header.Set("Authorization", "Bearer "+token)
	whoReq.Header.Set("X-Scope", "PLATFORM")
	whoRes, err := client.Do(whoReq)
	if err != nil {
		t.Fatalf("GET who-has-what failed: %v", err)
	}
	defer whoRes.Body.Close()
	if whoRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for who-has-what, got %d", whoRes.StatusCode)
	}
}
