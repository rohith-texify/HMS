package tests

import (
	"context"
	"encoding/json"
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
// 1. VALIDATOR UNIT TESTS
// -----------------------------------------------------------------------------

func TestDashboardValidator_ValidDatesAndCollege(t *testing.T) {
	collegeUUID := uuid.New().String()

	// 1. Valid RFC3339
	params, err := validators.ValidateDashboardFilterParams(
		"2026-01-01T00:00:00Z",
		"2026-01-31T23:59:59Z",
		collegeUUID,
	)
	if err != nil {
		t.Fatalf("expected valid params, got: %v", err)
	}
	if params.StartDate == nil || params.EndDate == nil || params.CollegeID == nil {
		t.Fatalf("expected all fields populated, got: %+v", params)
	}
	if params.CollegeID.String() != collegeUUID {
		t.Errorf("expected college_id %s, got %s", collegeUUID, params.CollegeID.String())
	}

	// 2. Valid YYYY-MM-DD
	params2, err := validators.ValidateDashboardFilterParams(
		"2026-05-01",
		"2026-05-15",
		"",
	)
	if err != nil {
		t.Fatalf("expected valid params for YYYY-MM-DD, got: %v", err)
	}
	if params2.StartDate == nil || params2.EndDate == nil {
		t.Fatalf("expected start and end date populated")
	}
	if params2.CollegeID != nil {
		t.Errorf("expected nil college_id, got %v", params2.CollegeID)
	}
	// Verify end date was adjusted to end of day
	if params2.EndDate.Hour() != 23 || params2.EndDate.Minute() != 59 {
		t.Errorf("expected end of day 23:59, got %02d:%02d", params2.EndDate.Hour(), params2.EndDate.Minute())
	}

	// 3. Empty parameters -> all nil
	params3, err := validators.ValidateDashboardFilterParams("", "", "")
	if err != nil {
		t.Fatalf("expected empty params to succeed, got: %v", err)
	}
	if params3.StartDate != nil || params3.EndDate != nil || params3.CollegeID != nil {
		t.Errorf("expected all fields nil, got: %+v", params3)
	}
}

func TestDashboardValidator_Rejections(t *testing.T) {
	// 1. Invalid start date format
	_, err := validators.ValidateDashboardFilterParams("2026/01/01", "2026-01-31", "")
	if err == nil || !strings.Contains(err.Error(), "start_date must be a valid date format") {
		t.Errorf("expected invalid start_date error, got: %v", err)
	}

	// 2. Invalid end date format
	_, err = validators.ValidateDashboardFilterParams("2026-01-01", "not-a-date", "")
	if err == nil || !strings.Contains(err.Error(), "end_date must be a valid date format") {
		t.Errorf("expected invalid end_date error, got: %v", err)
	}

	// 3. start_date after end_date
	_, err = validators.ValidateDashboardFilterParams("2026-06-15", "2026-06-01", "")
	if err == nil || !strings.Contains(err.Error(), "start_date cannot be after end_date") {
		t.Errorf("expected start after end error, got: %v", err)
	}

	// 4. Invalid college UUID
	_, err = validators.ValidateDashboardFilterParams("", "", "not-a-uuid")
	if err == nil || !strings.Contains(err.Error(), "must be a valid UUID") {
		t.Errorf("expected invalid UUID error, got: %v", err)
	}
}

// -----------------------------------------------------------------------------
// 2. SERVICE UNIT TESTS: FAIL-CLOSED AND ISOLATION
// -----------------------------------------------------------------------------

func TestDashboardService_FailClosedOnNilPool(t *testing.T) {
	// A repository with no platform pool
	repo := &repository.Repository{Pool: nil}
	db := &database.Database{
		Pool:         nil,
		CollegePool:  nil,
		PlatformPool: nil,
	}

	svc := services.NewDashboardService(db, repo)
	ctx := context.Background()

	_, err := svc.GetDashboard(ctx, &models.DashboardFilterParams{})
	if err == nil {
		t.Fatal("expected error when PlatformPool is nil, got nil")
	}

	var apiErr *apierrors.APIError
	if apiErr == nil && !strings.Contains(err.Error(), "Platform database connection pool is not configured") {
		t.Errorf("expected missing pool message, got: %v", err)
	}
}

func TestDashboardService_FailClosedOnNilService(t *testing.T) {
	var svc *services.DashboardService
	_, err := svc.GetDashboard(context.Background(), nil)
	if err == nil {
		t.Fatal("expected error when service is nil, got nil")
	}
}

func TestDashboardService_DTOStructureAndUnsupportedMetrics(t *testing.T) {
	resp := models.DashboardResponse{
		GeneratedAt: time.Now().UTC(),
		CollegeSummary: models.CollegeStatusSummary{
			TotalColleges:       10,
			ActiveColleges:      7,
			InactiveColleges:    1,
			SuspendedColleges:   1,
			OnboardingColleges:  1,
			DeactivatedColleges: 1,
			IsCurrentSnapshot:   true,
		},
		EntitlementSummary: models.EntitlementSummary{
			Scope:                "GLOBAL_CATALOG",
			EnabledModules:       12,
			DisabledModules:      2,
			EnabledApplications:  4,
			DisabledApplications: 1,
			TotalFeatures:        25,
			IsCurrentSnapshot:    true,
		},
		CollegeAdminSummary: models.CollegeAdminSummary{
			ActiveCount:       8,
			IsCurrentSnapshot: true,
		},
		ServiceHealth: models.ServiceHealthSummary{
			OverallStatus: "HEALTHY",
			Checks: []models.ServiceHealthCheck{
				{ServiceName: "api_server", Status: "HEALTHY", Message: "Responsive"},
				{ServiceName: "platform_database_pool", Status: "HEALTHY", Message: "Connected"},
			},
		},
		ApprovalSummary: models.ApprovalSummary{
			PendingCount:              3,
			PendingConfigurationCount: 1,
			ConfigurationSourceNote:   "Configuration-change requests are tracked as platform.approval_requests with operation types COLLEGE_SETTING_UPDATE and COLLEGE_MODULE_UPDATE.",
		},
		UnsupportedMetrics: []string{
			"student_level_operational_metrics: strictly excluded from Super Admin scope",
			"standalone_configuration_requests: persisted unified within platform.approval_requests",
			"historical_status_snapshot: college and module status counts are current snapshots",
		},
	}

	// Verify JSON serialization stability
	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("failed to marshal dashboard response: %v", err)
	}

	str := string(data)
	if !strings.Contains(str, "total_colleges") || !strings.Contains(str, "enabled_applications") {
		t.Errorf("expected standard fields in JSON, got: %s", str)
	}
	if strings.Contains(str, "password") || strings.Contains(str, "secret") {
		t.Errorf("security violation: sensitive keys found in JSON output")
	}
}

