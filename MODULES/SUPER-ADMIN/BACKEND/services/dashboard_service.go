package services

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

// DashboardService coordinates data gathering and assembly for the Super Admin Dashboard.
type DashboardService struct {
	repo *repository.Repository
	db   *database.Database
}

// NewDashboardService creates a new DashboardService.
func NewDashboardService(
	db *database.Database,
	repo *repository.Repository,
) *DashboardService {
	return &DashboardService{
		repo: repo,
		db:   db,
	}
}

// GetDashboard retrieves complete dashboard statistics, activities, alerts, and health.
func (s *DashboardService) GetDashboard(
	ctx context.Context,
	filters *models.DashboardFilterParams,
) (*models.DashboardResponse, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Dashboard service or database repository is not configured",
		)
	}

	// Fail closed if PlatformPool is unavailable
	if s.db.GetPlatformPool() == nil {
		return nil, apierrors.New(
			apierrors.ServiceUnavailable,
			"Platform database connection pool is not configured",
		)
	}

	if filters == nil {
		filters = &models.DashboardFilterParams{}
	}

	// Bounded context timeout (5s) so dashboard queries never block the HTTP thread
	queryCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	// 1. Service Health Check (always safe, concurrent, and non-blocking)
	health := s.checkServiceHealth(queryCtx)

	// 2. College Status Summary
	collegeSummary, err := s.repo.GetCollegeSummary(queryCtx, filters.CollegeID)
	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to retrieve college summary: %v", err),
		)
	}

	// 3. Entitlement Summary
	entitlementSummary, err := s.repo.GetEntitlementSummary(queryCtx, filters.CollegeID)
	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to retrieve entitlement summary: %v", err),
		)
	}

	// 4. Active College Admin Count
	adminCount, err := s.repo.GetActiveCollegeAdminCount(queryCtx, filters.CollegeID)
	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to count active college admins: %v", err),
		)
	}

	// 5. Recent Administrative Activity
	recentActivity, err := s.repo.GetRecentAdministrativeActivity(
		queryCtx,
		filters.CollegeID,
		filters.StartDate,
		filters.EndDate,
		10,
	)
	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to retrieve administrative activity: %v", err),
		)
	}

	// 6. Pending Approvals and Configuration Changes
	approvalSummary, err := s.repo.GetPendingApprovalSummary(
		queryCtx,
		filters.CollegeID,
		filters.StartDate,
		filters.EndDate,
		10,
	)
	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to retrieve approval summary: %v", err),
		)
	}

	// 7. Critical Alerts (Aggregated from real signals)
	alerts := make([]models.CriticalAlert, 0)

	// A. Health-based alert
	if health.OverallStatus != "HEALTHY" {
		alerts = append(alerts, models.CriticalAlert{
			AlertID:     "ALERT_INFRASTRUCTURE_DEGRADED",
			Severity:    "CRITICAL",
			Title:       "Database Infrastructure Degraded",
			Description: "One or more database connection pools failed health check verification.",
			Timestamp:   time.Now().UTC(),
		})
	}

	// B. Overdue approval requests
	if overdueAlerts, err := s.repo.GetOverdueApprovalsForAlerts(queryCtx); err == nil {
		alerts = append(alerts, overdueAlerts...)
	}

	// C. Suspended colleges
	if suspendedAlerts, err := s.repo.GetSuspendedCollegesForAlerts(queryCtx); err == nil {
		alerts = append(alerts, suspendedAlerts...)
	}

	// 8. Explicit unsupported metrics documentation
	unsupportedMetrics := []string{
		"student_level_operational_metrics: strictly excluded from Super Admin scope",
		"standalone_configuration_requests: persisted unified within platform.approval_requests (operation types COLLEGE_SETTING_UPDATE, COLLEGE_MODULE_UPDATE)",
		"historical_status_snapshot: college and module status counts are current snapshots; date range filters apply to activity logs and approval requests",
	}

	return &models.DashboardResponse{
		GeneratedAt:        time.Now().UTC(),
		CollegeSummary:     *collegeSummary,
		EntitlementSummary: *entitlementSummary,
		CollegeAdminSummary: models.CollegeAdminSummary{
			ActiveCount:       adminCount,
			IsCurrentSnapshot: true,
		},
		ServiceHealth:      health,
		RecentActivity:     recentActivity,
		CriticalAlerts:     alerts,
		ApprovalSummary:    *approvalSummary,
		UnsupportedMetrics: unsupportedMetrics,
		AppliedFilters:     *filters,
	}, nil
}

// checkServiceHealth evaluates the status of database pools and API server concurrently.
func (s *DashboardService) checkServiceHealth(ctx context.Context) models.ServiceHealthSummary {
	now := time.Now().UTC()
	checks := make([]models.ServiceHealthCheck, 0, 3)

	// API Server check (self)
	checks = append(checks, models.ServiceHealthCheck{
		ServiceName: "api_server",
		Status:      "HEALTHY",
		Message:     "Super Admin API router is responsive",
		CheckedAt:   now,
	})

	// Concurrently ping connection pools with a fast 2-second timeout
	platformPool := s.db.GetPlatformPool()
	collegePool := s.db.GetCollegePool()

	var platformOK, collegeOK bool
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		if platformPool != nil {
			pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
			defer cancel()
			if err := platformPool.Ping(pingCtx); err == nil {
				platformOK = true
			}
		}
	}()

	go func() {
		defer wg.Done()
		if collegePool != nil {
			pingCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
			defer cancel()
			if err := collegePool.Ping(pingCtx); err == nil {
				collegeOK = true
			}
		}
	}()

	wg.Wait()

	if platformOK {
		checks = append(checks, models.ServiceHealthCheck{
			ServiceName: "platform_database_pool",
			Status:      "HEALTHY",
			Message:     "Connected and operational",
			CheckedAt:   now,
		})
	} else {
		checks = append(checks, models.ServiceHealthCheck{
			ServiceName: "platform_database_pool",
			Status:      "UNAVAILABLE",
			Message:     "Connection pool ping failed or pool unconfigured",
			CheckedAt:   now,
		})
	}

	if collegeOK {
		checks = append(checks, models.ServiceHealthCheck{
			ServiceName: "college_database_pool",
			Status:      "HEALTHY",
			Message:     "Connected and operational",
			CheckedAt:   now,
		})
	} else {
		checks = append(checks, models.ServiceHealthCheck{
			ServiceName: "college_database_pool",
			Status:      "DEGRADED",
			Message:     "College pool ping failed or pool unconfigured",
			CheckedAt:   now,
		})
	}

	// Overall status derivation
	overall := "HEALTHY"
	if !platformOK && !collegeOK {
		overall = "UNAVAILABLE"
	} else if !platformOK || !collegeOK {
		overall = "DEGRADED"
	}

	return models.ServiceHealthSummary{
		OverallStatus: overall,
		Checks:        checks,
	}
}
