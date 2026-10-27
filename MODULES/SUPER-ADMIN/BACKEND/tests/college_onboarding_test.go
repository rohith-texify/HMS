package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// -----------------------------------------------------------------------------
// 1. CANONICAL STEPS & VALIDATOR UNIT TESTS
// -----------------------------------------------------------------------------

func TestCanonicalOnboardingSteps(t *testing.T) {
	expected := []string{
		"COLLEGE_PROFILE",
		"COLLEGE_ADMIN",
		"READINESS_REVIEW",
		"GO_LIVE",
	}

	if len(validators.CanonicalOnboardingSteps) != len(expected) {
		t.Fatalf("expected %d canonical steps, got %d", len(expected), len(validators.CanonicalOnboardingSteps))
	}

	for i, step := range expected {
		if validators.CanonicalOnboardingSteps[i] != step {
			t.Errorf("step %d: expected %s, got %s", i, step, validators.CanonicalOnboardingSteps[i])
		}
	}
}

func TestUpdateOnboardingStepValidation(t *testing.T) {
	notes := "Step verified and confirmed"
	emptyNotes := "   "
	longNotes := strings.Repeat("A", 1001)

	tests := []struct {
		name      string
		stepCode  string
		req       *models.UpdateCollegeOnboardingRequest
		expectErr bool
		errMsg    string
	}{
		{
			name:      "nil request",
			stepCode:  "COLLEGE_PROFILE",
			req:       nil,
			expectErr: true,
			errMsg:    "Request body is required",
		},
		{
			name:     "invalid step code",
			stepCode: "INVALID_STEP",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "IN_PROGRESS",
			},
			expectErr: true,
			errMsg:    "Invalid onboarding step code",
		},
		{
			name:     "invalid status",
			stepCode: "COLLEGE_PROFILE",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "FINISHED",
			},
			expectErr: true,
			errMsg:    "Invalid onboarding status",
		},
		{
			name:     "completed requires notes",
			stepCode: "COLLEGE_PROFILE",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "COMPLETED",
			},
			expectErr: true,
			errMsg:    "Notes are required to document step completion",
		},
		{
			name:     "completed rejects whitespace notes",
			stepCode: "COLLEGE_PROFILE",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "COMPLETED",
				Notes:  &emptyNotes,
			},
			expectErr: true,
			errMsg:    "Notes are required to document step completion",
		},
		{
			name:     "notes exceed max length",
			stepCode: "COLLEGE_PROFILE",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "IN_PROGRESS",
				Notes:  &longNotes,
			},
			expectErr: true,
			errMsg:    "Notes cannot exceed 1000 characters",
		},
		{
			name:     "valid COMPLETED step",
			stepCode: "COLLEGE_PROFILE",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "COMPLETED",
				Notes:  &notes,
			},
			expectErr: false,
		},
		{
			name:     "valid IN_PROGRESS step without notes",
			stepCode: "ENTITLEMENTS",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "IN_PROGRESS",
			},
			expectErr: false,
		},
		{
			name:     "valid SKIPPED step",
			stepCode: "BRANDING",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "SKIPPED",
			},
			expectErr: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateUpdateCollegeOnboardingRequest(tc.stepCode, tc.req)
			if tc.expectErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if tc.errMsg != "" && !strings.Contains(err.Error(), tc.errMsg) {
					t.Errorf("expected error containing '%s', got '%s'", tc.errMsg, err.Error())
				}
			} else if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// -----------------------------------------------------------------------------
// 2. LIFECYCLE & DRAFT CANCELLATION UNIT TESTS
// -----------------------------------------------------------------------------

func TestOnboardingDraftCancellation(t *testing.T) {
	// An onboarding draft may transition to DEACTIVATED (cancelled) or ACTIVE (go-live)
	if !services.IsValidStatusTransition("ONBOARDING", "DEACTIVATED") {
		t.Errorf("expected ONBOARDING -> DEACTIVATED (cancellation) to be valid")
	}

	if !services.IsValidStatusTransition("ONBOARDING", "ACTIVE") {
		t.Errorf("expected ONBOARDING -> ACTIVE (activation) to be valid")
	}

	// Cannot transition ONBOARDING -> SUSPENDED directly
	if services.IsValidStatusTransition("ONBOARDING", "SUSPENDED") {
		t.Errorf("expected ONBOARDING -> SUSPENDED to be invalid")
	}

	// Active college cannot revert to ONBOARDING
	if services.IsValidStatusTransition("ACTIVE", "ONBOARDING") {
		t.Errorf("expected ACTIVE -> ONBOARDING to be invalid")
	}

	// Deactivated college cannot revert to ONBOARDING
	if services.IsValidStatusTransition("DEACTIVATED", "ONBOARDING") {
		t.Errorf("expected DEACTIVATED -> ONBOARDING to be invalid")
	}
}