// -----------------------------------------------------------------------------
// 3. ROUTE REGISTRATION AND HANDLER BOUNDARY
// -----------------------------------------------------------------------------

func TestDashboardRoute_Registration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	group := engine.Group("/")

	passMiddleware := func(c *gin.Context) { c.Next() }

	// Register Super Admin routes through the standard registration mechanism
	routes.RegisterSuperAdminRoutes(group, &database.Database{}, passMiddleware, passMiddleware)

	// Verify route paths exist in the router
	routesFound := map[string]bool{}
	for _, r := range engine.Routes() {
		routesFound[r.Method+" "+r.Path] = true
	}

	expectedRoutes := []string{
		"GET /super-admin/dashboard",
		"GET /super-admin/dashboard/summary",
		"GET /super-admin/colleges",
		"GET /super-admin/approvals",
		"GET /super-admin/modules",
		"GET /super-admin/entitlement-templates",
	}

	for _, expected := range expectedRoutes {
		if !routesFound[expected] {
			t.Errorf("expected route %s to be registered, but it was missing", expected)
		}
	}
}

func TestDashboardHandler_ValidationErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create handler with dummy service
	handler := handlers.NewDashboardHandler(nil)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	// Send invalid start date
	req, _ := http.NewRequest("GET", "/super-admin/dashboard?start_date=invalid-date", nil)
	c.Request = req

	handler.GetDashboard(c)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400 for invalid date, got %d", w.Code)
	}
	if !strings.Contains(w.Body.String(), "VALIDATION_ERROR") {
		t.Errorf("expected VALIDATION_ERROR in response, got: %s", w.Body.String())
	}
}

// -----------------------------------------------------------------------------
// 4. INTEGRATION TEST (RUNS ONLY WHEN TEST_DATABASE_URL IS CONFIGURED)
// -----------------------------------------------------------------------------

func TestDashboard_Integration_FullWorkflow(t *testing.T) {
	db, repo := setupTestDB(t)
	defer db.Pool.Close()

	ctx := context.Background()
	svc := services.NewDashboardService(db, repo)

	// Seed actor and test college
	actorID, err := seedTestUser(ctx, db, "dash-admin")
	if err != nil {
		t.Fatalf("failed to seed test user: %v", err)
	}

	collegeID := uuid.New()
	colCode := "col-dash-" + collegeID.String()[:8]
	_, err = db.Pool.Exec(ctx, `
		INSERT INTO platform.colleges (college_id, college_code, name, status, timezone)
		VALUES ($1, $2, $3, 'ACTIVE', 'UTC')
	`, collegeID, colCode, "Dashboard Test College")
	if err != nil {
		t.Fatalf("failed to insert test college: %v", err)
	}

	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.audit_logs WHERE actor_user_id = $1", actorID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_steps WHERE request_id IN (SELECT request_id FROM platform.approval_requests WHERE college_id = $1)", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.approval_requests WHERE college_id = $1", collegeID)
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	// Query global dashboard
	resp, err := svc.GetDashboard(ctx, &models.DashboardFilterParams{})
	if err != nil {
		t.Fatalf("GetDashboard failed: %v", err)
	}

	if resp.CollegeSummary.TotalColleges == 0 {
		t.Errorf("expected total colleges > 0, got %d", resp.CollegeSummary.TotalColleges)
	}
	if resp.ServiceHealth.OverallStatus != "HEALTHY" {
		t.Errorf("expected HEALTHY overall status, got %s", resp.ServiceHealth.OverallStatus)
	}
	if !resp.CollegeSummary.IsCurrentSnapshot {
		t.Errorf("expected IsCurrentSnapshot to be true")
	}

	// Query college-scoped dashboard
	scopedResp, err := svc.GetDashboard(ctx, &models.DashboardFilterParams{
		CollegeID: &collegeID,
	})
	if err != nil {
		t.Fatalf("GetDashboard with college_id failed: %v", err)
	}

	if scopedResp.CollegeSummary.TotalColleges != 1 {
		t.Errorf("expected 1 college in scoped summary, got %d", scopedResp.CollegeSummary.TotalColleges)
	}
	if scopedResp.EntitlementSummary.Scope != "COLLEGE_TENANT" {
		t.Errorf("expected scope COLLEGE_TENANT, got %s", scopedResp.EntitlementSummary.Scope)
	}
}
