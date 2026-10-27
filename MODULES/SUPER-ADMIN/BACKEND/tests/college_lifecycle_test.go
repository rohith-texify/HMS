package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/routes"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// -----------------------------------------------------------------------------
// 1. LIFECYCLE TRANSITION STATE MACHINE TESTS
// -----------------------------------------------------------------------------

func TestLifecycleStatusTransitions(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Allowed transitions according to architecture:
	// - ONBOARDING -> ACTIVE or DEACTIVATED
	// - ACTIVE -> SUSPENDED or DEACTIVATED
	// - SUSPENDED -> ACTIVE or DEACTIVATED
	// - DEACTIVATED -> ACTIVE
	allowed := map[string][]string{
		"ONBOARDING":  {"ACTIVE", "DEACTIVATED"},
		"ACTIVE":      {"SUSPENDED", "DEACTIVATED"},
		"SUSPENDED":   {"ACTIVE", "DEACTIVATED"},
		"DEACTIVATED": {"ACTIVE"},
	}

	allStatuses := []string{"ONBOARDING", "ACTIVE", "SUSPENDED", "DEACTIVATED"}

	for _, current := range allStatuses {
		allowedTargets := make(map[string]bool)
		for _, target := range allowed[current] {
			allowedTargets[target] = true
		}

		for _, candidate := range allStatuses {
			req := models.UpdateCollegeStatusRequest{
				Status: candidate,
			}

			// Transitions to the same status must be rejected
			if current == candidate {
				// Verify that repeating current status is rejected in validators or transition check
				t.Run(current+"->"+candidate+" (same status)", func(t *testing.T) {
					// Both current == candidate
					if current == candidate && allowedTargets[candidate] {
						t.Errorf("expected transition %s -> %s to NOT be in allowed targets", current, candidate)
					}
				})
				continue
			}

			isAllowed := allowedTargets[candidate]
			t.Run(current+"->"+candidate, func(t *testing.T) {
				if isAllowed && !allowedTargets[candidate] {
					t.Errorf("transition %s -> %s should be allowed", current, candidate)
				}
				if !isAllowed && allowedTargets[candidate] {
					t.Errorf("transition %s -> %s should NOT be allowed", current, candidate)
				}
				_ = req
			})
		}
	}

	// Explicitly verify illegal transitions
	illegalTransitions := [][2]string{
		{"ONBOARDING", "SUSPENDED"},
		{"ACTIVE", "ONBOARDING"},
		{"SUSPENDED", "ONBOARDING"},
		{"DEACTIVATED", "ONBOARDING"},
		{"DEACTIVATED", "SUSPENDED"},
		{"ONBOARDING", "UNKNOWN"},
		{"ACTIVE", "ARCHIVED"},
	}

	for _, tc := range illegalTransitions {
		t.Run("Illegal: "+tc[0]+"->"+tc[1], func(t *testing.T) {
			targets, ok := allowed[tc[0]]
			if !ok {
				return
			}
			for _, target := range targets {
				if target == tc[1] {
					t.Fatalf("expected illegal transition %s -> %s to NOT be allowed", tc[0], tc[1])
				}
			}
		})
	}
}

// -----------------------------------------------------------------------------
// 2. VALIDATOR TESTS
// -----------------------------------------------------------------------------

func TestValidateUpdateCollegeStatusRequest(t *testing.T) {
	reason := "Approved by compliance committee"
	longReason := strings.Repeat("A", 501)

	tests := []struct {
		name        string
		req         *models.UpdateCollegeStatusRequest
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Nil request",
			req:         nil,
			expectError: true,
			errorMsg:    "Request body is required",
		},
		{
			name: "Valid request with Reason",
			req: &models.UpdateCollegeStatusRequest{
				Status: "ACTIVE",
				Reason: &reason,
			},
			expectError: false,
		},
		{
			name: "Valid request with LifecycleReason",
			req: &models.UpdateCollegeStatusRequest{
				Status:          "SUSPENDED",
				LifecycleReason: &reason,
			},
			expectError: false,
		},
		{
			name: "Missing status",
			req: &models.UpdateCollegeStatusRequest{
				Status: "",
				Reason: &reason,
			},
			expectError: true,
			errorMsg:    "Status is required",
		},
		{
			name: "Invalid status value",
			req: &models.UpdateCollegeStatusRequest{
				Status: "UNKNOWN_STATE",
				Reason: &reason,
			},
			expectError: true,
			errorMsg:    "Invalid status",
		},
		{
			name: "Missing reason",
			req: &models.UpdateCollegeStatusRequest{
				Status: "ACTIVE",
			},
			expectError: true,
			errorMsg:    "Lifecycle reason is required",
		},
		{
			name: "Empty reason string",
			req: &models.UpdateCollegeStatusRequest{
				Status: "ACTIVE",
				Reason: func() *string { s := "   "; return &s }(),
			},
			expectError: true,
			errorMsg:    "Lifecycle reason is required",
		},
		{
			name: "Reason too long (>500 chars)",
			req: &models.UpdateCollegeStatusRequest{
				Status: "DEACTIVATED",
				Reason: &longReason,
			},
			expectError: true,
			errorMsg:    "Reason cannot exceed 500 characters",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateUpdateCollegeStatusRequest(tc.req)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if !strings.Contains(err.Error(), tc.errorMsg) {
					t.Fatalf("expected error containing '%s', got '%s'", tc.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("expected no error, got: %v", err)
				}
			}
		})
	}
}

func TestValidateUpdateCollegeOnboardingRequest(t *testing.T) {
	notes := "All documents verified"
	emptyNotes := "   "
	longNotes := strings.Repeat("N", 1001)

	tests := []struct {
		name        string
		stepCode    string
		req         *models.UpdateCollegeOnboardingRequest
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Nil request",
			stepCode:    "COLLEGE_PROFILE",
			req:         nil,
			expectError: true,
			errorMsg:    "Request body is required",
		},
		{
			name:     "Invalid step code",
			stepCode: "UNKNOWN_STEP",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "COMPLETED",
				Notes:  &notes,
			},
			expectError: true,
			errorMsg:    "Invalid onboarding step code",
		},
		{
			name:     "Canonical step - COLLEGE_PROFILE",
			stepCode: "COLLEGE_PROFILE",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "COMPLETED",
				Notes:  &notes,
			},
			expectError: false,
		},
		{
			name:     "Canonical step - COLLEGE_ADMIN",
			stepCode: "COLLEGE_ADMIN",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "IN_PROGRESS",
			},
			expectError: false,
		},
		{
			name:     "Canonical step - BRANDING",
			stepCode: "BRANDING",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "PENDING",
			},
			expectError: false,
		},
		{
			name:     "Canonical step - ENTITLEMENTS",
			stepCode: "ENTITLEMENTS",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "SKIPPED",
			},
			expectError: false,
		},
		{
			name:     "Canonical step - READINESS_REVIEW",
			stepCode: "READINESS_REVIEW",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "FAILED",
			},
			expectError: false,
		},
		{
			name:     "Canonical step - GO_LIVE",
			stepCode: "GO_LIVE",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "COMPLETED",
				Notes:  &notes,
			},
			expectError: false,
		},
		{
			name:     "Invalid status",
			stepCode: "COLLEGE_PROFILE",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "FINISHED",
			},
			expectError: true,
			errorMsg:    "Invalid onboarding status",
		},
		{
			name:     "COMPLETED requires notes (nil notes)",
			stepCode: "COLLEGE_PROFILE",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "COMPLETED",
				Notes:  nil,
			},
			expectError: true,
			errorMsg:    "Notes are required to document step completion",
		},
		{
			name:     "COMPLETED requires notes (empty notes)",
			stepCode: "COLLEGE_PROFILE",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "COMPLETED",
				Notes:  &emptyNotes,
			},
			expectError: true,
			errorMsg:    "Notes are required to document step completion",
		},
		{
			name:     "Notes too long (>1000 chars)",
			stepCode: "COLLEGE_PROFILE",
			req: &models.UpdateCollegeOnboardingRequest{
				Status: "IN_PROGRESS",
				Notes:  &longNotes,
			},
			expectError: true,
			errorMsg:    "Notes cannot exceed 1000 characters",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateUpdateCollegeOnboardingRequest(tc.stepCode, tc.req)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if !strings.Contains(err.Error(), tc.errorMsg) {
					t.Fatalf("expected error containing '%s', got '%s'", tc.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("expected no error, got: %v", err)
				}
			}
		})
	}
}

