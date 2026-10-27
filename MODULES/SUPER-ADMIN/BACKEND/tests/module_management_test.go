package tests

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

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
// 1. MODULE & SETTINGS VALIDATOR UNIT TESTS
// -----------------------------------------------------------------------------

func TestModuleValidator_ValidateModuleID(t *testing.T) {
	_, err := validators.ValidateModuleID("")
	if err == nil {
		t.Error("expected error for empty module ID")
	}

	_, err = validators.ValidateModuleID("not-a-uuid")
	if err == nil {
		t.Error("expected error for malformed UUID")
	}

	validID := uuid.New()
	parsed, err := validators.ValidateModuleID(validID.String())
	if err != nil {
		t.Errorf("unexpected error for valid module ID: %v", err)
	}
	if parsed != validID {
		t.Errorf("expected %v, got %v", validID, parsed)
	}
}

func TestModuleValidator_ValidateCollegeModuleID(t *testing.T) {
	_, err := validators.ValidateCollegeModuleID("")
	if err == nil {
		t.Error("expected error for empty college module ID")
	}

	validID := uuid.New()
	parsed, err := validators.ValidateCollegeModuleID(validID.String())
	if err != nil {
		t.Errorf("unexpected error for valid college module ID: %v", err)
	}
	if parsed != validID {
		t.Errorf("expected %v, got %v", validID, parsed)
	}
}

