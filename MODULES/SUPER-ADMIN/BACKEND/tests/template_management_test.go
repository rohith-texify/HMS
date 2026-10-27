package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

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
// 1. TEMPLATE VALIDATOR UNIT TESTS
// -----------------------------------------------------------------------------

func TestTemplateValidator_ValidateTemplateID(t *testing.T) {
	_, err := validators.ValidateTemplateID("")
	if err == nil {
		t.Error("expected error for empty template ID")
	}

	_, err = validators.ValidateTemplateID("   ")
	if err == nil {
		t.Error("expected error for whitespace template ID")
	}

	_, err = validators.ValidateTemplateID("not-a-uuid")
	if err == nil {
		t.Error("expected error for malformed UUID")
	}

	_, err = validators.ValidateTemplateID(uuid.Nil.String())
	if err == nil {
		t.Error("expected error for nil UUID")
	}

	validID := uuid.New()
	parsed, err := validators.ValidateTemplateID(validID.String())
	if err != nil {
		t.Fatalf("unexpected error for valid template ID: %v", err)
	}
	if parsed != validID {
		t.Errorf("expected %v, got %v", validID, parsed)
	}
}

func TestTemplateValidator_ValidateTemplateCode(t *testing.T) {
	tests := []struct {
		name        string
		code        string
		expectError bool
		expected    string
	}{
		{"Empty code", "", true, ""},
		{"Whitespace code", "   ", true, ""},
		{"Too short (<2 chars)", "A", true, ""},
		{"Special chars with spaces", "BAD CODE", true, ""},
		{"Special chars with punctuation", "CODE!@#", true, ""},
		{"Too long (>100 chars)", string(make([]byte, 101)), true, ""},
		{"Valid lowercase", "standard-plan", false, "STANDARD-PLAN"},
		{"Valid with underscores and hyphens", "PLAN_2026-V1", false, "PLAN_2026-V1"},
		{"Valid with trim", "  premium_bundle  ", false, "PREMIUM_BUNDLE"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			res, err := validators.ValidateTemplateCode(tc.code)
			if tc.expectError && err == nil {
				t.Errorf("expected error for code '%s', got nil", tc.code)
			}
			if !tc.expectError {
				if err != nil {
					t.Errorf("unexpected error for code '%s': %v", tc.code, err)
				}
				if res != tc.expected {
					t.Errorf("expected '%s', got '%s'", tc.expected, res)
				}
			}
		})
	}
}

func TestTemplateValidator_ValidateCreateTemplateRequest(t *testing.T) {
	tests := []struct {
		name        string
		req         *models.CreateTemplateRequest
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Nil request body",
			req:         nil,
			expectError: true,
			errorMsg:    "Request body is required",
		},
		{
			name: "Empty template code",
			req: &models.CreateTemplateRequest{
				TemplateCode: "",
				Name:         "Standard Template",
			},
			expectError: true,
			errorMsg:    "Template code is required",
		},
		{
			name: "Invalid template code characters",
			req: &models.CreateTemplateRequest{
				TemplateCode: "BAD CODE!",
				Name:         "Standard Template",
			},
			expectError: true,
			errorMsg:    "Template code must contain only",
		},
		{
			name: "Empty name",
			req: &models.CreateTemplateRequest{
				TemplateCode: "STANDARD",
				Name:         "",
			},
			expectError: true,
			errorMsg:    "Template name is required",
		},
		{
			name: "Whitespace-only name",
			req: &models.CreateTemplateRequest{
				TemplateCode: "STANDARD",
				Name:         "   ",
			},
			expectError: true,
			errorMsg:    "Template name is required",
		},
		{
			name: "Excessive name length",
			req: &models.CreateTemplateRequest{
				TemplateCode: "STANDARD",
				Name:         string(make([]byte, 151)),
			},
			expectError: true,
			errorMsg:    "Template name cannot exceed 150 characters",
		},
		{
			name: "Negative version",
			req: &models.CreateTemplateRequest{
				TemplateCode: "STANDARD",
				Name:         "Standard Template",
				Version:      -1,
			},
			expectError: true,
			errorMsg:    "Template version must be a non-negative integer",
		},
		{
			name: "Valid request",
			req: &models.CreateTemplateRequest{
				TemplateCode: "standard_plan",
				Name:         "  Standard Template  ",
				Version:      1,
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateCreateTemplateRequest(tc.req)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error containing '%s', got nil", tc.errorMsg)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if tc.req.TemplateCode != "STANDARD_PLAN" {
					t.Errorf("expected uppercase normalized code 'STANDARD_PLAN', got '%s'", tc.req.TemplateCode)
				}
				if tc.req.Name != "Standard Template" {
					t.Errorf("expected trimmed name 'Standard Template', got '%s'", tc.req.Name)
				}
			}
		})
	}
}