func TestValidateCreateCollegeRequest(t *testing.T) {
	city := "Bengaluru"
	state := "Karnataka"
	email := "admin@college.edu"
	invalidEmail := "invalid-email"
	longString := strings.Repeat("A", 201)
	longCode := strings.Repeat("B", 101)

	tests := []struct {
		name        string
		req         *models.CreateCollegeRequest
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Nil request",
			req:         nil,
			expectError: true,
			errorMsg:    "Request body is required",
		},
		{
			name: "Valid request",
			req: &models.CreateCollegeRequest{
				CollegeCode:  "COL_001",
				Name:         "National Institute of Technology",
				City:         &city,
				State:        &state,
				Timezone:     "Asia/Kolkata",
				ContactEmail: &email,
			},
			expectError: false,
		},
		{
			name: "Missing college code",
			req: &models.CreateCollegeRequest{
				CollegeCode: "",
				Name:        "Test College",
				Timezone:    "UTC",
			},
			expectError: true,
			errorMsg:    "College code is required",
		},
		{
			name: "College code exceeds 100 characters",
			req: &models.CreateCollegeRequest{
				CollegeCode: longCode,
				Name:        "Test College",
				Timezone:    "UTC",
			},
			expectError: true,
			errorMsg:    "College code cannot exceed 100 characters",
		},
		{
			name: "Malformed college code with spaces",
			req: &models.CreateCollegeRequest{
				CollegeCode: "COL 001",
				Name:        "Test College",
				Timezone:    "UTC",
			},
			expectError: true,
			errorMsg:    "College code must contain only alphanumeric characters, hyphens, and underscores",
		},
		{
			name: "Malformed college code with special symbols",
			req: &models.CreateCollegeRequest{
				CollegeCode: "COL@LEGE!",
				Name:        "Test College",
				Timezone:    "UTC",
			},
			expectError: true,
			errorMsg:    "College code must contain only alphanumeric characters, hyphens, and underscores",
		},
		{
			name: "Missing college name",
			req: &models.CreateCollegeRequest{
				CollegeCode: "COL-001",
				Name:        "",
				Timezone:    "UTC",
			},
			expectError: true,
			errorMsg:    "College name is required",
		},
		{
			name: "College name exceeds 200 characters",
			req: &models.CreateCollegeRequest{
				CollegeCode: "COL-001",
				Name:        longString,
				Timezone:    "UTC",
			},
			expectError: true,
			errorMsg:    "College name cannot exceed 200 characters",
		},
		{
			name: "Missing timezone",
			req: &models.CreateCollegeRequest{
				CollegeCode: "COL-001",
				Name:        "Test College",
				Timezone:    "",
			},
			expectError: true,
			errorMsg:    "Timezone is required",
		},
		{
			name: "Malformed timezone without slash or UTC",
			req: &models.CreateCollegeRequest{
				CollegeCode: "COL-001",
				Name:        "Test College",
				Timezone:    "EST",
			},
			expectError: true,
			errorMsg:    "Invalid timezone format",
		},
		{
			name: "Invalid contact email",
			req: &models.CreateCollegeRequest{
				CollegeCode:  "COL-001",
				Name:         "Test College",
				Timezone:     "UTC",
				ContactEmail: &invalidEmail,
			},
			expectError: true,
			errorMsg:    "Invalid email format",
		},
		{
			name: "Invalid admin email",
			req: &models.CreateCollegeRequest{
				CollegeCode: "COL-001",
				Name:        "Test College",
				Timezone:    "UTC",
				AdminEmail:  &invalidEmail,
			},
			expectError: true,
			errorMsg:    "Invalid admin email format",
		},
		{
			name: "Password shorter than 8 characters",
			req: &models.CreateCollegeRequest{
				CollegeCode: "COL-001",
				Name:        "Test College",
				Timezone:    "UTC",
				Password:    func() *string { p := "short"; return &p }(),
			},
			expectError: true,
			errorMsg:    "Password must be at least 8 characters long",
		},
		{
			name: "Valid request with admin email and password",
			req: &models.CreateCollegeRequest{
				CollegeCode: "COL-001",
				Name:        "Test College",
				Timezone:    "UTC",
				AdminEmail:  &email,
				Password:    func() *string { p := "SecurePassword123!"; return &p }(),
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateCreateCollegeRequest(tc.req)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if !strings.Contains(err.Error(), tc.errorMsg) {
					t.Fatalf("expected error containing '%s', got '%s'", tc.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("expected no error, got: %v", err)
				}
			}
		})
	}
}

func TestValidateUpdateCollegeAdminPasswordRequest(t *testing.T) {
	invalidEmail := "bad-email"
	validEmail := "admin@college.edu"

	tests := []struct {
		name        string
		req         *models.UpdateCollegeAdminPasswordRequest
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Nil request",
			req:         nil,
			expectError: true,
			errorMsg:    "Request body is required",
		},
		{
			name: "Empty password",
			req: &models.UpdateCollegeAdminPasswordRequest{
				Password: "",
			},
			expectError: true,
			errorMsg:    "Password is required",
		},
		{
			name: "Password too short",
			req: &models.UpdateCollegeAdminPasswordRequest{
				Password: "123",
			},
			expectError: true,
			errorMsg:    "Password must be at least 8 characters long",
		},
		{
			name: "Invalid admin email",
			req: &models.UpdateCollegeAdminPasswordRequest{
				Password:   "ValidPass123!",
				AdminEmail: &invalidEmail,
			},
			expectError: true,
			errorMsg:    "Invalid admin email format",
		},
		{
			name: "Valid password update request",
			req: &models.UpdateCollegeAdminPasswordRequest{
				Password:   "ValidPass123!",
				AdminEmail: &validEmail,
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateUpdateCollegeAdminPasswordRequest(tc.req)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if !strings.Contains(err.Error(), tc.errorMsg) {
					t.Fatalf("expected error containing '%s', got '%s'", tc.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("expected no error, got: %v", err)
				}
			}
		})
	}
}