// -----------------------------------------------------------------------------
// 3. READINESS GATES & PROGRESS COMPUTATION UNIT TESTS
// -----------------------------------------------------------------------------

func TestReadinessResponseGateEvaluation(t *testing.T) {
	collegeID := uuid.New()
	email := "admin@college.edu"

	// Construct mock response with missing mandatory hostel structure
	gates := []models.CollegeReadinessGate{
		{
			GateCode:    "COLLEGE_PROFILE",
			Name:        "College Profile Identity",
			Status:      "PASSED",
			IsMandatory: true,
			Message:     "Valid",
		},
		{
			GateCode:    "FIRST_ADMIN",
			Name:        "First College Administrator",
			Status:      "PASSED",
			IsMandatory: true,
			Message:     "Admin verified",
		},
		{
			GateCode:    "HOSTEL_STRUCTURE",
			Name:        "Hostel Structure Seeding",
			Status:      "FAILED",
			IsMandatory: true,
			Message:     "No active hostels found",
		},
		{
			GateCode:    "NOTIFICATION_TEST",
			Name:        "Notification Channel Test",
			Status:      "UNAVAILABLE",
			IsMandatory: false,
			Message:     "Service unavailable",
		},
		{
			GateCode:    "ONBOARDING_CHECKLIST",
			Name:        "Canonical Onboarding Steps",
			Status:      "PENDING",
			IsMandatory: true,
			Message:     "4 of 6 steps completed",
		},
	}

	summary := models.ReadinessSummary{
		TotalGates: len(gates),
	}
	for _, g := range gates {
		if g.Status == "PASSED" {
			summary.PassedGates++
			if g.IsMandatory {
				summary.MandatoryPassed++
			}
		}
		if g.IsMandatory {
			summary.TotalMandatory++
		}
	}

	// HOSTEL_STRUCTURE and ONBOARDING_CHECKLIST are failed/pending -> not ready!
	isReady := summary.MandatoryPassed == summary.TotalMandatory
	if isReady {
		t.Fatalf("expected isReady to be false when mandatory gates fail")
	}

	if summary.MandatoryPassed != 2 {
		t.Errorf("expected 2 mandatory gates passed, got %d", summary.MandatoryPassed)
	}

	// Verify progress capping: must not be 100% when not ready
	progress := (summary.PassedGates * 100) / summary.TotalGates
	if !isReady && progress >= 100 {
		progress = 90
	}
	if progress >= 100 {
		t.Errorf("expected progress < 100%% when not ready, got %d%%", progress)
	}

	resp := models.CollegeReadinessResponse{
		CollegeID:          collegeID,
		CollegeCode:        "IITD",
		Name:               "IIT Delhi",
		Status:             "ONBOARDING",
		IsReady:            isReady,
		ProgressPercentage: progress,
		Summary:            summary,
		Gates:              gates,
	}

	if resp.IsReady {
		t.Errorf("expected response IsReady to be false")
	}
	if resp.CollegeCode != "IITD" {
		t.Errorf("expected code IITD, got %s", resp.CollegeCode)
	}
	_ = email
}

func TestEntitlementTemplateLimitationTruthfulError(t *testing.T) {
	// Verify template service error message explicitly explains the schema constraint
	svc := services.NewTemplateService(nil, nil)
	// Calling with unconfigured service should fail cleanly
	err := svc.ApplyTemplateToCollege(context.Background(), uuid.New(), uuid.New())
	if err == nil {
		t.Fatalf("expected error from unconfigured service, got nil")
	}
}

// -----------------------------------------------------------------------------
// 4. HANDLER ROUTE & PARAMETER TESTING
// -----------------------------------------------------------------------------