func TestTemplateValidator_ValidateUpdateTemplateRequest(t *testing.T) {
	tests := []struct {
		name        string
		req         *models.UpdateTemplateRequest
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
			name:        "Empty request with no fields",
			req:         &models.UpdateTemplateRequest{},
			expectError: true,
			errorMsg:    "At least one field must be provided for update",
		},
		{
			name: "Empty name",
			req: func() *models.UpdateTemplateRequest {
				empty := ""
				return &models.UpdateTemplateRequest{Name: &empty}
			}(),
			expectError: true,
			errorMsg:    "Template name cannot be empty",
		},
		{
			name: "Excessive name length",
			req: func() *models.UpdateTemplateRequest {
				long := string(make([]byte, 151))
				return &models.UpdateTemplateRequest{Name: &long}
			}(),
			expectError: true,
			errorMsg:    "Template name cannot exceed 150 characters",
		},
		{
			name: "Negative version",
			req: func() *models.UpdateTemplateRequest {
				neg := -5
				return &models.UpdateTemplateRequest{Version: &neg}
			}(),
			expectError: true,
			errorMsg:    "Template version must be a non-negative integer",
		},
		{
			name: "Valid partial update",
			req: func() *models.UpdateTemplateRequest {
				newName := "Updated Plan"
				v := 2
				active := false
				return &models.UpdateTemplateRequest{
					Name:     &newName,
					Version:  &v,
					IsActive: &active,
				}
			}(),
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateUpdateTemplateRequest(tc.req)
			if tc.expectError && err == nil {
				t.Fatalf("expected error '%s', got nil", tc.errorMsg)
			}
			if !tc.expectError && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// -----------------------------------------------------------------------------
// 2. REPOSITORY FAIL-CLOSED TESTS (NO DB POOL CONFIGURED)
// -----------------------------------------------------------------------------

func TestTemplateRepository_FailClosedWhenUnconfigured(t *testing.T) {
	repo := repository.New(nil)
	ctx := context.Background()
	dummyID := uuid.New()

	// 1. ListEntitlementTemplates
	_, _, err := repo.ListEntitlementTemplates(ctx, nil, 10, 0)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("ListEntitlementTemplates: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 2. GetEntitlementTemplateByID
	_, err = repo.GetEntitlementTemplateByID(ctx, dummyID)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("GetEntitlementTemplateByID: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 3. GetEntitlementTemplateByCode
	_, err = repo.GetEntitlementTemplateByCode(ctx, "STANDARD")
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("GetEntitlementTemplateByCode: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 4. CreateEntitlementTemplate
	_, err = repo.CreateEntitlementTemplate(ctx, models.EntitlementTemplate{
		TemplateCode: "TEST",
		Name:         "Test",
	})
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("CreateEntitlementTemplate: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 5. UpdateEntitlementTemplate
	_, err = repo.UpdateEntitlementTemplate(ctx, dummyID, repository.UpdateTemplateParams{})
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("UpdateEntitlementTemplate: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 6. DeleteEntitlementTemplate
	err = repo.DeleteEntitlementTemplate(ctx, dummyID)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("DeleteEntitlementTemplate: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 7. RecordTemplateAudit
	err = repo.RecordTemplateAudit(ctx, repository.TemplateAuditParams{
		ActorUserID: dummyID,
		ActorRole:   "SUPER_ADMIN",
		Action:      "CREATE_TEMPLATE",
		TemplateID:  dummyID,
	})
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("RecordTemplateAudit: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}
}

// -----------------------------------------------------------------------------
// 3. SERVICE FAIL-CLOSED & LOGIC UNIT TESTS
// -----------------------------------------------------------------------------

func TestTemplateService_FailClosedWhenUnconfigured(t *testing.T) {
	svc := services.NewTemplateService(nil, nil)
	ctx := context.Background()
	dummyID := uuid.New()

	// ListTemplates
	_, _, err := svc.ListTemplates(ctx, models.ListTemplatesParams{})
	if err == nil {
		t.Error("expected error from unconfigured ListTemplates")
	}

	// GetTemplate
	_, err = svc.GetTemplate(ctx, dummyID)
	if err == nil {
		t.Error("expected error from unconfigured GetTemplate")
	}

	// CreateTemplate
	_, err = svc.CreateTemplate(ctx, models.CreateTemplateRequest{
		TemplateCode: "TEST",
		Name:         "Test",
	}, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured CreateTemplate")
	}

	// UpdateTemplate
	_, err = svc.UpdateTemplate(ctx, dummyID, models.UpdateTemplateRequest{}, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured UpdateTemplate")
	}

	// DeleteTemplate
	err = svc.DeleteTemplate(ctx, dummyID, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured DeleteTemplate")
	}

	// ApplyTemplateToCollege
	err = svc.ApplyTemplateToCollege(ctx, dummyID, dummyID, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured ApplyTemplateToCollege")
	}
}

func TestTemplateService_ValidateInputs(t *testing.T) {
	svc := services.NewTemplateService(&database.Database{}, repository.New(nil))
	ctx := context.Background()
	dummyID := uuid.New()

	// 1. GetTemplate with uuid.Nil
	_, err := svc.GetTemplate(ctx, uuid.Nil)
	if err == nil {
		t.Error("expected error for nil template ID in GetTemplate")
	}

	// 2. CreateTemplate with missing actor
	_, err = svc.CreateTemplate(ctx, models.CreateTemplateRequest{
		TemplateCode: "CODE",
		Name:         "Name",
	})
	if err == nil {
		t.Error("expected error when actor ID is not provided in context or args")
	}

	// 3. UpdateTemplate with uuid.Nil
	_, err = svc.UpdateTemplate(ctx, uuid.Nil, models.UpdateTemplateRequest{}, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error for nil template ID in UpdateTemplate")
	}

	// 4. DeleteTemplate with uuid.Nil
	err = svc.DeleteTemplate(ctx, uuid.Nil, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error for nil template ID in DeleteTemplate")
	}

	// 5. ApplyTemplateToCollege with missing college ID
	err = svc.ApplyTemplateToCollege(ctx, uuid.Nil, dummyID, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error for nil college ID in ApplyTemplateToCollege")
	}

	// 6. ApplyTemplateToCollege with missing template ID
	err = svc.ApplyTemplateToCollege(ctx, dummyID, uuid.Nil, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error for nil template ID in ApplyTemplateToCollege")
	}
}

// -----------------------------------------------------------------------------
// 4. HTTP HANDLER & SECURITY TESTS
// -----------------------------------------------------------------------------

func TestTemplateHandlers_AuthenticationAndValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := services.NewTemplateService(&database.Database{}, repository.New(nil))
	handler := handlers.NewTemplateHandler(svc)
	dummyUUID := uuid.New().String()

	// 1. CreateTemplate without authentication context -> 401 Unauthorized
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		body := `{"template_code": "PLAN_A", "name": "Plan A"}`
		req, _ := http.NewRequest("POST", "/super-admin/entitlement-templates", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		c.Request = req
		handler.CreateTemplate(c)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("CreateTemplate: expected HTTP 401 Unauthorized, got %d. Body: %s", w.Code, w.Body.String())
		}
	}

	// 2. CreateTemplate with actor spoofing via query params -> 401
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		body := `{"template_code": "PLAN_A", "name": "Plan A"}`
		req, _ := http.NewRequest("POST", "/super-admin/entitlement-templates?role=SUPER_ADMIN&user_id="+dummyUUID, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		c.Request = req
		handler.CreateTemplate(c)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("CreateTemplate: expected HTTP 401 despite query spoofing, got %d", w.Code)
		}
	}

	// 3. CreateTemplate with authenticated context but invalid payload -> 400 Bad Request
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		body := `{"template_code": "INVALID CODE WITH SPACES!", "name": ""}`
		req, _ := http.NewRequest("POST", "/super-admin/entitlement-templates", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		c.Request = req
		c.Set("auth_user_id", uuid.New())
		c.Set("auth_role", "SUPER_ADMIN")
		handler.CreateTemplate(c)
		if w.Code != http.StatusBadRequest {
			t.Errorf("CreateTemplate: expected HTTP 400 Bad Request, got %d. Body: %s", w.Code, w.Body.String())
		}
	}

	// 4. UpdateTemplate without auth -> 401
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		body := `{"name": "New Name"}`
		req, _ := http.NewRequest("PUT", "/super-admin/entitlement-templates/"+dummyUUID, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		c.Request = req
		c.Params = gin.Params{{Key: "id", Value: dummyUUID}}
		handler.UpdateTemplate(c)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("UpdateTemplate: expected HTTP 401, got %d", w.Code)
		}
	}

	// 5. UpdateTemplate with malformed UUID -> 400 Bad Request
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		body := `{"name": "New Name"}`
		req, _ := http.NewRequest("PUT", "/super-admin/entitlement-templates/not-a-uuid", bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
		c.Request = req
		c.Params = gin.Params{{Key: "id", Value: "not-a-uuid"}}
		c.Set("auth_user_id", uuid.New())
		c.Set("auth_role", "SUPER_ADMIN")
		handler.UpdateTemplate(c)
		if w.Code != http.StatusBadRequest {
			t.Errorf("UpdateTemplate: expected HTTP 400 for malformed UUID, got %d", w.Code)
		}
	}

	// 6. DeleteTemplate without auth -> 401
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req, _ := http.NewRequest("DELETE", "/super-admin/entitlement-templates/"+dummyUUID, nil)
		c.Request = req
		c.Params = gin.Params{{Key: "id", Value: dummyUUID}}
		handler.DeleteTemplate(c)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("DeleteTemplate: expected HTTP 401, got %d", w.Code)
		}
	}

	// 7. ApplyTemplateToCollege without auth -> 401
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req, _ := http.NewRequest("POST", "/super-admin/entitlement-templates/"+dummyUUID+"/apply/"+dummyUUID, nil)
		c.Request = req
		c.Params = gin.Params{
			{Key: "id", Value: dummyUUID},
			{Key: "college_id", Value: dummyUUID},
		}
		handler.ApplyTemplateToCollege(c)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("ApplyTemplateToCollege: expected HTTP 401, got %d", w.Code)
		}
	}

	// 8. ApplyTemplateToCollege with malformed college UUID -> 400
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req, _ := http.NewRequest("POST", "/super-admin/entitlement-templates/"+dummyUUID+"/apply/invalid-college-id", nil)
		c.Request = req
		c.Params = gin.Params{
			{Key: "id", Value: dummyUUID},
			{Key: "college_id", Value: "invalid-college-id"},
		}
		c.Set("auth_user_id", uuid.New())
		c.Set("auth_role", "SUPER_ADMIN")
		handler.ApplyTemplateToCollege(c)
		if w.Code != http.StatusBadRequest {
			t.Errorf("ApplyTemplateToCollege: expected HTTP 400 for invalid college UUID, got %d", w.Code)
		}
	}

	// 9. GetTemplate with malformed UUID -> 400
	{
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		req, _ := http.NewRequest("GET", "/super-admin/entitlement-templates/bad-id", nil)
		c.Request = req
		c.Params = gin.Params{{Key: "id", Value: "bad-id"}}
		handler.GetTemplate(c)
		if w.Code != http.StatusBadRequest {
			t.Errorf("GetTemplate: expected HTTP 400 for bad ID, got %d", w.Code)
		}
	}
}