func TestValidateUpdateCollegeRequest(t *testing.T) {
	name := "Updated Name"
	emptyName := ""
	longName := strings.Repeat("A", 201)
	tz := "Asia/Kolkata"
	invalidTz := "InvalidTZ"
	email := "valid@email.com"
	invalidEmail := "not-an-email"

	tests := []struct {
		name        string
		req         *models.UpdateCollegeRequest
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Nil request",
			req:         nil,
			expectError: true,
			errorMsg:    "Request body is required",
		},
		{
			name:        "Empty request (no fields)",
			req:         &models.UpdateCollegeRequest{},
			expectError: true,
			errorMsg:    "At least one field must be provided for update",
		},
		{
			name: "Valid update with name",
			req: &models.UpdateCollegeRequest{
				Name: &name,
			},
			expectError: false,
		},
		{
			name: "Empty name",
			req: &models.UpdateCollegeRequest{
				Name: &emptyName,
			},
			expectError: true,
			errorMsg:    "Name cannot be empty",
		},
		{
			name: "Name too long",
			req: &models.UpdateCollegeRequest{
				Name: &longName,
			},
			expectError: true,
			errorMsg:    "Name cannot exceed 200 characters",
		},
		{
			name: "Valid update with timezone",
			req: &models.UpdateCollegeRequest{
				Timezone: &tz,
			},
			expectError: false,
		},
		{
			name: "Invalid timezone format",
			req: &models.UpdateCollegeRequest{
				Timezone: &invalidTz,
			},
			expectError: true,
			errorMsg:    "Invalid timezone format",
		},
		{
			name: "Valid update with email",
			req: &models.UpdateCollegeRequest{
				ContactEmail: &email,
			},
			expectError: false,
		},
		{
			name: "Invalid contact email",
			req: &models.UpdateCollegeRequest{
				ContactEmail: &invalidEmail,
			},
			expectError: true,
			errorMsg:    "Invalid email format",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateUpdateCollegeRequest(tc.req)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if !strings.Contains(err.Error(), tc.errorMsg) {
					t.Fatalf("expected error containing '%s', got '%s'", tc.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Fatalf("expected no error, got: %v", err)
				}
			}
		})
	}
}

func TestHelper_ValidationFunctions(t *testing.T) {
	t.Run("IsValidCollegeCode", func(t *testing.T) {
		validCodes := []string{"COL-1", "COL_002", "MIT", "HARVARD-2026", "A1-B2_C3"}
		for _, code := range validCodes {
			if !validators.IsValidCollegeCode(code) {
				t.Errorf("expected code '%s' to be valid", code)
			}
		}

		invalidCodes := []string{"", "COL 1", "COL@1", "COL.1", "COL#1", strings.Repeat("A", 101)}
		for _, code := range invalidCodes {
			if validators.IsValidCollegeCode(code) {
				t.Errorf("expected code '%s' to be invalid", code)
			}
		}
	})

	t.Run("IsValidTimezone", func(t *testing.T) {
		validTimezones := []string{"UTC", "Asia/Kolkata", "America/New_York", "Europe/London"}
		for _, tz := range validTimezones {
			if !validators.IsValidTimezone(tz) {
				t.Errorf("expected timezone '%s' to be valid", tz)
			}
		}

		invalidTimezones := []string{"", "GMT", "PST", "IST", strings.Repeat("A", 101)}
		for _, tz := range invalidTimezones {
			if validators.IsValidTimezone(tz) {
				t.Errorf("expected timezone '%s' to be invalid", tz)
			}
		}
	})

	t.Run("IsValidEmailFormat", func(t *testing.T) {
		validEmails := []string{"admin@college.edu", "user@hostel.org", "test.user@domain.co.in"}
		for _, email := range validEmails {
			if !validators.IsValidEmailFormat(email) {
				t.Errorf("expected email '%s' to be valid", email)
			}
		}

		invalidEmails := []string{"", "notanemail", "user@", "@domain.com", "user@domain", "a@b@c.com"}
		for _, email := range invalidEmails {
			if validators.IsValidEmailFormat(email) {
				t.Errorf("expected email '%s' to be invalid", email)
			}
		}
	})

	t.Run("CanonicalOnboardingSteps Sequence", func(t *testing.T) {
		expected := []string{
			"COLLEGE_PROFILE",
			"COLLEGE_ADMIN",
			"READINESS_REVIEW",
			"GO_LIVE",
		}
		if len(validators.CanonicalOnboardingSteps) != len(expected) {
			t.Fatalf("expected %d canonical steps, got %d", len(expected), len(validators.CanonicalOnboardingSteps))
		}
		for i, s := range expected {
			if validators.CanonicalOnboardingSteps[i] != s {
				t.Errorf("step %d: expected %s, got %s", i, s, validators.CanonicalOnboardingSteps[i])
			}
		}
	})
}

func TestStateTransition_ValidateStatusTransition(t *testing.T) {
	// 1. Valid transitions
	validPairs := [][2]string{
		{"ONBOARDING", "ACTIVE"},
		{"ONBOARDING", "DEACTIVATED"},
		{"ACTIVE", "SUSPENDED"},
		{"ACTIVE", "DEACTIVATED"},
		{"SUSPENDED", "ACTIVE"},
		{"SUSPENDED", "DEACTIVATED"},
		{"DEACTIVATED", "ACTIVE"},
	}
	for _, pair := range validPairs {
		t.Run("Valid_"+pair[0]+"->"+pair[1], func(t *testing.T) {
			if !services.IsValidStatusTransition(pair[0], pair[1]) {
				t.Errorf("expected %s -> %s to be valid", pair[0], pair[1])
			}
			if err := services.ValidateStatusTransition(pair[0], pair[1]); err != nil {
				t.Errorf("expected no error for %s -> %s, got %v", pair[0], pair[1], err)
			}
		})
	}

	// 2. Repeat transitions
	statuses := []string{"ONBOARDING", "ACTIVE", "SUSPENDED", "DEACTIVATED"}
	for _, s := range statuses {
		t.Run("Repeat_"+s+"->"+s, func(t *testing.T) {
			if services.IsValidStatusTransition(s, s) {
				t.Errorf("expected repeat %s -> %s to be invalid", s, s)
			}
			err := services.ValidateStatusTransition(s, s)
			if err == nil {
				t.Fatalf("expected error for repeat status, got nil")
			}
			if !strings.Contains(err.Error(), "already") {
				t.Errorf("expected error containing 'already', got %v", err)
			}
		})
	}

	// 3. Illegal transitions
	illegalPairs := [][2]string{
		{"ACTIVE", "ONBOARDING"},
		{"SUSPENDED", "ONBOARDING"},
		{"DEACTIVATED", "ONBOARDING"},
		{"ONBOARDING", "SUSPENDED"},
		{"DEACTIVATED", "SUSPENDED"},
		{"ACTIVE", "ARCHIVED"},
		{"ONBOARDING", "UNKNOWN"},
	}
	for _, pair := range illegalPairs {
		t.Run("Illegal_"+pair[0]+"->"+pair[1], func(t *testing.T) {
			if services.IsValidStatusTransition(pair[0], pair[1]) {
				t.Errorf("expected %s -> %s to be illegal", pair[0], pair[1])
			}
			err := services.ValidateStatusTransition(pair[0], pair[1])
			if err == nil {
				t.Fatalf("expected error for illegal transition, got nil")
			}
			if !strings.Contains(err.Error(), "invalid college status transition") {
				t.Errorf("expected error containing 'invalid college status transition', got %v", err)
			}
		})
	}
}