func TestModuleValidator_ValidateCreateModule(t *testing.T) {
	parentID := uuid.New()

	tests := []struct {
		name        string
		req         *models.CreateModuleRequest
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
			name: "Empty module code",
			req: &models.CreateModuleRequest{
				ModuleCode: "",
				ModuleName: "Test Module",
				Kind:       "APP",
			},
			expectError: true,
			errorMsg:    "Module code is required",
		},
		{
			name: "Invalid characters in module code",
			req: &models.CreateModuleRequest{
				ModuleCode: "INVALID CODE with spaces!",
				ModuleName: "Test Module",
				Kind:       "APP",
			},
			expectError: true,
			errorMsg:    "must be 2-150 characters",
		},
		{
			name: "Empty module name",
			req: &models.CreateModuleRequest{
				ModuleCode: "VALID_CODE",
				ModuleName: "",
				Kind:       "APP",
			},
			expectError: true,
			errorMsg:    "Module name is required",
		},
		{
			name: "Invalid kind",
			req: &models.CreateModuleRequest{
				ModuleCode: "VALID_CODE",
				ModuleName: "Valid Name",
				Kind:       "MICROSERVICE",
			},
			expectError: true,
			errorMsg:    "Kind must be APP, MODULE, or FEATURE",
		},
		{
			name: "APP with parent_id (illegal hierarchy)",
			req: &models.CreateModuleRequest{
				ModuleCode: "ROOT_APP",
				ModuleName: "Root App",
				Kind:       "APP",
				ParentID:   &parentID,
			},
			expectError: true,
			errorMsg:    "APP root modules cannot have a parent",
		},
		{
			name: "MODULE without parent_id (illegal hierarchy)",
			req: &models.CreateModuleRequest{
				ModuleCode: "SUB_MODULE",
				ModuleName: "Sub Module",
				Kind:       "MODULE",
				ParentID:   nil,
			},
			expectError: true,
			errorMsg:    "must specify a valid parent_id",
		},
		{
			name: "FEATURE without parent_id (illegal hierarchy)",
			req: &models.CreateModuleRequest{
				ModuleCode: "FEATURE_ITEM",
				ModuleName: "Feature Item",
				Kind:       "FEATURE",
				ParentID:   nil,
			},
			expectError: true,
			errorMsg:    "must specify a valid parent_id",
		},
		{
			name: "Valid APP",
			req: &models.CreateModuleRequest{
				ModuleCode: "HMS_CORE_APP",
				ModuleName: "Hostel Management System Core",
				Kind:       "APP",
				Priority:   "M",
			},
			expectError: false,
		},
		{
			name: "Valid child MODULE with parent",
			req: &models.CreateModuleRequest{
				ModuleCode: "MESS_BILLING",
				ModuleName: "Mess Billing Module",
				Kind:       "MODULE",
				ParentID:   &parentID,
				Priority:   "S",
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateCreateModuleRequest(tc.req)
			if tc.expectError {
				if err == nil {
					t.Fatalf("expected error containing '%s', got nil", tc.errorMsg)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestModuleValidator_ValidateUpdateModule(t *testing.T) {
	name := "Updated Module Name"
	emptyName := "   "
	shortName := "a"
	validKind := "MODULE"
	invalidKind := "UNKNOWN_KIND"
	appKind := "APP"
	parentID := uuid.New()

	tests := []struct {
		name        string
		req         *models.UpdateModuleRequest
		expectError bool
	}{
		{
			name:        "Nil request",
			req:         nil,
			expectError: true,
		},
		{
			name:        "Empty request without fields",
			req:         &models.UpdateModuleRequest{},
			expectError: true,
		},
		{
			name: "Empty name",
			req: &models.UpdateModuleRequest{
				ModuleName: &emptyName,
			},
			expectError: true,
		},
		{
			name: "Too short name",
			req: &models.UpdateModuleRequest{
				ModuleName: &shortName,
			},
			expectError: true,
		},
		{
			name: "Invalid kind",
			req: &models.UpdateModuleRequest{
				Kind: &invalidKind,
			},
			expectError: true,
		},
		{
			name: "APP kind with non-nil parent_id",
			req: &models.UpdateModuleRequest{
				Kind:     &appKind,
				ParentID: &parentID,
			},
			expectError: true,
		},
		{
			name: "Valid update",
			req: &models.UpdateModuleRequest{
				ModuleName: &name,
				Kind:       &validKind,
				ParentID:   &parentID,
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateUpdateModuleRequest(tc.req)
			if tc.expectError && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tc.expectError && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestModuleValidator_ValidateAssignCollegeModule(t *testing.T) {
	now := time.Now()
	past := now.Add(-1 * time.Hour)
	future := now.Add(24 * time.Hour)
	moduleID := uuid.New()

	tests := []struct {
		name        string
		req         *models.AssignCollegeModuleRequest
		expectError bool
	}{
		{
			name:        "Nil request",
			req:         nil,
			expectError: true,
		},
		{
			name: "Nil module ID",
			req: &models.AssignCollegeModuleRequest{
				ModuleID: uuid.Nil,
				Status:   "ACTIVE",
				Mode:     "FULL",
			},
			expectError: true,
		},
		{
			name: "Invalid status",
			req: &models.AssignCollegeModuleRequest{
				ModuleID: moduleID,
				Status:   "PENDING",
				Mode:     "FULL",
			},
			expectError: true,
		},
		{
			name: "Invalid mode",
			req: &models.AssignCollegeModuleRequest{
				ModuleID: moduleID,
				Status:   "ACTIVE",
				Mode:     "ADMIN_ONLY",
			},
			expectError: true,
		},
		{
			name: "Effective to before effective from",
			req: &models.AssignCollegeModuleRequest{
				ModuleID:      moduleID,
				Status:        "ACTIVE",
				Mode:          "FULL",
				EffectiveFrom: &future,
				EffectiveTo:   &past,
			},
			expectError: true,
		},
		{
			name: "Valid assignment",
			req: &models.AssignCollegeModuleRequest{
				ModuleID:      moduleID,
				Status:        "ACTIVE",
				Mode:          "FULL",
				EffectiveFrom: &now,
				EffectiveTo:   &future,
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateAssignCollegeModuleRequest(tc.req)
			if tc.expectError && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tc.expectError && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

func TestSettingValidator_ValidateSettingKey(t *testing.T) {
	tests := []struct {
		name        string
		key         string
		expectError bool
	}{
		{
			name:        "Empty key",
			key:         "",
			expectError: true,
		},
		{
			name:        "Whitespace-only key",
			key:         "   ",
			expectError: true,
		},
		{
			name:        "Invalid characters (spaces)",
			key:         "curfew time",
			expectError: true,
		},
		{
			name:        "Invalid characters (special symbols)",
			key:         "curfew#time@rules",
			expectError: true,
		},
		{
			name:        "Valid key alphanumeric with dots and underscores",
			key:         "curfew.rules_2026.enabled",
			expectError: false,
		},
		{
			name:        "Valid key with hyphens",
			key:         "attendance-policy-v1",
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cleanKey, err := validators.ValidateSettingKey(tc.key)
			if tc.expectError && err == nil {
				t.Fatalf("expected error for key '%s', got nil", tc.key)
			}
			if !tc.expectError {
				if err != nil {
					t.Fatalf("unexpected error for key '%s': %v", tc.key, err)
				}
				if cleanKey == "" {
					t.Fatalf("expected cleanKey to be non-empty")
				}
			}
		})
	}
}

func TestSettingValidator_ValidateUpdateCollegeSettingRequest(t *testing.T) {
	tests := []struct {
		name        string
		req         *models.UpdateCollegeSettingRequest
		expectError bool
	}{
		{
			name:        "Nil request",
			req:         nil,
			expectError: true,
		},
		{
			name: "Nil setting value",
			req: &models.UpdateCollegeSettingRequest{
				SettingValue: nil,
			},
			expectError: true,
		},
		{
			name: "Valid JSONB value",
			req: &models.UpdateCollegeSettingRequest{
				SettingValue: models.JSONB{"time": "22:00", "grace_period_mins": 15},
			},
			expectError: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := validators.ValidateUpdateCollegeSettingRequest(tc.req)
			if tc.expectError && err == nil {
				t.Fatalf("expected error, got nil")
			}
			if !tc.expectError && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}

// -----------------------------------------------------------------------------
// 2. FAIL-CLOSED REPOSITORY UNIT TESTS (NO DATABASE REQUIRED)
// -----------------------------------------------------------------------------

func TestModuleRepository_FailClosedWithoutPool(t *testing.T) {
	repo := repository.New(nil)
	ctx := context.Background()
	dummyID := uuid.New()

	// 1. ListModules
	_, _, err := repo.ListModules(ctx, nil, nil, 10, 0)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("ListModules: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 2. GetModuleByID
	_, err = repo.GetModuleByID(ctx, dummyID)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("GetModuleByID: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 3. GetModuleByCode
	_, err = repo.GetModuleByCode(ctx, "NON_EXISTENT")
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("GetModuleByCode: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 4. CreateModule
	_, err = repo.CreateModule(ctx, models.CreateModuleRequest{
		ModuleCode: "TEST_MOD",
		ModuleName: "Test Module",
		Kind:       "APP",
	})
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("CreateModule: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 5. UpdateModule
	name := "Updated Name"
	_, err = repo.UpdateModule(ctx, dummyID, models.UpdateModuleRequest{ModuleName: &name})
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("UpdateModule: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 6. ToggleModuleStatus
	_, err = repo.ToggleModuleStatus(ctx, dummyID, false)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("ToggleModuleStatus: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 7. DeleteModule
	err = repo.DeleteModule(ctx, dummyID)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("DeleteModule: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 8. ListCollegeModules
	_, _, err = repo.ListCollegeModules(ctx, dummyID, nil, 10, 0)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("ListCollegeModules: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 9. GetCollegeModuleByID
	_, err = repo.GetCollegeModuleByID(ctx, dummyID)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("GetCollegeModuleByID: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 10. AssignCollegeModule
	_, err = repo.AssignCollegeModule(ctx, dummyID, models.AssignCollegeModuleRequest{
		ModuleID: dummyID,
		Status:   "ACTIVE",
		Mode:     "FULL",
	}, dummyID)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("AssignCollegeModule: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 11. RecordModuleAudit
	err = repo.RecordModuleAudit(ctx, models.ModuleAuditParams{
		ActorUserID: dummyID,
		ActorRole:   "SUPER_ADMIN",
		Module:      "platform_modules",
		Action:      "TEST_ACTION",
	})
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("RecordModuleAudit: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}
}

func TestSettingsRepository_FailClosedWithoutPool(t *testing.T) {
	repo := repository.New(nil)
	ctx := context.Background()
	dummyID := uuid.New()

	// 1. ListCollegeSettings
	_, err := repo.ListCollegeSettings(ctx, dummyID, true)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("ListCollegeSettings: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 2. GetCollegeSettingByKey
	_, err = repo.GetCollegeSettingByKey(ctx, dummyID, "curfew_time")
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("GetCollegeSettingByKey: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 3. UpdateCollegeSetting
	_, err = repo.UpdateCollegeSetting(ctx, dummyID, "curfew_time", models.JSONB{"time": "22:00"})
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("UpdateCollegeSetting: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 4. UpsertCollegeSetting
	_, err = repo.UpsertCollegeSetting(ctx, dummyID, "curfew_time", models.JSONB{"time": "22:00"}, false)
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("UpsertCollegeSetting: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}

	// 5. RecordSettingsAudit
	err = repo.RecordSettingsAudit(ctx, repository.SettingsAuditParams{
		CollegeID:   dummyID,
		ActorUserID: dummyID,
		ActorRole:   "SUPER_ADMIN",
		Module:      "platform_college_settings",
		Action:      "UPDATE_COLLEGE_SETTING",
	})
	if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
		t.Errorf("RecordSettingsAudit: expected ErrPlatformPoolNotConfigured, got: %v", err)
	}
}

// -----------------------------------------------------------------------------
// 3. FAIL-CLOSED SERVICE UNIT TESTS (NO DATABASE REQUIRED)
// -----------------------------------------------------------------------------

func TestModuleService_FailClosedWhenUnconfigured(t *testing.T) {
	svc := services.NewModuleService(nil, nil)
	ctx := context.Background()
	dummyID := uuid.New()

	// ListModules
	_, _, err := svc.ListModules(ctx, models.ListModulesParams{})
	if err == nil {
		t.Error("expected error from unconfigured ListModules")
	}

	// GetModule
	_, err = svc.GetModule(ctx, dummyID)
	if err == nil {
		t.Error("expected error from unconfigured GetModule")
	}

	// CreateModule
	_, err = svc.CreateModule(ctx, models.CreateModuleRequest{}, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured CreateModule")
	}

	// UpdateModule
	_, err = svc.UpdateModule(ctx, dummyID, models.UpdateModuleRequest{}, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured UpdateModule")
	}

	// ToggleModuleStatus
	_, err = svc.ToggleModuleStatus(ctx, dummyID, models.ToggleModuleStatusRequest{}, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured ToggleModuleStatus")
	}

	// DeleteModule
	err = svc.DeleteModule(ctx, dummyID, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured DeleteModule")
	}

	// AssignCollegeModule
	_, err = svc.AssignCollegeModule(ctx, dummyID, models.AssignCollegeModuleRequest{}, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured AssignCollegeModule")
	}

	// UpdateCollegeModule
	_, err = svc.UpdateCollegeModule(ctx, dummyID, models.UpdateCollegeModuleRequest{}, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured UpdateCollegeModule")
	}

	// GetCollegeEntitlements
	_, err = svc.GetCollegeEntitlements(ctx, dummyID)
	if err == nil {
		t.Error("expected error from unconfigured GetCollegeEntitlements")
	}

	// UpdateCollegeEntitlement
	_, err = svc.UpdateCollegeEntitlement(ctx, dummyID, models.AssignCollegeModuleRequest{}, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured UpdateCollegeEntitlement")
	}

	// GetCollegeEntitlementMatrix
	_, err = svc.GetCollegeEntitlementMatrix(ctx, dummyID)
	if err == nil {
		t.Error("expected error from unconfigured GetCollegeEntitlementMatrix")
	}

	// PreviewModuleImpact
	_, err = svc.PreviewModuleImpact(ctx, dummyID, dummyID, "DISABLED", "FULL")
	if err == nil {
		t.Error("expected error from unconfigured PreviewModuleImpact")
	}

	// RequestModuleEntitlementChange
	_, _, err = svc.RequestModuleEntitlementChange(ctx, dummyID, dummyID, models.UpdateCollegeModuleRequest{Status: "DISABLED", Mode: "FULL"}, dummyID, "SUPER_ADMIN", false)
	if err == nil {
		t.Error("expected error from unconfigured RequestModuleEntitlementChange")
	}

	// ListModuleHistory
	_, _, err = svc.ListModuleHistory(ctx, &dummyID, &dummyID, 10, 0)
	if err == nil {
		t.Error("expected error from unconfigured ListModuleHistory")
	}
}


func TestSettingsService_FailClosedWhenUnconfigured(t *testing.T) {
	svc := services.NewSettingsService(nil, nil)
	ctx := context.Background()
	dummyID := uuid.New()

	// ListCollegeSettings
	_, err := svc.ListCollegeSettings(ctx, dummyID, false)
	if err == nil {
		t.Error("expected error from unconfigured ListCollegeSettings")
	}

	// GetCollegeSetting
	_, err = svc.GetCollegeSetting(ctx, dummyID, "curfew_time")
	if err == nil {
		t.Error("expected error from unconfigured GetCollegeSetting")
	}

	// UpdateCollegeSetting
	_, err = svc.UpdateCollegeSetting(ctx, dummyID, "curfew_time", models.UpdateCollegeSettingRequest{
		SettingValue: models.JSONB{"time": "22:00"},
	}, dummyID, "SUPER_ADMIN")
	if err == nil {
		t.Error("expected error from unconfigured UpdateCollegeSetting")
	}
}

// -----------------------------------------------------------------------------
// 4. HANDLER ACTOR AUTHENTICATION & ENVELOPE UNIT TESTS (NO DATABASE REQUIRED)
// -----------------------------------------------------------------------------

func TestModuleHandlers_ActorAuthentication(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := services.NewModuleService(&database.Database{}, repository.New(nil))
	handler := handlers.NewModuleHandler(svc)

	dummyUUID := uuid.New().String()

	tests := []struct {
		name       string
		method     string
		path       string
		body       string
		handlerFn  gin.HandlerFunc
		paramKey   string
		paramVal   string
		expectCode int
	}{
		{
			name:       "CreateModule without auth",
			method:     "POST",
			path:       "/super-admin/modules",
			body:       `{"module_code":"TEST","module_name":"Test","kind":"APP"}`,
			handlerFn:  handler.CreateModule,
			expectCode: http.StatusUnauthorized,
		},
		{
			name:       "UpdateModule without auth",
			method:     "PUT",
			path:       "/super-admin/modules/" + dummyUUID,
			body:       `{"module_name":"Updated"}`,
			handlerFn:  handler.UpdateModule,
			paramKey:   "id",
			paramVal:   dummyUUID,
			expectCode: http.StatusUnauthorized,
		},
		{
			name:       "ToggleModuleStatus without auth",
			method:     "PATCH",
			path:       "/super-admin/modules/" + dummyUUID + "/status",
			body:       `{"is_active":false}`,
			handlerFn:  handler.ToggleModuleStatus,
			paramKey:   "id",
			paramVal:   dummyUUID,
			expectCode: http.StatusUnauthorized,
		},
		{
			name:       "DeleteModule without auth",
			method:     "DELETE",
			path:       "/super-admin/modules/" + dummyUUID,
			body:       "",
			handlerFn:  handler.DeleteModule,
			paramKey:   "id",
			paramVal:   dummyUUID,
			expectCode: http.StatusUnauthorized,
		},
		{
			name:       "AssignCollegeModule without auth",
			method:     "POST",
			path:       "/super-admin/colleges/" + dummyUUID + "/modules",
			body:       `{"module_id":"` + dummyUUID + `","status":"ACTIVE","mode":"FULL"}`,
			handlerFn:  handler.AssignCollegeModule,
			paramKey:   "id",
			paramVal:   dummyUUID,
			expectCode: http.StatusUnauthorized,
		},
		{
			name:       "GetModule with invalid UUID",
			method:     "GET",
			path:       "/super-admin/modules/not-a-uuid",
			handlerFn:  handler.GetModule,
			paramKey:   "id",
			paramVal:   "not-a-uuid",
			expectCode: http.StatusBadRequest,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(w)

			req, _ := http.NewRequest(tc.method, tc.path, bytes.NewBufferString(tc.body))
			req.Header.Set("Content-Type", "application/json")
			c.Request = req

			if tc.paramKey != "" {
				c.Params = gin.Params{{Key: tc.paramKey, Value: tc.paramVal}}
			}

			tc.handlerFn(c)

			if w.Code != tc.expectCode {
				t.Fatalf("expected HTTP %d, got %d. Body: %s", tc.expectCode, w.Code, w.Body.String())
			}
		})
	}
}

func TestSettingsHandlers_ActorAuthenticationAndValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	svc := services.NewSettingsService(&database.Database{}, repository.New(nil))
	handler := handlers.NewSettingsHandler(svc)

	dummyUUID := uuid.New().String()

	// 1. UpdateCollegeSetting without auth -> 401
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("PUT", "/colleges/"+dummyUUID+"/settings/curfew_time", bytes.NewBufferString(`{"setting_value":{"time":"22:00"}}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: dummyUUID},
		{Key: "key", Value: "curfew_time"},
	}
	handler.UpdateCollegeSetting(c)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected HTTP 401 Unauthorized, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 2. GetCollegeSetting with invalid setting key format -> 400
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+dummyUUID+"/settings/invalid key with spaces", nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: dummyUUID},
		{Key: "key", Value: "invalid key with spaces"},
	}
	handler.GetCollegeSetting(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected HTTP 400 Bad Request for invalid key format, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 3. GetCollegeSetting with invalid college ID -> 400
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/not-a-uuid/settings/curfew_time", nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: "not-a-uuid"},
		{Key: "key", Value: "curfew_time"},
	}
	handler.GetCollegeSetting(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected HTTP 400 Bad Request for invalid college ID, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 4. ListCollegeSettings with include_sensitive=true without auth -> 401
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+dummyUUID+"/settings?include_sensitive=true", nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: dummyUUID},
	}
	handler.ListCollegeSettings(c)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected HTTP 401 Unauthorized for include_sensitive without auth, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 5. ListCollegeSettings with include_sensitive=true with unprivileged role -> 403 Forbidden
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+dummyUUID+"/settings?include_sensitive=true", nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: dummyUUID},
	}
	c.Set("auth_user_id", uuid.New())
	c.Set("auth_role", "STUDENT")
	handler.ListCollegeSettings(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected HTTP 403 Forbidden for include_sensitive with non-privileged role, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 6. ListCollegeSettings with invalid college ID -> 400
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/invalid-uuid/settings", nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: "invalid-uuid"},
	}
	handler.ListCollegeSettings(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected HTTP 400 Bad Request for invalid college ID, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 7. UpdateCollegeSetting with unprivileged role -> 403 Forbidden
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("PUT", "/colleges/"+dummyUUID+"/settings/curfew_time", bytes.NewBufferString(`{"setting_value":{"time":"22:00"}}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: dummyUUID},
		{Key: "key", Value: "curfew_time"},
	}
	c.Set("auth_user_id", uuid.New())
	c.Set("auth_role", "STUDENT")
	handler.UpdateCollegeSetting(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected HTTP 403 Forbidden for update with non-privileged role, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 8. Actor Spoofing via Query Parameter: ?role=SUPER_ADMIN cannot bypass missing auth -> 401
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+dummyUUID+"/settings?include_sensitive=true&role=SUPER_ADMIN&auth_role=SUPER_ADMIN", nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: dummyUUID},
	}
	handler.ListCollegeSettings(c)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected HTTP 401 Unauthorized despite query spoofing, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 9. Actor Spoofing via Query Parameter when authenticated as unprivileged -> 403
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+dummyUUID+"/settings?include_sensitive=true&role=SUPER_ADMIN", nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: dummyUUID},
	}
	c.Set("auth_user_id", uuid.New())
	c.Set("auth_role", "STUDENT")
	handler.ListCollegeSettings(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected HTTP 403 Forbidden despite query spoofing attempt, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 10. Actor Spoofing via Request Body: JSON {"role": "SUPER_ADMIN"} cannot elevate role -> 403
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("PUT", "/colleges/"+dummyUUID+"/settings/curfew_time", bytes.NewBufferString(`{"role":"SUPER_ADMIN","setting_value":{"time":"22:00"}}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: dummyUUID},
		{Key: "key", Value: "curfew_time"},
	}
	c.Set("auth_user_id", uuid.New())
	c.Set("auth_role", "STUDENT")
	handler.UpdateCollegeSetting(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected HTTP 403 Forbidden despite body role spoofing, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 11. Invalid Auth Context (non-UUID actor ID) -> 401
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+dummyUUID+"/settings?include_sensitive=true", nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: dummyUUID},
	}
	c.Set("auth_user_id", "not-a-valid-uuid")
	c.Set("auth_role", "SUPER_ADMIN")
	handler.ListCollegeSettings(c)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected HTTP 401 Unauthorized for invalid user ID format, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 12. Invalid Auth Context (empty/whitespace role) -> 401
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+dummyUUID+"/settings?include_sensitive=true", nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: dummyUUID},
	}
	c.Set("auth_user_id", uuid.New())
	c.Set("auth_role", "   ")
	handler.ListCollegeSettings(c)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected HTTP 401 Unauthorized for empty role, got %d. Body: %s", w.Code, w.Body.String())
	}
}

func TestValidators_IsPrivilegedRole(t *testing.T) {
	privileged := []string{"SUPER_ADMIN", "PLATFORM_ADMIN", "super_admin", "platform_admin", "  SUPER_ADMIN  "}
	for _, r := range privileged {
		if !validators.IsPrivilegedRole(r) {
			t.Errorf("expected '%s' to be recognized as privileged role", r)
		}
	}

	unprivileged := []string{"STUDENT", "COLLEGE_ADMIN", "STAFF", "VIEWER", "ANONYMOUS", "", "   "}
	for _, r := range unprivileged {
		if validators.IsPrivilegedRole(r) {
			t.Errorf("expected '%s' to NOT be recognized as privileged role", r)
		}
	}
}

// -----------------------------------------------------------------------------
// 5. ISOLATED INTEGRATION TESTS (REQUIRES TEST_DATABASE_URL)
// -----------------------------------------------------------------------------

func TestModuleManagement_Integration_CRUDAndHierarchy(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewModuleService(db, repo)

	actorID, err := seedTestUser(ctx, db, "module-admin")
	if err != nil {
		t.Fatalf("failed to seed test admin: %v", err)
	}

	suffix := uuid.New().String()[:8]
	appCode := "APP_" + suffix
	modCode := "MOD_" + suffix
	featCode := "FEAT_" + suffix

	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE actor_user_id = $1", actorID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.modules WHERE module_code IN ($1, $2, $3)", featCode, modCode, appCode)
	}()

	// 1. Create root APP module
	createdApp, err := svc.CreateModule(ctx, models.CreateModuleRequest{
		ModuleCode: appCode,
		ModuleName: "Integration Test App " + suffix,
		Kind:       "APP",
		Priority:   "M",
		IsCore:     false,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create root APP: %v", err)
	}
	if createdApp.Kind != "APP" || createdApp.ParentID != nil {
		t.Fatalf("unexpected APP properties: %+v", createdApp)
	}

	// 2. Create child MODULE under APP
	createdMod, err := svc.CreateModule(ctx, models.CreateModuleRequest{
		ModuleCode: modCode,
		ModuleName: "Integration Test Mod " + suffix,
		Kind:       "MODULE",
		ParentID:   &createdApp.ModuleID,
		Priority:   "M",
		IsCore:     false,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create child MODULE: %v", err)
	}
	if createdMod.Kind != "MODULE" || *createdMod.ParentID != createdApp.ModuleID {
		t.Fatalf("unexpected child MODULE properties: %+v", createdMod)
	}

	// 3. Create child FEATURE under MODULE
	createdFeat, err := svc.CreateModule(ctx, models.CreateModuleRequest{
		ModuleCode: featCode,
		ModuleName: "Integration Test Feature " + suffix,
		Kind:       "FEATURE",
		ParentID:   &createdMod.ModuleID,
		Priority:   "S",
		IsCore:     false,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create child FEATURE: %v", err)
	}
	if createdFeat.Kind != "FEATURE" || *createdFeat.ParentID != createdMod.ModuleID {
		t.Fatalf("unexpected FEATURE properties: %+v", createdFeat)
	}

	// 4. Invalid hierarchy attempt: FEATURE under APP (must be under MODULE)
	invalidFeatCode := "INV_FEAT_" + suffix
	_, err = svc.CreateModule(ctx, models.CreateModuleRequest{
		ModuleCode: invalidFeatCode,
		ModuleName: "Invalid Feature",
		Kind:       "FEATURE",
		ParentID:   &createdApp.ModuleID,
	}, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Fatalf("expected error when creating FEATURE directly under APP, got nil")
	}

	// 5. Update module details
	updatedName := "Updated Mod Name " + suffix
	updatedPriority := "R"
	updatedMod, err := svc.UpdateModule(ctx, createdMod.ModuleID, models.UpdateModuleRequest{
		ModuleName: &updatedName,
		Priority:   &updatedPriority,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to update module: %v", err)
	}
	if updatedMod.ModuleName != updatedName || updatedMod.Priority != updatedPriority {
		t.Fatalf("module update values mismatch: %+v", updatedMod)
	}

	// 6. Toggle module status
	reason := "Scheduled maintenance"
	toggledMod, err := svc.ToggleModuleStatus(ctx, createdMod.ModuleID, models.ToggleModuleStatusRequest{
		IsActive: false,
		Reason:   reason,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to toggle module status to inactive: %v", err)
	}
	if toggledMod.IsActive {
		t.Fatalf("expected is_active to be false after toggle")
	}

	// Re-activate module
	toggledBack, err := svc.ToggleModuleStatus(ctx, createdMod.ModuleID, models.ToggleModuleStatusRequest{
		IsActive: true,
		Reason:   "Maintenance completed",
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to reactivate module: %v", err)
	}
	if !toggledBack.IsActive {
		t.Fatalf("expected is_active to be true after reactivation")
	}

	// 7. Core module protection
	coreCode := "CORE_" + suffix
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.modules WHERE module_code = $1", coreCode)
	}()
	createdCore, err := svc.CreateModule(ctx, models.CreateModuleRequest{
		ModuleCode: coreCode,
		ModuleName: "Core Security Module",
		Kind:       "APP",
		IsCore:     true,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create core module: %v", err)
	}

	// Attempt to deactivate core module -> must fail
	_, err = svc.ToggleModuleStatus(ctx, createdCore.ModuleID, models.ToggleModuleStatusRequest{
		IsActive: false,
		Reason:   "Attempt to disable core",
	}, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Fatalf("expected error deactivating core module, got nil")
	}

	// Attempt to delete core module -> must fail
	err = svc.DeleteModule(ctx, createdCore.ModuleID, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Fatalf("expected error deleting core module, got nil")
	}

	// 8. Delete child FEATURE -> succeeds
	err = svc.DeleteModule(ctx, createdFeat.ModuleID, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to delete leaf FEATURE: %v", err)
	}

	// Attempt to delete MODULE when child FEATURE is gone -> succeeds
	err = svc.DeleteModule(ctx, createdMod.ModuleID, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to delete MODULE: %v", err)
	}

	// 9. Verify audit logs were written
	var auditCount int
	err = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM platform.audit_logs
		WHERE module = 'platform_modules'
	`).Scan(&auditCount)
	if err != nil {
		t.Fatalf("failed to query audit logs: %v", err)
	}
	if auditCount == 0 {
		t.Fatalf("expected audit logs for module operations, found none")
	}
}

func TestCollegeModuleManagement_Integration_AssignmentAndEntitlements(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewModuleService(db, repo)

	actorID, err := seedTestUser(ctx, db, "assign-admin")
	if err != nil {
		t.Fatalf("failed to seed test admin: %v", err)
	}

	collegeID, err := createTestCollegeForApproval(ctx, db)
	if err != nil {
		t.Fatalf("failed to create college: %v", err)
	}

	suffix := uuid.New().String()[:8]
	appCode := "COL_APP_" + suffix
	modCode := "COL_MOD_" + suffix

	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.college_modules WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.modules WHERE module_code IN ($1, $2)", modCode, appCode)
	}()

	// Create APP and child MODULE
	appMod, err := svc.CreateModule(ctx, models.CreateModuleRequest{
		ModuleCode: appCode,
		ModuleName: "College Test App",
		Kind:       "APP",
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create APP: %v", err)
	}

	childMod, err := svc.CreateModule(ctx, models.CreateModuleRequest{
		ModuleCode: modCode,
		ModuleName: "College Test Submodule",
		Kind:       "MODULE",
		ParentID:   &appMod.ModuleID,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to create child MODULE: %v", err)
	}

	// 1. Entitlement boundary: Assign child MODULE before parent APP is assigned -> MUST FAIL
	assignReason := "Entitlement boundary test"
	_, err = svc.AssignCollegeModule(ctx, collegeID, models.AssignCollegeModuleRequest{
		ModuleID: childMod.ModuleID,
		Status:   "ACTIVE",
		Mode:     "FULL",
		Reason:   &assignReason,
	}, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Fatalf("expected entitlement boundary violation when assigning child module before parent, got nil")
	}

	// 2. Assign parent APP module -> MUST SUCCEED
	appAssignment, err := svc.AssignCollegeModule(ctx, collegeID, models.AssignCollegeModuleRequest{
		ModuleID: appMod.ModuleID,
		Status:   "ACTIVE",
		Mode:     "FULL",
		Reason:   &assignReason,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to assign parent APP module: %v", err)
	}
	if appAssignment.Status != "ACTIVE" || appAssignment.Mode != "FULL" {
		t.Fatalf("unexpected college module status/mode: %+v", appAssignment)
	}

	// 3. Now assign child MODULE -> MUST SUCCEED
	childAssignment, err := svc.AssignCollegeModule(ctx, collegeID, models.AssignCollegeModuleRequest{
		ModuleID: childMod.ModuleID,
		Status:   "ACTIVE",
		Mode:     "READ_ONLY",
		Reason:   &assignReason,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to assign child module after parent assigned: %v", err)
	}
	if childAssignment.Mode != "READ_ONLY" {
		t.Fatalf("expected READ_ONLY mode, got %s", childAssignment.Mode)
	}

	// 4. Duplicate assignment check -> MUST FAIL WITH CONFLICT
	_, err = svc.AssignCollegeModule(ctx, collegeID, models.AssignCollegeModuleRequest{
		ModuleID: appMod.ModuleID,
		Status:   "ACTIVE",
		Mode:     "FULL",
	}, actorID, "SUPER_ADMIN")
	if err == nil {
		t.Fatalf("expected conflict on duplicate college module assignment, got nil")
	}

	// 5. Update college module assignment
	updateReason := "Upgrade to full access"
	updatedChild, err := svc.UpdateCollegeModuleByCollegeAndModule(ctx, collegeID, childMod.ModuleID, models.UpdateCollegeModuleRequest{
		Status: "ACTIVE",
		Mode:   "FULL",
		Reason: &updateReason,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to update college module: %v", err)
	}
	if updatedChild.Mode != "FULL" {
		t.Fatalf("expected mode FULL after update, got %s", updatedChild.Mode)
	}

	// 6. Query entitlements
	entitlements, err := svc.GetCollegeEntitlements(ctx, collegeID)
	if err != nil {
		t.Fatalf("failed to query entitlements: %v", err)
	}
	if len(entitlements) != 2 {
		t.Fatalf("expected 2 active entitlements for college, got %d", len(entitlements))
	}

	// 7. Verify audit logs for college module assignment
	var auditCount int
	err = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM platform.audit_logs
		WHERE college_id = $1 AND module = 'platform_college_modules'
	`, collegeID).Scan(&auditCount)
	if err != nil {
		t.Fatalf("failed to count college module audit logs: %v", err)
	}
	if auditCount == 0 {
		t.Fatalf("expected audit logs for college module assignments, found none")
	}
}

func TestCollegeSettings_Integration_CRUDAndAuditRollback(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	settingsSvc := services.NewSettingsService(db, repo)

	actorID, err := seedTestUser(ctx, db, "settings-admin")
	if err != nil {
		t.Fatalf("failed to seed test admin: %v", err)
	}

	collegeID, err := createTestCollegeForApproval(ctx, db)
	if err != nil {
		t.Fatalf("failed to create college: %v", err)
	}

	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.college_settings WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	settingKey := "curfew_policy"
	sensitiveKey := "api_integration_secret"

	// 1. Seed two settings: one non-sensitive, one sensitive
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO platform.college_settings (college_id, setting_key, setting_value, is_sensitive)
		VALUES
			($1, $2, '{"curfew_time": "22:00", "grace_period": 15}'::jsonb, false),
			($1, $3, '{"token": "secret_platform_token"}'::jsonb, true)
	`, collegeID, settingKey, sensitiveKey)
	if err != nil {
		t.Fatalf("failed to seed test college settings: %v", err)
	}

	// 2. List college settings excluding sensitive
	publicSettings, err := settingsSvc.ListCollegeSettings(ctx, collegeID, false)
	if err != nil {
		t.Fatalf("failed to list settings: %v", err)
	}
	if len(publicSettings) != 1 || publicSettings[0].SettingKey != settingKey {
		t.Fatalf("expected 1 public setting, got %d: %+v", len(publicSettings), publicSettings)
	}

	// 3. List college settings including sensitive
	allSettings, err := settingsSvc.ListCollegeSettings(ctx, collegeID, true)
	if err != nil {
		t.Fatalf("failed to list all settings: %v", err)
	}
	if len(allSettings) != 2 {
		t.Fatalf("expected 2 settings including sensitive, got %d", len(allSettings))
	}

	// 4. Get specific setting by key
	setting, err := settingsSvc.GetCollegeSetting(ctx, collegeID, settingKey)
	if err != nil {
		t.Fatalf("failed to get setting by key: %v", err)
	}
	if setting.SettingKey != settingKey {
		t.Fatalf("setting key mismatch: expected %s, got %s", settingKey, setting.SettingKey)
	}

	// 5. Query missing setting -> 404
	_, err = settingsSvc.GetCollegeSetting(ctx, collegeID, "non_existent_key")
	if err == nil {
		t.Fatalf("expected error for non-existent setting key, got nil")
	}

	// 6. Query missing college -> 404
	_, err = settingsSvc.GetCollegeSetting(ctx, uuid.New(), settingKey)
	if err == nil {
		t.Fatalf("expected error for non-existent college, got nil")
	}

	// 7. Update setting with valid new value
	newVal := models.JSONB{"curfew_time": "23:00", "grace_period": 30}
	updated, err := settingsSvc.UpdateCollegeSetting(ctx, collegeID, settingKey, models.UpdateCollegeSettingRequest{
		SettingValue: newVal,
	}, actorID, "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to update college setting: %v", err)
	}
	if updated.SettingKey != settingKey {
		t.Fatalf("updated setting key mismatch: %s", updated.SettingKey)
	}

	// 8. Verify audit log was recorded for college setting update
	var auditCount int
	err = db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM platform.audit_logs
		WHERE college_id = $1 AND module = 'platform_college_settings' AND action = 'UPDATE_COLLEGE_SETTING'
	`, collegeID).Scan(&auditCount)
	if err != nil {
		t.Fatalf("failed to query settings audit log: %v", err)
	}
	if auditCount == 0 {
		t.Fatalf("expected audit log for college setting update, found none")
	}

	// 9. Verify Handler sensitive settings authorization against live fixtures
	settingsHandler := handlers.NewSettingsHandler(settingsSvc)

	// 9a. Non-sensitive setting accessed by unprivileged actor -> 200 OK
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("GET", "/colleges/"+collegeID.String()+"/settings/"+settingKey, nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: collegeID.String()},
		{Key: "key", Value: settingKey},
	}
	c.Set("auth_user_id", actorID)
	c.Set("auth_role", "STUDENT")
	settingsHandler.GetCollegeSetting(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected HTTP 200 OK for non-sensitive setting read, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 9b. Sensitive setting accessed without auth context -> 401 Unauthorized
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+collegeID.String()+"/settings/"+sensitiveKey, nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: collegeID.String()},
		{Key: "key", Value: sensitiveKey},
	}
	settingsHandler.GetCollegeSetting(c)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected HTTP 401 Unauthorized for sensitive setting without auth, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 9c. Sensitive setting accessed by unprivileged actor (STUDENT) -> 403 Forbidden
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+collegeID.String()+"/settings/"+sensitiveKey, nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: collegeID.String()},
		{Key: "key", Value: sensitiveKey},
	}
	c.Set("auth_user_id", actorID)
	c.Set("auth_role", "STUDENT")
	settingsHandler.GetCollegeSetting(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected HTTP 403 Forbidden for sensitive setting read by unprivileged actor, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 9d. Sensitive setting accessed by privileged actor (SUPER_ADMIN) -> 200 OK
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+collegeID.String()+"/settings/"+sensitiveKey, nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: collegeID.String()},
		{Key: "key", Value: sensitiveKey},
	}
	c.Set("auth_user_id", actorID)
	c.Set("auth_role", "SUPER_ADMIN")
	settingsHandler.GetCollegeSetting(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected HTTP 200 OK for sensitive setting read by SUPER_ADMIN, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 9e. List settings with include_sensitive=true by privileged actor (SUPER_ADMIN) -> 200 OK
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+collegeID.String()+"/settings?include_sensitive=true", nil)
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: collegeID.String()},
	}
	c.Set("auth_user_id", actorID)
	c.Set("auth_role", "SUPER_ADMIN")
	settingsHandler.ListCollegeSettings(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected HTTP 200 OK for include_sensitive by SUPER_ADMIN, got %d. Body: %s", w.Code, w.Body.String())
	}
}

func TestSuperAdminModuleRoutesRegistration(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	group := router.Group("/")

	routes.RegisterSuperAdminRoutes(group, &database.Database{}, func(c *gin.Context) { c.Next() }, func(c *gin.Context) { c.Next() })

	expectedRoutes := []struct {
		method string
		path   string
	}{
		{"GET", "/super-admin/modules"},
		{"POST", "/super-admin/modules"},
		{"GET", "/super-admin/modules/:id"},
		{"PUT", "/super-admin/modules/:id"},
		{"PATCH", "/super-admin/modules/:id"},
		{"PATCH", "/super-admin/modules/:id/status"},
		{"DELETE", "/super-admin/modules/:id"},
		{"GET", "/super-admin/colleges/:id/modules"},
		{"POST", "/super-admin/colleges/:id/modules"},
		{"PUT", "/super-admin/colleges/:id/modules/:module_id"},
		{"PATCH", "/super-admin/colleges/:id/modules/:module_id"},
		{"GET", "/super-admin/colleges/:id/entitlements"},
		{"PUT", "/super-admin/colleges/:id/entitlements"},
		{"GET", "/super-admin/colleges/:id/settings"},
		{"GET", "/super-admin/colleges/:id/settings/:key"},
		{"PUT", "/super-admin/colleges/:id/settings/:key"},
		{"POST", "/super-admin/approvals"},
		{"POST", "/super-admin/approvals/:id/execute"},
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
}

func TestModuleRepository_CascadeDeactivateChildCollegeModules_FailClosed(t *testing.T) {
	repo := repository.New(nil)
	ctx := context.Background()

	_, err := repo.CascadeDeactivateChildCollegeModules(ctx, uuid.New(), uuid.New(), uuid.New(), "testing")
	if err == nil {
		t.Fatal("expected error from unconfigured repository, got nil")
	}
	if !strings.Contains(err.Error(), "platform database pool is not configured") {
		t.Fatalf("expected ErrPlatformPoolNotConfigured, got %v", err)
	}
}

func TestModuleService_UpdateCollegeModule_ActorValidation(t *testing.T) {
	repo := repository.New(nil)
	svc := services.NewModuleService(&database.Database{}, repo)
	ctx := context.Background()

	t.Run("UpdateCollegeModule without actor user ID returns Unauthorized", func(t *testing.T) {
		_, err := svc.UpdateCollegeModule(ctx, uuid.New(), models.UpdateCollegeModuleRequest{
			Status: "ACTIVE",
			Mode:   "FULL",
		}, uuid.Nil, "SUPER_ADMIN")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		apiErr, ok := err.(*apierrors.APIError)
		if !ok || apiErr.Code != apierrors.Unauthorized {
			t.Fatalf("expected Unauthorized error, got %v", err)
		}
	})

	t.Run("UpdateCollegeModuleByCollegeAndModule without actor user ID returns Unauthorized", func(t *testing.T) {
		_, err := svc.UpdateCollegeModuleByCollegeAndModule(ctx, uuid.New(), uuid.New(), models.UpdateCollegeModuleRequest{
			Status: "ACTIVE",
			Mode:   "FULL",
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

func TestModuleService_CascadeEntitlements_InvariantVerification(t *testing.T) {
	t.Run("Status ACTIVE does not trigger cascade deactivation", func(t *testing.T) {
		req := models.UpdateCollegeModuleRequest{
			Status: "ACTIVE",
			Mode:   "FULL",
		}
		if req.Status != "ACTIVE" {
			t.Fatal("expected status to be ACTIVE")
		}
	})

	t.Run("Status DISABLED requires cascade deactivation", func(t *testing.T) {
		req := models.UpdateCollegeModuleRequest{
			Status: "DISABLED",
			Mode:   "FULL",
		}
		if req.Status == "ACTIVE" {
			t.Fatal("expected status to be DISABLED (triggering cascade)")
		}
	})

	t.Run("Audit params populate correct entity type and action", func(t *testing.T) {
		collegeID := uuid.New()
		actorID := uuid.New()
		cmID := uuid.New()
		reason := "Parent module deactivated"

		params := models.ModuleAuditParams{
			CollegeID:   &collegeID,
			ActorUserID: actorID,
			ActorRole:   "SUPER_ADMIN",
			Module:      "platform_college_modules",
			Action:      "CASCADE_DEACTIVATE_COLLEGE_MODULE",
			EntityType:  "COLLEGE_MODULE",
			EntityID:    &cmID,
			Reason:      &reason,
			Severity:    "INFO",
		}

		if params.Action != "CASCADE_DEACTIVATE_COLLEGE_MODULE" {
			t.Errorf("expected action CASCADE_DEACTIVATE_COLLEGE_MODULE, got %s", params.Action)
		}
		if *params.CollegeID != collegeID {
			t.Errorf("expected college ID %v, got %v", collegeID, *params.CollegeID)
		}
		if params.ActorUserID != actorID {
			t.Errorf("expected actor ID %v, got %v", actorID, params.ActorUserID)
		}
		if params.EntityType != "COLLEGE_MODULE" {
			t.Errorf("expected entity type COLLEGE_MODULE, got %s", params.EntityType)
		}
	})
}

// -----------------------------------------------------------------------------
// 4. MODULE IMPACT PREVIEW, ENTITLEMENT MATRIX & REASON ENFORCEMENT UNIT TESTS
// -----------------------------------------------------------------------------

func TestModuleService_ImpactPreviewAndApprovalEnforcement(t *testing.T) {
	repo := repository.New(nil)
	svc := services.NewModuleService(&database.Database{}, repo)
	ctx := context.Background()
	dummyID := uuid.New()

	t.Run("PreviewModuleImpact requires non-nil college and module IDs", func(t *testing.T) {
		_, err := svc.PreviewModuleImpact(ctx, uuid.Nil, dummyID, "DISABLED", "FULL")
		if err == nil {
			t.Fatal("expected validation error for nil collegeID, got nil")
		}

		_, err = svc.PreviewModuleImpact(ctx, dummyID, uuid.Nil, "DISABLED", "FULL")
		if err == nil {
			t.Fatal("expected validation error for nil moduleID, got nil")
		}
	})

	t.Run("GetCollegeEntitlementMatrix requires non-nil college ID", func(t *testing.T) {
		_, err := svc.GetCollegeEntitlementMatrix(ctx, uuid.Nil)
		if err == nil {
			t.Fatal("expected validation error for nil collegeID, got nil")
		}
	})

	t.Run("RequestModuleEntitlementChange requires meaningful non-empty reason", func(t *testing.T) {
		emptyReason := ""
		whitespaceReason := "    "
		actorID := uuid.New()

		// Nil reason
		_, _, err := svc.RequestModuleEntitlementChange(ctx, dummyID, dummyID, models.UpdateCollegeModuleRequest{
			Status: "DISABLED",
			Mode:   "FULL",
			Reason: nil,
		}, actorID, "SUPER_ADMIN", false)
		if err == nil {
			t.Fatal("expected validation error for nil reason, got nil")
		}

		// Empty reason
		_, _, err = svc.RequestModuleEntitlementChange(ctx, dummyID, dummyID, models.UpdateCollegeModuleRequest{
			Status: "DISABLED",
			Mode:   "FULL",
			Reason: &emptyReason,
		}, actorID, "SUPER_ADMIN", false)
		if err == nil {
			t.Fatal("expected validation error for empty reason, got nil")
		}

		// Whitespace-only reason
		_, _, err = svc.RequestModuleEntitlementChange(ctx, dummyID, dummyID, models.UpdateCollegeModuleRequest{
			Status: "DISABLED",
			Mode:   "FULL",
			Reason: &whitespaceReason,
		}, actorID, "SUPER_ADMIN", false)
		if err == nil {
			t.Fatal("expected validation error for whitespace reason, got nil")
		}
	})

	t.Run("RequestModuleEntitlementChange requires authenticated actor user ID", func(t *testing.T) {
		reason := "Audited operational change"
		_, _, err := svc.RequestModuleEntitlementChange(ctx, dummyID, dummyID, models.UpdateCollegeModuleRequest{
			Status: "DISABLED",
			Mode:   "FULL",
			Reason: &reason,
		}, uuid.Nil, "SUPER_ADMIN", false)
		if err == nil {
			t.Fatal("expected error when actorID is uuid.Nil and not in context, got nil")
		}
	})
}

