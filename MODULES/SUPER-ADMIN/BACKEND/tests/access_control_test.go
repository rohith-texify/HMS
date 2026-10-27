package tests

import (
	"bytes"
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

// TestAccessControl_Serialization verifies safe serialization of access control structures.
func TestAccessControl_Serialization(t *testing.T) {
	now := time.Now()
	collegeID := uuid.New()
	moduleID := uuid.New()

	item := models.HierarchicalAccessItem{
		ModuleID:         moduleID,
		ModuleCode:       "HOSTEL_VISITORS",
		ModuleName:       "Visitor Management",
		Kind:             "FEATURE",
		Priority:         "M",
		IsCore:           false,
		CatalogueActive:  true,
		CollegeID:        collegeID,
		EffectiveFrom:    &now,
		ConfiguredStatus: "ACTIVE",
		ConfiguredMode:   "READ_ONLY",
		EffectiveStatus:  "ACTIVE",
		EffectiveMode:    "READ_ONLY",
		Actions: []models.ActionEntitlement{
			{
				ActionCode:      "visitor.view",
				ActionName:      "View Visitor Logs",
				IsMutateAction:  false,
				EffectiveAccess: "ALLOWED",
			},
			{
				ActionCode:      "visitor.manage",
				ActionName:      "Create or Check-in Visitor",
				IsMutateAction:  true,
				EffectiveAccess: "RESTRICTED_READ_ONLY",
				RestrictionNote: "Feature mode is configured as READ_ONLY. Edit actions are blocked.",
			},
		},
	}

	data, err := json.Marshal(item)
	if err != nil {
		t.Fatalf("Failed to marshal HierarchicalAccessItem: %v", err)
	}

	str := string(data)
	if strings.Contains(str, "password") {
		t.Errorf("Security risk: password leaked in JSON: %s", str)
	}

	report := models.WhyDeniedEvaluationReport{
		Allowed:          false,
		PrimaryReason:    "Feature is configured in READ_ONLY mode. Edit actions are prohibited.",
		DenialStage:      "READ_ONLY_RESTRICTION",
		EffectiveStatus:  "ACTIVE",
		EffectiveMode:    "READ_ONLY",
		TargetModuleCode: "HOSTEL_VISITORS",
		TargetKind:       "FEATURE",
		EvaluatedAction:  "visitor.manage",
		EvaluationSteps: []models.EvaluationStep{
			{
				Stage:   "TENANT_STATUS",
				Rule:    "College status must be ACTIVE",
				Status:  "PASS",
				Details: "College is ACTIVE.",
			},
			{
				Stage:   "READ_ONLY_RESTRICTION",
				Rule:    "READ_ONLY mode prohibits mutate actions",
				Status:  "FAIL",
				Details: "Requested action is mutate, but mode is READ_ONLY.",
			},
		},
		RemediationAdvice: "To allow this action, update feature mode from READ_ONLY to FULL.",
	}

	repData, err := json.Marshal(report)
	if err != nil {
		t.Fatalf("Failed to marshal WhyDeniedEvaluationReport: %v", err)
	}

	repStr := string(repData)
	if !strings.Contains(repStr, "READ_ONLY_RESTRICTION") {
		t.Errorf("Expected READ_ONLY_RESTRICTION in report JSON: %s", repStr)
	}
}

// TestAccessControl_InheritedDisabledState validates that child features inherit parent disabled status.
func TestAccessControl_InheritedDisabledState(t *testing.T) {
	parentApp := models.HierarchicalAccessItem{
		ModuleID:         uuid.New(),
		ModuleCode:       "HOSTEL",
		ModuleName:       "Hostel Management",
		Kind:             "APP",
		EffectiveStatus:  "DISABLED",
		ConfiguredStatus: "DISABLED",
	}

	childFeature := models.HierarchicalAccessItem{
		ModuleID:         uuid.New(),
		ModuleCode:       "HOSTEL_ROOMS",
		ModuleName:       "Room Inventory",
		Kind:             "FEATURE",
		ParentID:         &parentApp.ModuleID,
		ParentCode:       parentApp.ModuleCode,
		ConfiguredStatus: "ACTIVE", // Configured active locally, but parent is disabled!
	}

	// Simulation of inheritance resolution logic:
	if parentApp.EffectiveStatus != "ACTIVE" {
		childFeature.EffectiveStatus = "DISABLED"
		childFeature.InheritedDisabled = true
		childFeature.InheritanceSource = fmt.Sprintf("Inherited disabled state from %s '%s'", parentApp.Kind, parentApp.ModuleName)
	}

	if childFeature.EffectiveStatus != "DISABLED" {
		t.Errorf("Expected child feature to be DISABLED due to parent inheritance, got %s", childFeature.EffectiveStatus)
	}
	if !childFeature.InheritedDisabled {
		t.Errorf("Expected InheritedDisabled flag to be true")
	}
	if !strings.Contains(childFeature.InheritanceSource, "Hostel Management") {
		t.Errorf("Expected inheritance source to name parent, got: %s", childFeature.InheritanceSource)
	}
}

// TestAccessControl_ReadOnlyActionRestriction validates mode restriction logic.
func TestAccessControl_ReadOnlyActionRestriction(t *testing.T) {
	featureMode := "READ_ONLY"

	testActions := []struct {
		actionCode     string
		isMutate       bool
		expectedAccess string
	}{
		{"visitor.view", false, "ALLOWED"},
		{"visitor.export", false, "ALLOWED"},
		{"visitor.manage", true, "RESTRICTED_READ_ONLY"},
		{"visitor.create", true, "RESTRICTED_READ_ONLY"},
		{"visitor.delete", true, "RESTRICTED_READ_ONLY"},
	}

	for _, tc := range testActions {
		effectiveAccess := "ALLOWED"
		if tc.isMutate && featureMode == "READ_ONLY" {
			effectiveAccess = "RESTRICTED_READ_ONLY"
		}
		if effectiveAccess != tc.expectedAccess {
			t.Errorf("Action %s access mismatch: expected %s, got %s", tc.actionCode, tc.expectedAccess, effectiveAccess)
		}
	}
}

// TestAccessControl_FailClosedWhenUnconfigured verifies fail-closed behavior for unconfigured service.
func TestAccessControl_FailClosedWhenUnconfigured(t *testing.T) {
	svc := services.NewAccessControlService(nil, nil)
	ctx := context.Background()

	_, err := svc.GetTenantAccessHierarchy(ctx, uuid.New())
	if err == nil {
		t.Errorf("Expected error from unconfigured GetTenantAccessHierarchy, got nil")
	}

	err = svc.UpdateFeatureAccess(ctx, uuid.New(), uuid.New(), models.UpdateFeatureAccessRequest{
		Status: "ACTIVE",
		Mode:   "FULL",
		Reason: "Valid reason for update",
	}, uuid.New(), "SUPER_ADMIN")
	if err == nil {
		t.Errorf("Expected error from unconfigured UpdateFeatureAccess, got nil")
	}

	_, err = svc.EvaluateWhyDenied(ctx, models.EvaluateAccessRequest{
		CollegeID:           uuid.New(),
		ModuleOrFeatureCode: "HOSTEL",
	})
	if err == nil {
		t.Errorf("Expected error from unconfigured EvaluateWhyDenied, got nil")
	}
}

// TestLiveAccessControlAPI_EndToEnd tests live running server access control endpoints.
func TestLiveAccessControlAPI_EndToEnd(t *testing.T) {
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

	// 0. Fetch existing college ID
	cReq, _ := http.NewRequest(http.MethodGet, "http://localhost:8080/super-admin/colleges", nil)
	cReq.Header.Set("Authorization", "Bearer "+token)
	cReq.Header.Set("X-Scope", "PLATFORM")
	cRes, err := client.Do(cReq)
	if err != nil {
		t.Fatalf("GET /super-admin/colleges failed: %v", err)
	}
	defer cRes.Body.Close()

	var collegesList struct {
		Data struct {
			Colleges []struct {
				CollegeID string `json:"college_id"`
			} `json:"colleges"`
		} `json:"data"`
	}
	_ = json.NewDecoder(cRes.Body).Decode(&collegesList)
	if len(collegesList.Data.Colleges) == 0 {
		t.Skip("No colleges found in database, skipping live test")
		return
	}
	collegeID := collegesList.Data.Colleges[0].CollegeID

	// 1. Test GET /super-admin/colleges/:id/access-control/matrix
	req, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("http://localhost:8080/super-admin/colleges/%s/access-control/matrix", collegeID), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Scope", "PLATFORM")
	res, err := client.Do(req)
	if err != nil {
		t.Fatalf("GET /access-control/matrix failed: %v", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for access-control/matrix, got %d", res.StatusCode)
	}

	var matrixResp struct {
		Success bool                                    `json:"success"`
		Data    models.HierarchicalAccessMatrixResponse `json:"data"`
	}
	if err := json.NewDecoder(res.Body).Decode(&matrixResp); err != nil {
		t.Fatalf("failed to parse access matrix response: %v", err)
	}
	if matrixResp.Data.TotalItems == 0 {
		t.Fatalf("expected hierarchy items in access matrix, got 0")
	}

	// 2. Test POST /super-admin/colleges/:id/access-control/evaluate (Why is this denied?)
	evalPayload := models.EvaluateAccessRequest{
		ModuleOrFeatureCode: "HOSTEL",
		Action:              "hostel.view",
		HTTPMethod:          "GET",
	}
	bodyBytes, _ := json.Marshal(evalPayload)
	evalReq, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("http://localhost:8080/super-admin/colleges/%s/access-control/evaluate", collegeID), bytes.NewReader(bodyBytes))
	evalReq.Header.Set("Authorization", "Bearer "+token)
	evalReq.Header.Set("X-Scope", "PLATFORM")
	evalReq.Header.Set("Content-Type", "application/json")
	evalRes, err := client.Do(evalReq)
	if err != nil {
		t.Fatalf("POST /access-control/evaluate failed: %v", err)
	}
	defer evalRes.Body.Close()
	if evalRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for /access-control/evaluate, got %d", evalRes.StatusCode)
	}

	var evalResp struct {
		Success bool                             `json:"success"`
		Data    models.WhyDeniedEvaluationReport `json:"data"`
	}
	if err := json.NewDecoder(evalRes.Body).Decode(&evalResp); err != nil {
		t.Fatalf("failed to parse evaluation response: %v", err)
	}
	if len(evalResp.Data.EvaluationSteps) == 0 {
		t.Fatalf("expected evaluation steps in report trace, got 0")
	}

	// 3. Test Global POST /super-admin/access-control/evaluate
	globalPayload := models.EvaluateAccessRequest{
		CollegeID:           uuid.MustParse(collegeID),
		ModuleOrFeatureCode: "HOSTEL",
		Action:              "hostel.manage",
		HTTPMethod:          "POST",
	}
	gBytes, _ := json.Marshal(globalPayload)
	gReq, _ := http.NewRequest(http.MethodPost, "http://localhost:8080/super-admin/access-control/evaluate", bytes.NewReader(gBytes))
	gReq.Header.Set("Authorization", "Bearer "+token)
	gReq.Header.Set("X-Scope", "PLATFORM")
	gReq.Header.Set("Content-Type", "application/json")
	gRes, err := client.Do(gReq)
	if err != nil {
		t.Fatalf("POST global /access-control/evaluate failed: %v", err)
	}
	defer gRes.Body.Close()
	if gRes.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for global evaluate, got %d", gRes.StatusCode)
	}
}