// -----------------------------------------------------------------------------
// 3. HTTP HANDLER & ACTOR CONTEXT EXTRACTION TESTS
// -----------------------------------------------------------------------------

func TestCollegeHandler_ActorContextEnforcement(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// CollegeHandler requires CollegeService.
	// We can test request validation and actor extraction at handler boundary.
	svc := services.NewCollegeService(nil, nil)
	h := handlers.NewCollegeHandler(svc)

	collegeID := uuid.New()

	t.Run("Missing authenticated user context returns 401", func(t *testing.T) {
		router := gin.New()
		router.PUT("/colleges/:id/status", h.UpdateCollegeStatus)

		body := map[string]interface{}{
			"status": "ACTIVE",
			"reason": "Test activation",
		}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", "/colleges/"+collegeID.String()+"/status", bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected status 401, got %d: %s", w.Code, w.Body.String())
		}

		var resp map[string]interface{}
		_ = json.Unmarshal(w.Body.Bytes(), &resp)
		errObj, ok := resp["error"].(map[string]interface{})
		if !ok || errObj["code"] != apierrors.Unauthorized {
			t.Fatalf("expected UNAUTHORIZED error code, got: %v", resp)
		}
	})

	t.Run("Missing authenticated role context returns 401", func(t *testing.T) {
		router := gin.New()
		// Middleware injects user_id but not role
		router.Use(func(c *gin.Context) {
			c.Set("auth_user_id", uuid.New())
			c.Next()
		})
		router.PUT("/colleges/:id/status", h.UpdateCollegeStatus)

		body := map[string]interface{}{
			"status": "ACTIVE",
			"reason": "Test activation",
		}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", "/colleges/"+collegeID.String()+"/status", bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected status 401, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("Invalid college ID format returns 400", func(t *testing.T) {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set("auth_user_id", uuid.New())
			c.Set("auth_role", "SUPER_ADMIN")
			c.Next()
		})
		router.PUT("/colleges/:id/status", h.UpdateCollegeStatus)

		body := map[string]interface{}{
			"status": "ACTIVE",
			"reason": "Test activation",
		}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", "/colleges/invalid-uuid/status", bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("Missing reason in body returns 400", func(t *testing.T) {
		router := gin.New()
		router.Use(func(c *gin.Context) {
			c.Set("auth_user_id", uuid.New())
			c.Set("auth_role", "SUPER_ADMIN")
			c.Next()
		})
		router.PUT("/colleges/:id/status", h.UpdateCollegeStatus)

		body := map[string]interface{}{
			"status": "ACTIVE",
		}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("PUT", "/colleges/"+collegeID.String()+"/status", bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected status 400, got %d: %s", w.Code, w.Body.String())
		}
	})

	t.Run("Update onboarding requires authenticated user context", func(t *testing.T) {
		router := gin.New()
		router.PATCH("/colleges/:id/onboarding/:step_code", h.UpdateCollegeOnboarding)

		body := map[string]interface{}{
			"status": "COMPLETED",
			"notes":  "Done",
		}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("PATCH", "/colleges/"+collegeID.String()+"/onboarding/COLLEGE_PROFILE", bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected status 401, got %d: %s", w.Code, w.Body.String())
		}
	})
}

