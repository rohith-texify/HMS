package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

// -----------------------------------------------------------------------------
// APPLICATION MANAGEMENT: UNIT & CONTRACT TESTS
// -----------------------------------------------------------------------------

func TestApplicationCatalogue_CompletenessAndProtection(t *testing.T) {
	catalogue := models.DefaultApplicationCatalogue
	if len(catalogue) != 5 {
		t.Fatalf("expected exactly 5 applications in catalogue, got %d", len(catalogue))
	}

	expectedApps := map[string]struct {
		Code        string
		Role        string
		IsProtected bool
	}{
		models.AppStudent:        {Code: "STUDENT_APP", Role: "STUDENT", IsProtected: false},
		models.AppParent:         {Code: "PARENT_APP", Role: "PARENT", IsProtected: false},
		models.AppSecurity:       {Code: "SECURITY_APP", Role: "SECURITY", IsProtected: false},
		models.AppHostelIncharge: {Code: "HOSTEL_INCHARGE_APP", Role: "INCHARGE", IsProtected: false},
		models.AppAdminPortal:    {Code: "ADMIN_PORTAL", Role: "COLLEGE_ADMIN", IsProtected: true},
	}

	for appID, expected := range expectedApps {
		item, found := models.GetCatalogueItem(appID)
		if !found {
			t.Errorf("application %s not found in catalogue", appID)
			continue
		}

		if item.AppCode != expected.Code {
			t.Errorf("[%s] expected code %s, got %s", appID, expected.Code, item.AppCode)
		}
		if item.PrimaryRole != expected.Role {
			t.Errorf("[%s] expected primary role %s, got %s", appID, expected.Role, item.PrimaryRole)
		}
		if item.IsProtected != expected.IsProtected {
			t.Errorf("[%s] expected is_protected=%v, got %v", appID, expected.IsProtected, item.IsProtected)
		}
		if item.DefaultMinVersion == "" {
			t.Errorf("[%s] expected default min version to be non-empty", appID)
		}
		if len(item.AssociatedModules) == 0 {
			t.Errorf("[%s] expected associated modules to be non-empty", appID)
		}
	}
}

func TestApplicationRoleMapping(t *testing.T) {
	testCases := []struct {
		Role     string
		Expected string
	}{
		{"STUDENT", models.AppStudent},
		{"PARENT", models.AppParent},
		{"SECURITY", models.AppSecurity},
		{"INCHARGE", models.AppHostelIncharge},
		{"HOSTEL_INCHARGE", models.AppHostelIncharge},
		{"COLLEGE_ADMIN", models.AppAdminPortal},
		{"HOSTEL_ADMIN", models.AppAdminPortal},
		{"UNKNOWN_ROLE", ""},
		{"", ""},
	}

	for _, tc := range testCases {
		res := models.MapRoleToAppID(tc.Role)
		if res != tc.Expected {
			t.Errorf("role '%s': expected app '%s', got '%s'", tc.Role, tc.Expected, res)
		}
	}
}

func TestApplication_SemVerComparison(t *testing.T) {
	// Numeric vs Lexicographical:
	// "1.10.0" > "1.9.0" numerically, even though "1.9.0" > "1.10.0" lexicographically
	cmp, err := models.CompareSemVer("1.10.0", "1.9.0")
	if err != nil {
		t.Fatalf("unexpected error comparing versions: %v", err)
	}
	if cmp != 1 {
		t.Errorf("expected 1.10.0 > 1.9.0 (cmp=1), got %d", cmp)
	}

	cmp, err = models.CompareSemVer("1.9.0", "1.10.0")
	if err != nil {
		t.Fatalf("unexpected error comparing versions: %v", err)
	}
	if cmp != -1 {
		t.Errorf("expected 1.9.0 < 1.10.0 (cmp=-1), got %d", cmp)
	}

	// Major difference
	cmp, err = models.CompareSemVer("2.0.0", "1.99.99")
	if err != nil || cmp != 1 {
		t.Errorf("expected 2.0.0 > 1.99.99, got cmp=%d err=%v", cmp, err)
	}

	// Minor difference
	cmp, err = models.CompareSemVer("1.2.0", "1.1.99")
	if err != nil || cmp != 1 {
		t.Errorf("expected 1.2.0 > 1.1.99, got cmp=%d err=%v", cmp, err)
	}

	// Patch difference
	cmp, err = models.CompareSemVer("1.2.3", "1.2.2")
	if err != nil || cmp != 1 {
		t.Errorf("expected 1.2.3 > 1.2.2, got cmp=%d err=%v", cmp, err)
	}

	// Equal versions
	cmp, err = models.CompareSemVer("1.2.3", "1.2.3")
	if err != nil || cmp != 0 {
		t.Errorf("expected 1.2.3 == 1.2.3, got cmp=%d err=%v", cmp, err)
	}

	// Version with 'v' prefix
	cmp, err = models.CompareSemVer("v1.2.3", "1.2.3")
	if err != nil || cmp != 0 {
		t.Errorf("expected v1.2.3 == 1.2.3, got cmp=%d err=%v", cmp, err)
	}

	// Malformed versions
	malformed := []string{"", "abc", "1.", "1.2.3.4", "v-1.0", "1.x.3"}
	for _, m := range malformed {
		_, _, _, err := models.ParseSemVer(m)
		if err == nil {
			t.Errorf("expected error for malformed version '%s', got nil", m)
		}
	}
}