// -----------------------------------------------------------------------------
// 5. ROUTE REGISTRATION INTEGRATION TEST
// -----------------------------------------------------------------------------

func TestTemplateRoutes_Registration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	group := engine.Group("/api/v1")

	passMiddleware := func(c *gin.Context) {
		c.Next()
	}

	routes.RegisterSuperAdminRoutes(group, &database.Database{}, passMiddleware, passMiddleware)

	expectedRoutes := map[string]string{
		"GET /api/v1/super-admin/entitlement-templates":                        "ListTemplates",
		"POST /api/v1/super-admin/entitlement-templates":                       "CreateTemplate",
		"GET /api/v1/super-admin/entitlement-templates/:id":                    "GetTemplate",
		"PUT /api/v1/super-admin/entitlement-templates/:id":                    "UpdateTemplate",
		"PATCH /api/v1/super-admin/entitlement-templates/:id":                  "UpdateTemplate",
		"DELETE /api/v1/super-admin/entitlement-templates/:id":                 "DeleteTemplate",
		"POST /api/v1/super-admin/entitlement-templates/:id/apply/:college_id": "ApplyTemplateToCollege",
		"POST /api/v1/super-admin/colleges/:id/apply-template":                 "ApplyTemplateToCollege",
	}

	registered := make(map[string]bool)
	for _, r := range engine.Routes() {
		registered[fmt.Sprintf("%s %s", r.Method, r.Path)] = true
	}

	for routeKey := range expectedRoutes {
		if !registered[routeKey] {
			t.Errorf("expected route %s to be registered, but was not found", routeKey)
		}
	}
}