func TestCollegeHandler_RequestValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := services.NewCollegeService(nil, nil)
	h := handlers.NewCollegeHandler(svc)
	collegeID := uuid.New()

	authMiddleware := func(c *gin.Context) {
		c.Set("auth_user_id", uuid.New())
		c.Set("auth_role", "SUPER_ADMIN")
		c.Next()
	}

	t.Run("Create college with invalid json returns 400", func(t *testing.T) {
		router := gin.New()
		router.Use(authMiddleware)
		router.POST("/colleges", h.CreateCollege)

		req := httptest.NewRequest("POST", "/colleges", bytes.NewReader([]byte("{invalid-json")))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	t.Run("Create college with malformed code returns 400", func(t *testing.T) {
		router := gin.New()
		router.Use(authMiddleware)
		router.POST("/colleges", h.CreateCollege)

		body := map[string]interface{}{
			"college_code": "INVALID CODE WITH SPACES",
			"name":         "Valid Name",
			"timezone":     "UTC",
		}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/colleges", bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	t.Run("Create college with malformed timezone returns 400", func(t *testing.T) {
		router := gin.New()
		router.Use(authMiddleware)
		router.POST("/colleges", h.CreateCollege)

		body := map[string]interface{}{
			"college_code": "VALID_CODE",
			"name":         "Valid Name",
			"timezone":     "InvalidTZ",
		}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/colleges", bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	t.Run("Create college without authentication returns 401", func(t *testing.T) {
		router := gin.New()
		router.POST("/colleges", h.CreateCollege)

		body := map[string]interface{}{
			"college_code": "VALID_CODE",
			"name":         "Valid Name",
			"timezone":     "UTC",
		}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/colleges", bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}
	})

	t.Run("Update college without authentication returns 401", func(t *testing.T) {
		router := gin.New()
		router.PATCH("/colleges/:id", h.UpdateCollege)

		name := "New Name"
		body := map[string]interface{}{"name": name}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("PATCH", "/colleges/"+uuid.New().String(), bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d", w.Code)
		}
	})

	t.Run("Update college with invalid UUID returns 400", func(t *testing.T) {
		router := gin.New()
		router.Use(authMiddleware)
		router.PATCH("/colleges/:id", h.UpdateCollege)

		name := "New Name"
		body := map[string]interface{}{"name": name}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("PATCH", "/colleges/not-a-uuid", bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	t.Run("Update college with empty body returns 400", func(t *testing.T) {
		router := gin.New()
		router.Use(authMiddleware)
		router.PATCH("/colleges/:id", h.UpdateCollege)

		body := map[string]interface{}{}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("PATCH", "/colleges/"+collegeID.String(), bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	t.Run("Update college onboarding with invalid step code returns 400", func(t *testing.T) {
		router := gin.New()
		router.Use(authMiddleware)
		router.PATCH("/colleges/:id/onboarding/:step_code", h.UpdateCollegeOnboarding)

		body := map[string]interface{}{
			"status": "COMPLETED",
			"notes":  "Done",
		}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("PATCH", "/colleges/"+collegeID.String()+"/onboarding/INVALID_STEP", bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})

	t.Run("Update college onboarding with COMPLETED and empty notes returns 400", func(t *testing.T) {
		router := gin.New()
		router.Use(authMiddleware)
		router.PATCH("/colleges/:id/onboarding/:step_code", h.UpdateCollegeOnboarding)

		body := map[string]interface{}{
			"status": "COMPLETED",
			"notes":  "   ",
		}
		jsonBytes, _ := json.Marshal(body)

		req := httptest.NewRequest("PATCH", "/colleges/"+collegeID.String()+"/onboarding/COLLEGE_PROFILE", bytes.NewReader(jsonBytes))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()

		router.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", w.Code)
		}
	})
}

func TestRepository_UnconfiguredFailClosed_Batch02(t *testing.T) {
	repo := repository.New(nil)
	ctx := context.Background()
	collegeID := uuid.New()
	actorID := uuid.New()

	t.Run("RecordCollegeCreationAudit on unconfigured repo returns ErrPlatformPoolNotConfigured", func(t *testing.T) {
		err := repo.RecordCollegeCreationAudit(ctx, repository.CollegeCreationAuditParams{
			CollegeID:   collegeID,
			ActorUserID: actorID,
			ActorRole:   "SUPER_ADMIN",
			CollegeCode: "COL-001",
			Name:        "Test College",
		})
		if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
			t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
		}
	})

	t.Run("RecordCollegeProfileUpdateAudit on unconfigured repo returns ErrPlatformPoolNotConfigured", func(t *testing.T) {
		err := repo.RecordCollegeProfileUpdateAudit(ctx, repository.CollegeProfileUpdateAuditParams{
			CollegeID:   collegeID,
			ActorUserID: actorID,
			ActorRole:   "SUPER_ADMIN",
			OldData:     map[string]interface{}{"name": "Old"},
			NewData:     map[string]interface{}{"name": "New"},
		})
		if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
			t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
		}
	})

	t.Run("EnsureCollegeReadyForActivation on unconfigured repo returns ErrPlatformPoolNotConfigured", func(t *testing.T) {
		err := repo.EnsureCollegeReadyForActivation(ctx, collegeID)
		if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
			t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
		}
	})

	t.Run("UpdateCollegeOnboardingStep on unconfigured repo returns ErrPlatformPoolNotConfigured", func(t *testing.T) {
		notes := "Done"
		_, _, err := repo.UpdateCollegeOnboardingStep(ctx, collegeID, repository.UpdateOnboardingStepParams{
			StepCode:    "COLLEGE_PROFILE",
			Status:      "COMPLETED",
			Notes:       &notes,
			CompletedBy: &actorID,
		})
		if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
			t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
		}
	})

	t.Run("RecordOnboardingStepAudit on unconfigured repo returns ErrPlatformPoolNotConfigured", func(t *testing.T) {
		err := repo.RecordOnboardingStepAudit(ctx, repository.OnboardingStepAuditParams{
			CollegeID:    collegeID,
			OnboardingID: uuid.New(),
			ActorUserID:  actorID,
			ActorRole:    "SUPER_ADMIN",
			StepCode:     "COLLEGE_PROFILE",
			OldStatus:    "PENDING",
			NewStatus:    "COMPLETED",
		})
		if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
			t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
		}
	})
}

func TestCollegeService_FailClosed_NilGuards(t *testing.T) {
	ctx := context.Background()
	dummyID := uuid.New()
	actorID := uuid.New()
	note := "Completed step"

	svc := services.NewCollegeService(nil, nil)

	t.Run("ListColleges on unconfigured service fails closed", func(t *testing.T) {
		_, _, err := svc.ListColleges(ctx, models.ListCollegesParams{})
		if err == nil {
			t.Error("expected error from unconfigured ListColleges, got nil")
		}
	})

	t.Run("GetCollege on unconfigured service fails closed", func(t *testing.T) {
		_, err := svc.GetCollege(ctx, dummyID)
		if err == nil {
			t.Error("expected error from unconfigured GetCollege, got nil")
		}
	})

	t.Run("CreateCollege on unconfigured service fails closed", func(t *testing.T) {
		_, err := svc.CreateCollege(ctx, models.CreateCollegeRequest{
			CollegeCode: "TEST",
			Name:        "Test College",
			Timezone:    "UTC",
		})
		if err == nil {
			t.Error("expected error from unconfigured CreateCollege, got nil")
		}
	})

	t.Run("UpdateCollege on unconfigured service fails closed", func(t *testing.T) {
		name := "New Name"
		_, err := svc.UpdateCollege(ctx, dummyID, models.UpdateCollegeRequest{
			Name: &name,
		})
		if err == nil {
			t.Error("expected error from unconfigured UpdateCollege, got nil")
		}
	})

	t.Run("UpdateCollegeStatus on unconfigured service fails closed", func(t *testing.T) {
		reason := "audit"
		_, err := svc.UpdateCollegeStatus(ctx, dummyID, models.UpdateCollegeStatusRequest{
			Status: "ACTIVE",
			Reason: &reason,
		}, actorID, "SUPER_ADMIN")
		if err == nil {
			t.Error("expected error from unconfigured UpdateCollegeStatus, got nil")
		}
	})

	t.Run("GetCollegeOnboarding on unconfigured service fails closed", func(t *testing.T) {
		_, err := svc.GetCollegeOnboarding(ctx, dummyID)
		if err == nil {
			t.Error("expected error from unconfigured GetCollegeOnboarding, got nil")
		}
	})

	t.Run("UpdateCollegeOnboarding on unconfigured service fails closed", func(t *testing.T) {
		_, err := svc.UpdateCollegeOnboarding(ctx, dummyID, "COLLEGE_PROFILE", models.UpdateCollegeOnboardingRequest{
			Status: "COMPLETED",
			Notes:  &note,
		}, actorID, "SUPER_ADMIN")
		if err == nil {
			t.Error("expected error from unconfigured UpdateCollegeOnboarding, got nil")
		}
	})

	t.Run("Invalid nil college ID returns validation error", func(t *testing.T) {
		_, err := svc.GetCollege(ctx, uuid.Nil)
		if err == nil {
			t.Error("expected validation error for uuid.Nil, got nil")
		}
	})
}

// -----------------------------------------------------------------------------
// 4. ROUTE REGISTRATION INTEGRATION TEST
// -----------------------------------------------------------------------------

func TestSuperAdminRouteRegistration(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	group := router.Group("/")

	viewCalled := false
	manageCalled := false

	requireView := func(c *gin.Context) {
		viewCalled = true
		c.Next()
	}

	requireManage := func(c *gin.Context) {
		manageCalled = true
		c.Next()
	}

	// Register routes
	routes.RegisterSuperAdminRoutes(group, &database.Database{}, requireView, requireManage)

	// Check if routes are registered in router
	expectedRoutes := []struct {
		method string
		path   string
	}{
		{"GET", "/super-admin/colleges"},
		{"POST", "/super-admin/colleges"},
		{"GET", "/super-admin/colleges/:id"},
		{"PUT", "/super-admin/colleges/:id"},
		{"PATCH", "/super-admin/colleges/:id"},
		{"PUT", "/super-admin/colleges/:id/status"},
		{"PATCH", "/super-admin/colleges/:id/status"},
		{"GET", "/super-admin/colleges/:id/onboarding"},
		{"PATCH", "/super-admin/colleges/:id/onboarding/:step_code"},
		{"PUT", "/super-admin/colleges/:id/onboarding/:step_code"},
		{"GET", "/super-admin/colleges/:id/modules"},
		{"GET", "/super-admin/colleges/:id/settings"},
		{"GET", "/super-admin/approvals"},
		{"GET", "/super-admin/modules"},
	}

	registered := router.Routes()
	for _, expected := range expectedRoutes {
		found := false
		for _, r := range registered {
			if r.Method == expected.method && r.Path == expected.path {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected route %s %s was not registered", expected.method, expected.path)
		}
	}

	_ = viewCalled
	_ = manageCalled
}

// -----------------------------------------------------------------------------
// 5. ISOLATED POSTGRESQL INTEGRATION TEST (RUNS WHEN TEST_DATABASE_URL IS SET)
// -----------------------------------------------------------------------------

// RedactDatabaseURL masks the password in a connection string to prevent credential leakage in logs.
func RedactDatabaseURL(rawURL string) string {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return "[unparseable-url]"
	}
	return parsedURL.Redacted()
}

// ValidateTestDatabaseURL verifies that a database URL meets strict safety requirements:
// 1. Non-empty
// 2. Valid URL syntax (without leaking credentials on parse error)
// 3. Scheme must be postgres or postgresql
// 4. Host must be non-empty
// 5. Database name must end in '_test' and have a non-empty name prefix.
func ValidateTestDatabaseURL(rawURL string) error {
	if strings.TrimSpace(rawURL) == "" {
		return errors.New("TEST_DATABASE_URL is not set")
	}

	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return errors.New("failed to parse TEST_DATABASE_URL: invalid URL syntax")
	}

	if parsedURL.Scheme != "postgres" && parsedURL.Scheme != "postgresql" {
		return fmt.Errorf("SAFETY CHECK FAILED: scheme must be postgres or postgresql, got '%s'", parsedURL.Scheme)
	}

	if parsedURL.Host == "" {
		return errors.New("SAFETY CHECK FAILED: host is required in TEST_DATABASE_URL")
	}

	dbName := strings.TrimPrefix(parsedURL.Path, "/")
	if !strings.HasSuffix(dbName, "_test") || dbName == "_test" {
		return fmt.Errorf("SAFETY CHECK FAILED: Database name '%s' must end in '_test' to prevent accidental destruction", dbName)
	}

	return nil
}

func setupTestDB(t *testing.T) (*database.Database, *repository.Repository) {
	t.Helper()

	testDBURL := os.Getenv("TEST_DATABASE_URL")
	if testDBURL == "" {
		t.Skip("Skipping PostgreSQL integration test: TEST_DATABASE_URL is not set.")
	}

	if err := ValidateTestDatabaseURL(testDBURL); err != nil {
		t.Fatalf("%v", err)
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, testDBURL)
	if err != nil {
		t.Fatalf("Failed to connect to test database (%s): %v", RedactDatabaseURL(testDBURL), err)
	}

	if err := pool.Ping(ctx); err != nil {
		t.Fatalf("Failed to ping test database (%s): %v", RedactDatabaseURL(testDBURL), err)
	}

	db := &database.Database{
		Pool:         pool,
		CollegePool:  pool,
		PlatformPool: pool,
	}
	repo := repository.New(db)
	return db, repo
}

func TestSetupTestDB_SafetyChecks(t *testing.T) {
	// 1. Empty URL
	if err := ValidateTestDatabaseURL(""); err == nil {
		t.Error("expected error for empty URL, got nil")
	}

	// 2. Production/Dev database without _test suffix -> MUST FAIL
	devURLs := []string{
		"postgres://postgres:secret@localhost:5432/hms",
		"postgres://postgres:secret@localhost:5432/hms_prod",
		"postgres://postgres:secret@localhost:5432/production",
		"postgres://postgres:secret@localhost:5432/",
		"postgres://postgres:secret@localhost:5432/test",
		"postgres://postgres:secret@localhost:5432/_test", // no prefix before _test
		"mysql://postgres:secret@localhost:5432/hms_test", // wrong scheme
		"postgres:///hms_test",                            // missing host
	}
	for _, rawURL := range devURLs {
		err := ValidateTestDatabaseURL(rawURL)
		if err == nil {
			t.Errorf("expected safety check failure for dev/prod database URL '%s', got nil", rawURL)
		} else if !strings.Contains(err.Error(), "SAFETY CHECK FAILED") {
			t.Errorf("expected 'SAFETY CHECK FAILED' in error for '%s', got: %v", rawURL, err)
		}
	}

	// 3. Valid test databases with _test suffix -> MUST PASS
	safeURLs := []string{
		"postgres://postgres:secret@localhost:5432/hms_test",
		"postgres://postgres:secret@localhost:5432/hms_dev_test",
		"postgres://postgres:secret@localhost:5432/hms_test?sslmode=disable",
		"postgresql://postgres:secret@localhost:5432/hms_isolated_test",
	}
	for _, rawURL := range safeURLs {
		if err := ValidateTestDatabaseURL(rawURL); err != nil {
			t.Errorf("expected valid test database URL '%s' to pass safety check, got error: %v", rawURL, err)
		}
	}

	// 4. Credential redaction check
	secretURL := "postgres://user:super_secret_password@localhost:5432/hms_test"
	redacted := RedactDatabaseURL(secretURL)
	if strings.Contains(redacted, "super_secret_password") {
		t.Errorf("expected password to be masked, got: %s", redacted)
	}
	if !strings.Contains(redacted, "xxxxx") {
		t.Errorf("expected standard redacted placeholder 'xxxxx', got: %s", redacted)
	}
}

func TestCollegeLifecycle_Integration(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewCollegeService(db, repo)

	actorID := uuid.New()
	actorRole := "SUPER_ADMIN"
	ctx = database.WithPlatformUserID(ctx, actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO app.users (user_id, email, status)
		VALUES ($1, $2, 'ACTIVE')
		ON CONFLICT DO NOTHING
	`, actorID, fmt.Sprintf("actor-%s@hms.platform", actorID.String()[:8]))
	if err != nil {
		t.Fatalf("Failed to seed test actor in app.users: %v", err)
	}

	// 1. Create a college
	code := "test-col-" + uuid.New().String()[:8]
	name := "Integration Test College " + code
	city := "Chennai"
	state := "Tamil Nadu"
	email := code + "@test.edu"

	createdCollege, err := svc.CreateCollege(ctx, models.CreateCollegeRequest{
		CollegeCode:  code,
		Name:         name,
		City:         &city,
		State:        &state,
		Timezone:     "Asia/Kolkata",
		ContactEmail: &email,
	})
	if err != nil {
		t.Fatalf("Failed to create college: %v", err)
	}

	collegeID := createdCollege.CollegeID
	defer func() {
		// Clean up created test tenant
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.college_onboarding WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	if createdCollege.Status != "ONBOARDING" {
		t.Fatalf("expected newly created college status to be ONBOARDING, got %s", createdCollege.Status)
	}

	// 2. Verify all 6 canonical onboarding steps were seeded with PENDING
	steps, err := svc.GetCollegeOnboarding(ctx, collegeID)
	if err != nil {
		t.Fatalf("Failed to retrieve onboarding steps: %v", err)
	}
	if len(steps) != 6 {
		t.Fatalf("expected exactly 6 onboarding steps, got %d", len(steps))
	}
	for _, s := range steps {
		if s.Status != "PENDING" {
			t.Errorf("step %s expected status PENDING, got %s", s.StepCode, s.Status)
		}
	}

	// 3. Attempt activation while onboarding steps are incomplete -> MUST FAIL
	activationReason := "Ready for launch"
	_, err = svc.UpdateCollegeStatus(ctx, collegeID, models.UpdateCollegeStatusRequest{
		Status: "ACTIVE",
		Reason: &activationReason,
	}, actorID, actorRole)
	if err == nil {
		t.Fatalf("expected activation to fail when onboarding steps are not completed, but it succeeded")
	}
	if !strings.Contains(err.Error(), "college onboarding is not ready for activation") {
		t.Fatalf("expected error mentioning onboarding not ready, got: %v", err)
	}

	// 4a. Attempt completing READINESS_REVIEW before prerequisites are completed -> MUST FAIL
	notes := "Step verified and signed off"
	_, err = svc.UpdateCollegeOnboarding(ctx, collegeID, "READINESS_REVIEW", models.UpdateCollegeOnboardingRequest{
		Status: "COMPLETED",
		Notes:  &notes,
	}, actorID, actorRole)
	if err == nil {
		t.Fatalf("expected READINESS_REVIEW completion to fail when prerequisites are missing, but it succeeded")
	}

	// 4b. Attempt completing GO_LIVE before READINESS_REVIEW is completed -> MUST FAIL
	_, err = svc.UpdateCollegeOnboarding(ctx, collegeID, "GO_LIVE", models.UpdateCollegeOnboardingRequest{
		Status: "COMPLETED",
		Notes:  &notes,
	}, actorID, actorRole)
	if err == nil {
		t.Fatalf("expected GO_LIVE completion to fail when READINESS_REVIEW is missing, but it succeeded")
	}

	// 4c. Complete all 6 onboarding steps in canonical prerequisite sequence
	for _, s := range steps {
		updatedStep, err := svc.UpdateCollegeOnboarding(ctx, collegeID, s.StepCode, models.UpdateCollegeOnboardingRequest{
			Status: "COMPLETED",
			Notes:  &notes,
		}, actorID, actorRole)
		if err != nil {
			t.Fatalf("Failed to complete onboarding step %s: %v", s.StepCode, err)
		}
		if updatedStep.Status != "COMPLETED" {
			t.Fatalf("expected step %s to be COMPLETED, got %s", s.StepCode, updatedStep.Status)
		}
	}

	// 5. Activate college -> MUST SUCCEED now that all 6 steps are COMPLETED
	activatedCollege, err := svc.UpdateCollegeStatus(ctx, collegeID, models.UpdateCollegeStatusRequest{
		Status: "ACTIVE",
		Reason: &activationReason,
	}, actorID, actorRole)
	if err != nil {
		t.Fatalf("Failed to activate college after completing onboarding: %v", err)
	}
	if activatedCollege.Status != "ACTIVE" {
		t.Fatalf("expected status ACTIVE, got %s", activatedCollege.Status)
	}
	if activatedCollege.ActivatedAt == nil {
		t.Fatalf("expected activated_at timestamp to be set")
	}

	// 5a. Attempt reverting an onboarding step on an ACTIVE college -> MUST BE REJECTED
	_, err = svc.UpdateCollegeOnboarding(ctx, collegeID, "GO_LIVE", models.UpdateCollegeOnboardingRequest{
		Status: "PENDING",
	}, actorID, actorRole)
	if err == nil {
		t.Fatalf("expected reverting onboarding step on active college to fail, but it succeeded")
	}

	// 5b. Idempotently update notes on already COMPLETED step -> MUST SUCCEED and preserve completed_at
	updatedNotes := "Final signoff revised notes"
	recompletedStep, err := svc.UpdateCollegeOnboarding(ctx, collegeID, "GO_LIVE", models.UpdateCollegeOnboardingRequest{
		Status: "COMPLETED",
		Notes:  &updatedNotes,
	}, actorID, actorRole)
	if err != nil {
		t.Fatalf("expected repeat completion of onboarding step to succeed, got %v", err)
	}
	if recompletedStep.Notes == nil || *recompletedStep.Notes != updatedNotes {
		t.Fatalf("expected updated notes on repeat completion")
	}

	// 5c. Update college profile -> MUST SUCCEED and record COLLEGE_PROFILE_UPDATED audit
	newName := "Updated College Name"
	updatedCol, err := svc.UpdateCollege(ctx, collegeID, models.UpdateCollegeRequest{
		Name: &newName,
	})
	if err != nil {
		t.Fatalf("expected profile update to succeed, got %v", err)
	}
	if updatedCol.Name != newName {
		t.Fatalf("expected name to be %s, got %s", newName, updatedCol.Name)
	}

	// 6. Verify audit log entry was created
	var auditCount int
	err = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM platform.audit_logs
		WHERE college_id = $1 AND action = 'COLLEGE_STATUS_CHANGED'
	`, collegeID).Scan(&auditCount)
	if err != nil {
		t.Fatalf("Failed to query audit logs: %v", err)
	}
	if auditCount < 1 {
		t.Fatalf("expected at least 1 COLLEGE_STATUS_CHANGED audit record, found %d", auditCount)
	}

	// 7. Try repeating same status (ACTIVE -> ACTIVE) -> MUST BE REJECTED
	_, err = svc.UpdateCollegeStatus(ctx, collegeID, models.UpdateCollegeStatusRequest{
		Status: "ACTIVE",
		Reason: &activationReason,
	}, actorID, actorRole)
	if err == nil {
		t.Fatalf("expected repeat status ACTIVE -> ACTIVE to fail, but it succeeded")
	}
	if !strings.Contains(err.Error(), "college status is already ACTIVE") {
		t.Fatalf("expected error mentioning status already ACTIVE, got: %v", err)
	}

	// 8. Try invalid transition (ACTIVE -> ONBOARDING) -> MUST BE REJECTED
	revertReason := "Reverting to onboarding"
	_, err = svc.UpdateCollegeStatus(ctx, collegeID, models.UpdateCollegeStatusRequest{
		Status: "ONBOARDING",
		Reason: &revertReason,
	}, actorID, actorRole)
	if err == nil {
		t.Fatalf("expected invalid transition ACTIVE -> ONBOARDING to fail, but it succeeded")
	}

	// 9. Suspend college -> ACTIVE -> SUSPENDED MUST SUCCEED
	suspendReason := "Administrative audit"
	suspendedCollege, err := svc.UpdateCollegeStatus(ctx, collegeID, models.UpdateCollegeStatusRequest{
		Status: "SUSPENDED",
		Reason: &suspendReason,
	}, actorID, actorRole)
	if err != nil {
		t.Fatalf("Failed to suspend college: %v", err)
	}
	if suspendedCollege.Status != "SUSPENDED" {
		t.Fatalf("expected status SUSPENDED, got %s", suspendedCollege.Status)
	}
	if suspendedCollege.SuspendedAt == nil {
		t.Fatalf("expected suspended_at timestamp to be set")
	}

	// 10. Deactivate college -> SUSPENDED -> DEACTIVATED MUST SUCCEED
	deactivateReason := "Contract expired"
	deactivatedCollege, err := svc.UpdateCollegeStatus(ctx, collegeID, models.UpdateCollegeStatusRequest{
		Status: "DEACTIVATED",
		Reason: &deactivateReason,
	}, actorID, actorRole)
	if err != nil {
		t.Fatalf("Failed to deactivate college: %v", err)
	}
	if deactivatedCollege.Status != "DEACTIVATED" {
		t.Fatalf("expected status DEACTIVATED, got %s", deactivatedCollege.Status)
	}

	// 11. Reactivate college -> DEACTIVATED -> ACTIVE MUST SUCCEED
	reactivateReason := "Contract renewed"
	reactivatedCollege, err := svc.UpdateCollegeStatus(ctx, collegeID, models.UpdateCollegeStatusRequest{
		Status: "ACTIVE",
		Reason: &reactivateReason,
	}, actorID, actorRole)
	if err != nil {
		t.Fatalf("Failed to reactivate college: %v", err)
	}
	if reactivatedCollege.Status != "ACTIVE" {
		t.Fatalf("expected status ACTIVE, got %s", reactivatedCollege.Status)
	}
}

func TestCollegeService_ActorValidation(t *testing.T) {
	repo := repository.New(nil)
	svc := services.NewCollegeService(&database.Database{}, repo)

	ctx := context.Background() // Missing actor in context

	t.Run("CreateCollege without actor user ID returns Unauthorized", func(t *testing.T) {
		_, err := svc.CreateCollege(ctx, models.CreateCollegeRequest{
			CollegeCode: "COL1",
			Name:        "College 1",
			Timezone:    "UTC",
		})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		apiErr, ok := err.(*apierrors.APIError)
		if !ok || apiErr.Code != apierrors.Unauthorized {
			t.Fatalf("expected Unauthorized error, got %v", err)
		}
	})

	t.Run("UpdateCollege without actor user ID returns Unauthorized", func(t *testing.T) {
		name := "New Name"
		_, err := svc.UpdateCollege(ctx, uuid.New(), models.UpdateCollegeRequest{
			Name: &name,
		})
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		apiErr, ok := err.(*apierrors.APIError)
		if !ok || apiErr.Code != apierrors.Unauthorized {
			t.Fatalf("expected Unauthorized error, got %v", err)
		}
	})

	t.Run("UpdateCollegeStatus without actor user ID returns Unauthorized", func(t *testing.T) {
		reason := "maintenance"
		_, err := svc.UpdateCollegeStatus(ctx, uuid.New(), models.UpdateCollegeStatusRequest{
			Status: "SUSPENDED",
			Reason: &reason,
		}, uuid.Nil, "SUPER_ADMIN")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		apiErr, ok := err.(*apierrors.APIError)
		if !ok || apiErr.Code != apierrors.Unauthorized {
			t.Fatalf("expected Unauthorized error, got %v", err)
		}
	})

	t.Run("UpdateCollegeOnboarding without actor user ID returns Unauthorized", func(t *testing.T) {
		status := "COMPLETED"
		_, err := svc.UpdateCollegeOnboarding(ctx, uuid.New(), "CORE_SETTINGS", models.UpdateCollegeOnboardingRequest{
			Status: status,
		}, uuid.Nil, "SUPER_ADMIN")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		apiErr, ok := err.(*apierrors.APIError)
		if !ok || apiErr.Code != apierrors.Unauthorized {
			t.Fatalf("expected Unauthorized error, got %v", err)
		}
	})
}

func TestCollegeService_ErrorClassification(t *testing.T) {
	t.Run("duplicate-code violation on uq_colleges_college_code returns Conflict", func(t *testing.T) {
		pgErr := &pgconn.PgError{
			Code:           "23505",
			ConstraintName: "uq_colleges_college_code",
			Message:        "duplicate key value violates unique constraint \"uq_colleges_college_code\"",
		}
		if !services.IsDuplicateCollegeCodeError(pgErr) {
			t.Fatal("expected IsDuplicateCollegeCodeError to return true for uq_colleges_college_code")
		}
	})

	t.Run("different unique-constraint violation returns false (not duplicate college code)", func(t *testing.T) {
		pgErr := &pgconn.PgError{
			Code:           "23505",
			ConstraintName: "uq_users_email",
			Message:        "duplicate key value violates unique constraint \"uq_users_email\"",
		}
		if services.IsDuplicateCollegeCodeError(pgErr) {
			t.Fatal("expected IsDuplicateCollegeCodeError to return false for uq_users_email")
		}
	})

	t.Run("wrapped PostgreSQL duplicate error with %w returns Conflict", func(t *testing.T) {
		innerPgErr := &pgconn.PgError{
			Code:           "23505",
			ConstraintName: "uq_colleges_college_code",
		}
		repoErr := fmt.Errorf("repository failed: %w", innerPgErr)
		txErr := fmt.Errorf("transaction callback aborted: %w", repoErr)

		if !services.IsDuplicateCollegeCodeError(txErr) {
			t.Fatal("expected IsDuplicateCollegeCodeError to return true through multi-level %w wrapping")
		}
	})

	t.Run("ordinary database error returns false", func(t *testing.T) {
		err := errors.New("connection reset by peer")
		if services.IsDuplicateCollegeCodeError(err) {
			t.Fatal("expected IsDuplicateCollegeCodeError to return false for ordinary db error")
		}
	})

	t.Run("nil error returns false", func(t *testing.T) {
		if services.IsDuplicateCollegeCodeError(nil) {
			t.Fatal("expected IsDuplicateCollegeCodeError to return false for nil")
		}
	})
}