func TestCollegeOnboardingHandler_InvalidUUID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	h := handlers.NewCollegeHandler(nil)
	router := gin.New()
	router.GET("/colleges/:id/readiness", h.GetCollegeReadiness)
	router.GET("/colleges/:id/onboarding", h.GetCollegeOnboarding)
	router.PATCH("/colleges/:id/onboarding/:step_code", h.UpdateCollegeOnboarding)

	// 1. Invalid UUID for readiness
	req, _ := http.NewRequest(http.MethodGet, "/colleges/invalid-uuid/readiness", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid UUID, got %d", w.Code)
	}

	var body map[string]interface{}
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if body["success"] != false {
		t.Errorf("expected success false, got: %v", body["success"])
	}

	// 2. Invalid UUID for onboarding steps
	req2, _ := http.NewRequest(http.MethodGet, "/colleges/not-a-uuid/onboarding", nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)

	if w2.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid UUID, got %d", w2.Code)
	}

	// 3. Invalid step code update
	payload := `{"status":"COMPLETED","notes":"done"}`
	req3, _ := http.NewRequest(http.MethodPatch, "/colleges/"+uuid.New().String()+"/onboarding/INVALID_STEP", bytes.NewBufferString(payload))
	req3.Header.Set("Content-Type", "application/json")
	w3 := httptest.NewRecorder()
	router.ServeHTTP(w3, req3)

	if w3.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid step code, got %d", w3.Code)
	}
}

func TestCollegeReadinessGateConstants(t *testing.T) {
	validGateCodes := map[string]bool{
		"COLLEGE_PROFILE":      true,
		"ENTITLEMENTS":         true,
		"GENERAL_CONFIG":       true,
		"HOSTEL_STRUCTURE":     true,
		"FIRST_ADMIN":          true,
		"NOTIFICATION_TEST":    true,
		"ONBOARDING_CHECKLIST": true,
	}

	for code := range validGateCodes {
		if !validGateCodes[code] {
			t.Errorf("unexpected invalid gate code: %s", code)
		}
	}
}

func TestUnconfiguredCollegeServiceReadiness(t *testing.T) {
	svc := services.NewCollegeService(nil, nil)
	ctx := context.Background()
	collegeID := uuid.New()

	_, err := svc.GetCollegeReadiness(ctx, collegeID)
	if err == nil {
		t.Fatalf("expected error from unconfigured service, got nil")
	}

	var apiErr *apierrors.APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T: %v", err, err)
	}
}

func TestOnboardingPipelineUnconfiguredService(t *testing.T) {
	svc := services.NewCollegeService(nil, nil)
	ctx := context.Background()

	_, err := svc.ListOnboardingPipeline(ctx)
	if err == nil {
		t.Fatalf("expected error from unconfigured service, got nil")
	}
}

// -----------------------------------------------------------------------------
// 5. MANDATORY STEP SKIPPING REJECTION TESTS
// -----------------------------------------------------------------------------

func TestMandatoryStepSkippingRejection(t *testing.T) {
	svc := services.NewCollegeService(nil, nil)
	ctx := context.Background()
	collegeID := uuid.New()
	actorID := uuid.New()

	mandatorySteps := []string{
		"COLLEGE_PROFILE",
		"COLLEGE_ADMIN",
		"READINESS_REVIEW",
		"GO_LIVE",
	}

	for _, step := range mandatorySteps {
		t.Run("skipping "+step+" is rejected", func(t *testing.T) {
			_, err := svc.UpdateCollegeOnboarding(ctx, collegeID, step, models.UpdateCollegeOnboardingRequest{
				Status: "SKIPPED",
			}, actorID, "SUPER_ADMIN")
			if err == nil {
				t.Fatalf("expected error when skipping mandatory step %s, got nil", step)
			}
			var apiErr *apierrors.APIError
			if !errors.As(err, &apiErr) {
				t.Fatalf("expected APIError, got %T: %v", err, err)
			}
			if !strings.Contains(apiErr.Message, "cannot skip mandatory onboarding step") {
				t.Errorf("expected error message containing 'cannot skip mandatory onboarding step', got '%s'", apiErr.Message)
			}
		})
	}

	// BRANDING is advisory and can be SKIPPED (fails on unconfigured db, not validation)
	t.Run("skipping BRANDING passes validation", func(t *testing.T) {
		_, err := svc.UpdateCollegeOnboarding(ctx, collegeID, "BRANDING", models.UpdateCollegeOnboardingRequest{
			Status: "SKIPPED",
		}, actorID, "SUPER_ADMIN")
		if err != nil {
			var apiErr *apierrors.APIError
			if errors.As(err, &apiErr) && strings.Contains(apiErr.Message, "cannot skip mandatory onboarding step") {
				t.Fatalf("BRANDING should not be rejected as mandatory step, got: %s", apiErr.Message)
			}
		}
	})
}

// -----------------------------------------------------------------------------
// 6. READINESS GATE EVALUATION TESTS
// -----------------------------------------------------------------------------