func TestApplication_AdminPortalProtection(t *testing.T) {
	// Without database handles, testing invariant directly on service
	svc := services.NewApplicationService(nil, nil)
	dummyCollegeID := uuid.New()
	dummyActorID := uuid.New()
	reason := "Testing admin portal protection"

	// 1. Attempt to disable Admin Portal
	_, err := svc.DisableApplication(
		context.Background(),
		dummyCollegeID,
		models.AppAdminPortal,
		dummyActorID,
		"SUPER_ADMIN",
		&reason,
	)
	if err == nil {
		t.Fatal("expected error attempting to disable Admin/Management Portal, got nil")
	}

	// 2. Attempt to suspend Admin Portal
	_, err = svc.SuspendApplication(
		context.Background(),
		dummyCollegeID,
		models.AppAdminPortal,
		dummyActorID,
		"SUPER_ADMIN",
		&reason,
	)
	if err == nil {
		t.Fatal("expected error attempting to suspend Admin/Management Portal, got nil")
	}
}

func TestApplicationHandler_CatalogueEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := services.NewApplicationService(nil, nil)
	handler := handlers.NewApplicationHandler(svc)

	router := gin.New()
	router.GET("/super-admin/applications/catalogue", handler.GetCatalogue)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/super-admin/applications/catalogue", nil)
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}

	var resp struct {
		Success bool                              `json:"success"`
		Data    []models.ApplicationCatalogueItem `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if !resp.Success {
		t.Errorf("expected success=true, got false")
	}
	if len(resp.Data) != 5 {
		t.Fatalf("expected 5 items in catalogue, got %d", len(resp.Data))
	}
}

func TestApplicationHandler_ValidationErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := services.NewApplicationService(nil, nil)
	handler := handlers.NewApplicationHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("auth_user_id", uuid.New())
		c.Set("auth_role", "SUPER_ADMIN")
		c.Next()
	})
	router.GET("/super-admin/colleges/:id/applications", handler.ListCollegeApplications)
	router.POST("/super-admin/colleges/:id/applications/:app_id/disable", handler.DisableApplication)
	router.PUT("/super-admin/colleges/:id/applications/:app_id/version", handler.UpdateVersion)

	// 1. Invalid College UUID format
	w := httptest.NewRecorder()
	req, _ := http.NewRequest(http.MethodGet, "/super-admin/colleges/not-a-uuid/applications", nil)
	router.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for invalid UUID, got %d", w.Code)
	}

	// 2. Reject Admin Portal disablement through HTTP endpoint
	validUUID := uuid.New().String()
	w = httptest.NewRecorder()
	reqBody := bytes.NewBufferString(`{"reason":"Should be blocked"}`)
	req, _ = http.NewRequest(http.MethodPost, "/super-admin/colleges/"+validUUID+"/applications/"+models.AppAdminPortal+"/disable", reqBody)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusConflict && w.Code != http.StatusBadRequest {
		t.Errorf("expected 409 Conflict when attempting to disable Admin Portal, got %d", w.Code)
	}

	// 3. Invalid version payload on UpdateVersion
	w = httptest.NewRecorder()
	badVersionBody := bytes.NewBufferString(`{"min_version":""}`)
	req, _ = http.NewRequest(http.MethodPut, "/super-admin/colleges/"+validUUID+"/applications/student_app/version", badVersionBody)
	req.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400 Bad Request for empty min_version, got %d", w.Code)
	}
}