func TestTemplateRoutes_ExecutionAndPermissionGuards(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	group := engine.Group("/api/v1")

	// Realistic permission guards that check request context/headers
	requireView := func(c *gin.Context) {
		role := c.GetHeader("X-Role")
		if role == "UNAUTHORIZED" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden: platform.view required"})
			return
		}
		c.Set("auth_user_id", uuid.New())
		c.Set("auth_role", "SUPER_ADMIN")
		c.Next()
	}

	requireManage := func(c *gin.Context) {
		role := c.GetHeader("X-Role")
		if role != "SUPER_ADMIN" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "Forbidden: platform.manage required"})
			return
		}
		c.Set("auth_user_id", uuid.New())
		c.Set("auth_role", "SUPER_ADMIN")
		c.Next()
	}

	db := &database.Database{}
	routes.RegisterSuperAdminRoutes(group, db, requireView, requireManage)

	dummyUUID := uuid.New().String()

	// 1. GET /super-admin/entitlement-templates blocked when view permission fails -> 403
	{
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/super-admin/entitlement-templates", nil)
		req.Header.Set("X-Role", "UNAUTHORIZED")
		engine.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403 Forbidden when view permission fails, got %d", w.Code)
		}
	}

	// 2. GET /super-admin/entitlement-templates/:id with invalid ID executes handler after view guard -> 400
	{
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("GET", "/api/v1/super-admin/entitlement-templates/not-a-valid-uuid", nil)
		req.Header.Set("X-Role", "VIEWER")
		engine.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request from handler after passing view guard, got %d", w.Code)
		}
	}

	// 3. POST /super-admin/entitlement-templates blocked when manage permission fails -> 403
	{
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"template_code":"PLAN","name":"Plan"}`)
		req, _ := http.NewRequest("POST", "/api/v1/super-admin/entitlement-templates", body)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Role", "VIEWER")
		engine.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403 Forbidden when manage permission fails on create, got %d", w.Code)
		}
	}

	// 4. PUT /super-admin/entitlement-templates/:id blocked when manage permission fails -> 403
	{
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"name":"New Plan"}`)
		req, _ := http.NewRequest("PUT", "/api/v1/super-admin/entitlement-templates/"+dummyUUID, body)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Role", "VIEWER")
		engine.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403 Forbidden when manage permission fails on update, got %d", w.Code)
		}
	}

	// 5. DELETE /super-admin/entitlement-templates/:id blocked when manage permission fails -> 403
	{
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("DELETE", "/api/v1/super-admin/entitlement-templates/"+dummyUUID, nil)
		req.Header.Set("X-Role", "VIEWER")
		engine.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403 Forbidden when manage permission fails on delete, got %d", w.Code)
		}
	}

	// 6. POST /super-admin/entitlement-templates/:id/apply/:college_id blocked when manage permission fails -> 403
	{
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/v1/super-admin/entitlement-templates/"+dummyUUID+"/apply/"+dummyUUID, nil)
		req.Header.Set("X-Role", "VIEWER")
		engine.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403 Forbidden when manage permission fails on apply template, got %d", w.Code)
		}
	}

	// 7. POST /super-admin/colleges/:id/apply-template blocked when manage permission fails -> 403
	{
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"template_id":"` + dummyUUID + `"}`)
		req, _ := http.NewRequest("POST", "/api/v1/super-admin/colleges/"+dummyUUID+"/apply-template", body)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Role", "VIEWER")
		engine.ServeHTTP(w, req)
		if w.Code != http.StatusForbidden {
			t.Errorf("expected 403 Forbidden when manage permission fails on college apply-template, got %d", w.Code)
		}
	}

	// 8. POST /super-admin/colleges/:id/apply-template executes handler with manage permission -> handles body without college_id duplication
	{
		w := httptest.NewRecorder()
		body := bytes.NewBufferString(`{"template_id":"` + dummyUUID + `"}`)
		req, _ := http.NewRequest("POST", "/api/v1/super-admin/colleges/"+dummyUUID+"/apply-template", body)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Role", "SUPER_ADMIN")
		engine.ServeHTTP(w, req)
		// Because db is unconfigured, handler reaches service and returns 500 (not 400 for missing college_id in body!)
		if w.Code != http.StatusInternalServerError {
			t.Errorf("expected 500 Internal Server Error (service unconfigured) proving handler was reached, got %d. Body: %s", w.Code, w.Body.String())
		}
	}

	// 9. POST /super-admin/colleges/:id/apply-template with mismatched college_id in body -> 400 Bad Request
	{
		w := httptest.NewRecorder()
		otherUUID := uuid.New().String()
		body := bytes.NewBufferString(`{"college_id":"` + otherUUID + `","template_id":"` + dummyUUID + `"}`)
		req, _ := http.NewRequest("POST", "/api/v1/super-admin/colleges/"+dummyUUID+"/apply-template", body)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Role", "SUPER_ADMIN")
		engine.ServeHTTP(w, req)
		if w.Code != http.StatusBadRequest {
			t.Errorf("expected 400 Bad Request for mismatched college_id, got %d. Body: %s", w.Code, w.Body.String())
		}
	}

	// 10. POST /super-admin/entitlement-templates/:id/apply/:college_id executes handler with manage permission -> reaches handler
	{
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/api/v1/super-admin/entitlement-templates/"+dummyUUID+"/apply/"+dummyUUID, nil)
		req.Header.Set("X-Role", "SUPER_ADMIN")
		engine.ServeHTTP(w, req)
		if w.Code != http.StatusInternalServerError {
			t.Errorf("expected 500 Internal Server Error proving handler was reached, got %d. Body: %s", w.Code, w.Body.String())
		}
	}
}

// -----------------------------------------------------------------------------
// 6. ISOLATED INTEGRATION TESTS (SKIPPED IF TEST_DATABASE_URL IS UNSET)
// -----------------------------------------------------------------------------

func TestEntitlementTemplates_Integration_CRUDAndAudit(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewTemplateService(db, repo)

	actorID, err := seedTestUser(ctx, db, "tmpl-admin")
	if err != nil {
		t.Fatalf("failed to seed test admin: %v", err)
	}

	suffix := uuid.New().String()[:8]
	code := "TMPL_" + suffix
	desc := "Integration test entitlement template"

	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE actor_user_id = $1", actorID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.entitlement_templates WHERE template_code = $1", code)
	}()

	// 1. Create Template
	createReq := models.CreateTemplateRequest{
		TemplateCode: code,
		Name:         "Plan " + suffix,
		Description:  &desc,
		Version:      1,
	}

	created, err := svc.CreateTemplate(ctx, createReq, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create entitlement template: %v", err)
	}
	if created == nil || created.TemplateID == uuid.Nil {
		t.Fatal("expected non-nil created template with valid UUID")
	}
	if created.TemplateCode != code {
		t.Errorf("expected template code %s, got %s", code, created.TemplateCode)
	}

	// Verify Audit Log for Creation
	var auditCount int
	err = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM platform.audit_logs
		WHERE entity_id = $1 AND action = 'CREATE_TEMPLATE' AND module = 'platform_entitlement_templates'
	`, created.TemplateID).Scan(&auditCount)
	if err != nil {
		t.Fatalf("failed to check audit log for creation: %v", err)
	}
	if auditCount != 1 {
		t.Errorf("expected 1 creation audit log, got %d", auditCount)
	}

	// 2. Reject Duplicate Template Code
	_, err = svc.CreateTemplate(ctx, createReq, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Fatal("expected duplicate template code creation to fail, but succeeded")
	}

	// 3. Get Template by ID
	fetched, err := svc.GetTemplate(ctx, created.TemplateID)
	if err != nil {
		t.Fatalf("failed to retrieve template by ID: %v", err)
	}
	if fetched.TemplateID != created.TemplateID || fetched.Name != created.Name {
		t.Errorf("fetched template mismatch: got %+v, expected %+v", fetched, created)
	}

	// 4. Update Template
	updatedName := "Updated Plan " + suffix
	newVersion := 2
	inactive := false
	updated, err := svc.UpdateTemplate(ctx, created.TemplateID, models.UpdateTemplateRequest{
		Name:     &updatedName,
		Version:  &newVersion,
		IsActive: &inactive,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to update template: %v", err)
	}
	if updated.Name != updatedName || updated.Version != 2 || updated.IsActive != false {
		t.Errorf("updated fields mismatch: %+v", updated)
	}

	// Verify Audit Log for Update
	err = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM platform.audit_logs
		WHERE entity_id = $1 AND action = 'UPDATE_TEMPLATE' AND module = 'platform_entitlement_templates'
	`, created.TemplateID).Scan(&auditCount)
	if err != nil {
		t.Fatalf("failed to check audit log for update: %v", err)
	}
	if auditCount != 1 {
		t.Errorf("expected 1 update audit log, got %d", auditCount)
	}

	// 5. List Templates
	list, meta, err := svc.ListTemplates(ctx, models.ListTemplatesParams{
		Limit: 10,
	})
	if err != nil {
		t.Fatalf("failed to list templates: %v", err)
	}
	if meta == nil || meta.Total < 1 {
		t.Errorf("expected at least 1 template in list, got meta: %+v", meta)
	}
	found := false
	for _, tmpl := range list {
		if tmpl.TemplateID == created.TemplateID {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("created template %v not found in list", created.TemplateID)
	}

	// 6. Delete Template
	err = svc.DeleteTemplate(ctx, created.TemplateID, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to delete template: %v", err)
	}

	// Verify deleted from DB
	_, err = svc.GetTemplate(ctx, created.TemplateID)
	if err == nil {
		t.Error("expected error retrieving deleted template, but got nil")
	}

	// Verify Audit Log for Deletion
	err = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM platform.audit_logs
		WHERE entity_id = $1 AND action = 'DELETE_TEMPLATE' AND module = 'platform_entitlement_templates'
	`, created.TemplateID).Scan(&auditCount)
	if err != nil {
		t.Fatalf("failed to check audit log for deletion: %v", err)
	}
	if auditCount != 1 {
		t.Errorf("expected 1 deletion audit log, got %d", auditCount)
	}
}