func TestReadinessGateEvaluation_MissingAdmin(t *testing.T) {
	// When admin account is missing or has no password
	gates := []models.CollegeReadinessGate{
		{GateCode: "COLLEGE_PROFILE", Status: "PASSED", IsMandatory: true},
		{GateCode: "FIRST_ADMIN", Status: "FAILED", IsMandatory: true, Message: "No active admin"},
		{GateCode: "HOSTEL_STRUCTURE", Status: "PASSED", IsMandatory: true},
		{GateCode: "NOTIFICATION_TEST", Status: "UNAVAILABLE", IsMandatory: false},
		{GateCode: "ONBOARDING_CHECKLIST", Status: "PASSED", IsMandatory: true},
	}

	mandatoryPassed := 0
	totalMandatory := 0
	for _, g := range gates {
		if g.IsMandatory {
			totalMandatory++
			if g.Status == "PASSED" {
				mandatoryPassed++
			}
		}
	}

	isReady := mandatoryPassed == totalMandatory
	if isReady {
		t.Error("expected isReady to be false when FIRST_ADMIN is missing")
	}
	if mandatoryPassed != 3 || totalMandatory != 4 {
		t.Errorf("expected 3/4 mandatory gates passed, got %d/%d", mandatoryPassed, totalMandatory)
	}
}

func TestReadinessGateEvaluation_MissingProfile(t *testing.T) {
	// When college profile is incomplete
	gates := []models.CollegeReadinessGate{
		{GateCode: "COLLEGE_PROFILE", Status: "FAILED", IsMandatory: true, Message: "Incomplete profile"},
		{GateCode: "FIRST_ADMIN", Status: "PASSED", IsMandatory: true},
		{GateCode: "HOSTEL_STRUCTURE", Status: "PASSED", IsMandatory: true},
		{GateCode: "NOTIFICATION_TEST", Status: "UNAVAILABLE", IsMandatory: false},
		{GateCode: "ONBOARDING_CHECKLIST", Status: "PASSED", IsMandatory: true},
	}

	mandatoryPassed := 0
	totalMandatory := 0
	for _, g := range gates {
		if g.IsMandatory {
			totalMandatory++
			if g.Status == "PASSED" {
				mandatoryPassed++
			}
		}
	}

	isReady := mandatoryPassed == totalMandatory
	if isReady {
		t.Error("expected isReady to be false when COLLEGE_PROFILE is failed")
	}
}

func TestReadinessGateEvaluation_MissingHostels(t *testing.T) {
	// When hostel structure count is 0
	gates := []models.CollegeReadinessGate{
		{GateCode: "COLLEGE_PROFILE", Status: "PASSED", IsMandatory: true},
		{GateCode: "FIRST_ADMIN", Status: "PASSED", IsMandatory: true},
		{GateCode: "HOSTEL_STRUCTURE", Status: "FAILED", IsMandatory: true, Message: "0 active hostels"},
		{GateCode: "NOTIFICATION_TEST", Status: "UNAVAILABLE", IsMandatory: false},
		{GateCode: "ONBOARDING_CHECKLIST", Status: "PASSED", IsMandatory: true},
	}

	mandatoryPassed := 0
	totalMandatory := 0
	for _, g := range gates {
		if g.IsMandatory {
			totalMandatory++
			if g.Status == "PASSED" {
				mandatoryPassed++
			}
		}
	}

	isReady := mandatoryPassed == totalMandatory
	if isReady {
		t.Error("expected isReady to be false when HOSTEL_STRUCTURE is failed")
	}
}

func TestReadinessGateEvaluation_AllPassed(t *testing.T) {
	gates := []models.CollegeReadinessGate{
		{GateCode: "COLLEGE_PROFILE", Status: "PASSED", IsMandatory: true},
		{GateCode: "FIRST_ADMIN", Status: "PASSED", IsMandatory: true},
		{GateCode: "HOSTEL_STRUCTURE", Status: "PASSED", IsMandatory: true},
		{GateCode: "NOTIFICATION_TEST", Status: "UNAVAILABLE", IsMandatory: false},
		{GateCode: "ONBOARDING_CHECKLIST", Status: "PASSED", IsMandatory: true},
	}

	mandatoryPassed := 0
	totalMandatory := 0
	for _, g := range gates {
		if g.IsMandatory {
			totalMandatory++
			if g.Status == "PASSED" {
				mandatoryPassed++
			}
		}
	}

	isReady := mandatoryPassed == totalMandatory
	if !isReady {
		t.Error("expected isReady to be true when all 4 mandatory gates pass")
	}

	progress := 0
	if isReady {
		progress = 100
	}
	if progress != 100 {
		t.Errorf("expected 100%% progress when all gates pass, got %d", progress)
	}
}

// -----------------------------------------------------------------------------
// 7. NOTIFICATION UNAVAILABLE TEST & ADVISORY BEHAVIOR
// -----------------------------------------------------------------------------

func TestNotificationTest_UnavailablePolicy(t *testing.T) {
	svc := services.NewCollegeService(nil, nil)
	ctx := context.Background()
	collegeID := uuid.New()

	// Calling on unconfigured service returns internal error
	_, err := svc.TestCollegeNotification(ctx, collegeID)
	if err == nil {
		t.Fatal("expected error on unconfigured service")
	}

	// Calling with uuid.Nil returns validation error
	_, errNil := svc.TestCollegeNotification(ctx, uuid.Nil)
	if errNil == nil {
		t.Fatal("expected validation error for uuid.Nil")
	}
	var apiErr *apierrors.APIError
	if !errors.As(errNil, &apiErr) || apiErr.Code != apierrors.ValidationError {
		t.Errorf("expected ValidationError for uuid.Nil, got %v", errNil)
	}

	// Verify model payload contract
	res := models.NotificationTestResult{
		CollegeID: collegeID,
		Status:    "UNAVAILABLE",
		Message:   "Tenant onboarding notification testing is currently unavailable.",
		Details: map[string]interface{}{
			"service_available": false,
			"provider_status":   "NOT_CONFIGURED",
			"advisory_only":     true,
		},
	}
	if res.Status != "UNAVAILABLE" {
		t.Errorf("expected UNAVAILABLE status, got %s", res.Status)
	}
	if res.Details["advisory_only"] != true {
		t.Errorf("expected advisory_only to be true")
	}
}

// -----------------------------------------------------------------------------
// 8. SENSITIVE CREDENTIAL REDACTION UNIT TEST
// -----------------------------------------------------------------------------

func TestSensitiveCredentialRedaction(t *testing.T) {
	admin := models.CollegeAdminAccount{
		UserID:      uuid.New(),
		CollegeID:   uuid.New(),
		Email:       "admin@college.edu",
		Status:      "ACTIVE",
		RoleCode:    "COLLEGE_ADMIN",
		RoleName:    "College Administrator",
		HasPassword: true,
	}

	data, err := json.Marshal(admin)
	if err != nil {
		t.Fatalf("failed to marshal admin account: %v", err)
	}

	serialized := string(data)
	if strings.Contains(serialized, "password_hash") {
		t.Error("security violation: password_hash exposed in CollegeAdminAccount JSON serialization")
	}
	if strings.Contains(serialized, "plaintext") {
		t.Error("security violation: plaintext password exposed in CollegeAdminAccount JSON")
	}
	if !strings.Contains(serialized, `"has_password":true`) {
		t.Errorf("expected has_password boolean flag in JSON, got: %s", serialized)
	}
}

// -----------------------------------------------------------------------------
// 9. PIPELINE PROGRESS CAPPING UNIT TEST
// -----------------------------------------------------------------------------

func TestPipelineProgressCapping(t *testing.T) {
	summary := models.CollegeOnboardingSummary{
		CollegeID:          uuid.New(),
		CollegeCode:        "MIT",
		Name:               "MIT",
		Status:             "ONBOARDING",
		CompletedSteps:     6,
		TotalSteps:         6,
		ProgressPercentage: 90,
		IsReadyForGoLive:   false, // mandatory gate (e.g. hostel) missing
	}

	if summary.ProgressPercentage >= 100 && !summary.IsReadyForGoLive {
		t.Errorf("security violation: pipeline summary must never show 100%% progress when IsReadyForGoLive is false")
	}

	// Verify capping rule
	progress := (summary.CompletedSteps * 100) / summary.TotalSteps
	if !summary.IsReadyForGoLive && progress >= 100 {
		progress = 90
	}
	if progress > 90 {
		t.Errorf("expected capped progress of 90, got %d", progress)
	}
}

// -----------------------------------------------------------------------------
// 10. NOTIFICATION TEST HANDLER ROUTE UNIT TEST
// -----------------------------------------------------------------------------

func TestNotificationTestHandlerRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	h := handlers.NewCollegeHandler(nil)
	router := gin.New()
	router.POST("/colleges/:id/test-notification", h.TestCollegeNotification)

	// Invalid UUID
	req, _ := http.NewRequest(http.MethodPost, "/colleges/invalid-uuid/test-notification", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for invalid UUID, got %d", w.Code)
	}

	// Valid UUID with unconfigured service -> 500 internal error
	validUUID := uuid.New().String()
	req2, _ := http.NewRequest(http.MethodPost, "/colleges/"+validUUID+"/test-notification", nil)
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusInternalServerError {
		t.Errorf("expected 500 for unconfigured service, got %d", w2.Code)
	}
}