func TestEntitlementTemplates_Integration_CollegeLifecycleAndLimitation(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewTemplateService(db, repo)

	actorID, err := seedTestUser(ctx, db, "tmpl-lifecycle")
	if err != nil {
		t.Fatalf("failed to seed test admin: %v", err)
	}

	suffix := uuid.New().String()[:8]
	code := "LIFECYCLE_" + suffix

	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE actor_user_id = $1", actorID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.entitlement_templates WHERE template_code = $1", code)
	}()

	// 1. Create Active Template
	tmpl, err := svc.CreateTemplate(ctx, models.CreateTemplateRequest{
		TemplateCode: code,
		Name:         "Lifecycle Test Template",
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create template: %v", err)
	}

	// 2. Non-existent college returns 404 / NotFound
	nonExistentCollege := uuid.New()
	err = svc.ApplyTemplateToCollege(ctx, nonExistentCollege, tmpl.TemplateID, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error applying template to non-existent college")
	}

	// 3. Non-existent template returns 404 / NotFound on existing college
	// (Create a temporary test college)
	collegeID := uuid.New()
	err = db.Pool.QueryRow(ctx, `
		INSERT INTO platform.colleges (college_id, name, college_code, status, created_at, updated_at)
		VALUES ($1, 'Test College', $2, 'ACTIVE', NOW(), NOW())
		RETURNING college_id
	`, collegeID, "COLL_"+suffix).Scan(&collegeID)
	if err != nil {
		t.Fatalf("failed to insert test college: %v", err)
	}
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	nonExistentTemplate := uuid.New()
	err = svc.ApplyTemplateToCollege(ctx, collegeID, nonExistentTemplate, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error applying non-existent template to college")
	}

	// 4. Inactive College Validation: Set college to DEACTIVATED
	_, err = db.Pool.Exec(ctx, "UPDATE platform.colleges SET status = 'DEACTIVATED' WHERE college_id = $1", collegeID)
	if err != nil {
		t.Fatalf("failed to deactivate college: %v", err)
	}

	err = svc.ApplyTemplateToCollege(ctx, collegeID, tmpl.TemplateID, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error applying template to DEACTIVATED college")
	}

	// 5. Inactive Template Validation: Set college back to ACTIVE, set template to inactive
	_, err = db.Pool.Exec(ctx, "UPDATE platform.colleges SET status = 'ACTIVE' WHERE college_id = $1", collegeID)
	if err != nil {
		t.Fatalf("failed to activate college: %v", err)
	}

	inactive := false
	_, err = svc.UpdateTemplate(ctx, tmpl.TemplateID, models.UpdateTemplateRequest{
		IsActive: &inactive,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to deactivate template: %v", err)
	}

	err = svc.ApplyTemplateToCollege(ctx, collegeID, tmpl.TemplateID, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error applying inactive template")
	}

	// 6. Active College & Active Template: Reports schema blocker safely without inventing storage
	active := true
	_, err = svc.UpdateTemplate(ctx, tmpl.TemplateID, models.UpdateTemplateRequest{
		IsActive: &active,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to re-activate template: %v", err)
	}

	err = svc.ApplyTemplateToCollege(ctx, collegeID, tmpl.TemplateID, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Fatal("expected schema limitation error, got nil")
	}
	var apiErr *apierrors.APIError
	if !errors.As(err, &apiErr) || apiErr.Code != apierrors.ValidationError || !contains(err.Error(), "module mappings are not supported") {
		t.Errorf("expected validation error regarding schema limitation, got: %v", err)
	}

	_ = json.Marshal
}

func contains(s, substr string) bool {
	return bytes.Contains([]byte(s), []byte(substr))
}
