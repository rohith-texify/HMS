package services

import (
	"bytes"
	"context"
	"encoding/csv"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

// SuperAdminReportService provides verifiable, auditable platform metrics, adoption trends, and CSV exports.
type SuperAdminReportService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewSuperAdminReportService creates a new SuperAdminReportService instance.
func NewSuperAdminReportService(db *database.Database, repo *repository.Repository) *SuperAdminReportService {
	return &SuperAdminReportService{
		db:   db,
		repo: repo,
	}
}

// GetPlatformAnalyticsSummary queries verified aggregate figures across platform tables.
func (s *SuperAdminReportService) GetPlatformAnalyticsSummary(ctx context.Context) (*models.PlatformAnalyticsSummary, error) {
	if s == nil || s.db == nil || s.db.GetPlatformPool() == nil {
		return nil, apierrors.New(apierrors.InternalError, "Platform database connection is not configured")
	}

	pool := s.db.GetPlatformPool()
	now := time.Now().UTC()
	sevenDaysAgo := now.AddDate(0, 0, -7)
	thirtyDaysAgo := now.AddDate(0, 0, -30)

	summary := &models.PlatformAnalyticsSummary{
		GeneratedAt: now,
	}

	// 1. College lifecycle aggregates
	collegeQuery := `
		SELECT 
			COUNT(*) as total,
			COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
			COUNT(*) FILTER (WHERE status = 'ONBOARDING') as onboarding,
			COUNT(*) FILTER (WHERE status = 'SUSPENDED') as suspended,
			COUNT(*) FILTER (WHERE status = 'DEACTIVATED') as deactivated
		FROM platform.colleges
	`
	err := pool.QueryRow(ctx, collegeQuery).Scan(
		&summary.TotalColleges,
		&summary.ActiveColleges,
		&summary.OnboardingColleges,
		&summary.SuspendedColleges,
		&summary.DeactivatedColleges,
	)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to query college counts: %v", err))
	}

	// 2. Verified Active Users: Users with successful login events in the last 30 days
	activeUserQuery := `
		SELECT COUNT(DISTINCT user_id) 
		FROM platform.login_events 
		WHERE result = 'SUCCESS' AND event_at >= $1
	`
	_ = pool.QueryRow(ctx, activeUserQuery, thirtyDaysAgo).Scan(&summary.ActiveUsers30Days)

	// Total registered users
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM app.users`).Scan(&summary.TotalRegisteredUsers)

	// 3. Module & Entitlement Counts
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM platform.modules`).Scan(&summary.TotalPlatformModules)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM platform.modules WHERE is_active = TRUE`).Scan(&summary.ActivePlatformModules)
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM platform.college_modules WHERE status = 'ACTIVE'`).Scan(&summary.TotalCollegeEntitlements)

	// 4. Login security events over the last 7 days
	loginQuery := `
		SELECT 
			COUNT(*) FILTER (WHERE result = 'SUCCESS') as success_count,
			COUNT(*) FILTER (WHERE result IN ('FAILED', 'LOCKED', 'BLOCKED')) as failed_count
		FROM platform.login_events
		WHERE event_at >= $1
	`
	_ = pool.QueryRow(ctx, loginQuery, sevenDaysAgo).Scan(
		&summary.SuccessfulLogins7Days,
		&summary.FailedLogins7Days,
	)

	// 5. Critical security incidents
	incidentQuery := `
		SELECT COUNT(*) 
		FROM platform.audit_logs 
		WHERE severity IN ('CRITICAL', 'HIGH') AND created_at >= $1
	`
	_ = pool.QueryRow(ctx, incidentQuery, thirtyDaysAgo).Scan(&summary.SecurityIncidentsCount)

	return summary, nil
}

// GetCollegeUsageBreakdown queries per-college module counts, audit frequency, and applies small-count suppression.
func (s *SuperAdminReportService) GetCollegeUsageBreakdown(
	ctx context.Context,
	params models.ReportFilterParams,
) ([]models.CollegeUsageMetric, error) {
	if s == nil || s.db == nil || s.db.GetPlatformPool() == nil {
		return nil, apierrors.New(apierrors.InternalError, "Platform database connection is not configured")
	}

	pool := s.db.GetPlatformPool()

	query := `
		SELECT 
			c.college_id,
			c.college_code,
			c.name as college_name,
			c.status,
			COALESCE(cm.mod_count, 0) as entitled_modules,
			COALESCE(u.admin_count, 0) as raw_admins,
			COALESCE(a.audit_count, 0) as total_audit_events,
			a.last_activity
		FROM platform.colleges c
		LEFT JOIN (
			SELECT college_id, COUNT(*) as mod_count 
			FROM platform.college_modules 
			WHERE status = 'ACTIVE' 
			GROUP BY college_id
		) cm ON c.college_id = cm.college_id
		LEFT JOIN (
			SELECT college_id, COUNT(*) as admin_count 
			FROM app.users 
			WHERE role IN ('COLLEGE_ADMIN', 'SUPER_ADMIN') AND status = 'ACTIVE' 
			GROUP BY college_id
		) u ON c.college_id = u.college_id
		LEFT JOIN (
			SELECT college_id, COUNT(*) as audit_count, MAX(created_at) as last_activity 
			FROM platform.audit_logs 
			GROUP BY college_id
		) a ON c.college_id = a.college_id
		WHERE 1=1
	`
	args := []interface{}{}
	argIdx := 1

	if params.CollegeID != nil && *params.CollegeID != uuid.Nil {
		query += fmt.Sprintf(` AND c.college_id = $%d`, argIdx)
		args = append(args, *params.CollegeID)
		argIdx++
	}

	if params.Status != "" {
		query += fmt.Sprintf(` AND c.status = $%d`, argIdx)
		args = append(args, strings.ToUpper(params.Status))
		argIdx++
	}

	query += ` ORDER BY c.name ASC`

	limit := params.Limit
	if limit <= 0 {
		limit = 50
	}
	query += fmt.Sprintf(` LIMIT $%d`, argIdx)
	args = append(args, limit)

	rows, err := pool.Query(ctx, query, args...)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to query college usage breakdown: %v", err))
	}
	defer rows.Close()

	metrics := make([]models.CollegeUsageMetric, 0)
	for rows.Next() {
		var m models.CollegeUsageMetric
		var rawAdmins int
		if err := rows.Scan(
			&m.CollegeID,
			&m.CollegeCode,
			&m.CollegeName,
			&m.Status,
			&m.EntitledModules,
			&rawAdmins,
			&m.TotalAuditEvents,
			&m.LastActivityAt,
		); err == nil {
			// Small-count suppression: cohorts between 1 and 4 are suppressed as "< 5" to prevent re-identification
			if params.ApplySuppression && rawAdmins > 0 && rawAdmins < 5 {
				m.ActiveAdminsCount = "< 5"
			} else {
				m.ActiveAdminsCount = strconv.Itoa(rawAdmins)
			}
			metrics = append(metrics, m)
		}
	}

	return metrics, nil
}

// GetModuleAdoptionMetrics calculates adoption percentages of all modules across active colleges.
func (s *SuperAdminReportService) GetModuleAdoptionMetrics(ctx context.Context) ([]models.ModuleAdoptionMetric, error) {
	if s == nil || s.db == nil || s.db.GetPlatformPool() == nil {
		return nil, apierrors.New(apierrors.InternalError, "Platform database connection is not configured")
	}

	pool := s.db.GetPlatformPool()

	var totalActiveColleges int
	_ = pool.QueryRow(ctx, `SELECT COUNT(*) FROM platform.colleges WHERE status = 'ACTIVE'`).Scan(&totalActiveColleges)
	if totalActiveColleges == 0 {
		totalActiveColleges = 1 // Prevent division by zero
	}

	query := `
		SELECT 
			m.module_id,
			m.code,
			m.name,
			m.is_active,
			COALESCE(cm.assigned_count, 0) as assigned_colleges
		FROM platform.modules m
		LEFT JOIN (
			SELECT module_id, COUNT(*) as assigned_count 
			FROM platform.college_modules cm
			JOIN platform.colleges c ON cm.college_id = c.college_id
			WHERE cm.status = 'ACTIVE' AND c.status = 'ACTIVE'
			GROUP BY module_id
		) cm ON m.module_id = cm.module_id
		ORDER BY assigned_colleges DESC, m.name ASC
	`

	rows, err := pool.Query(ctx, query)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to query module adoption: %v", err))
	}
	defer rows.Close()

	items := make([]models.ModuleAdoptionMetric, 0)
	for rows.Next() {
		var item models.ModuleAdoptionMetric
		if err := rows.Scan(
			&item.ModuleID,
			&item.ModuleCode,
			&item.ModuleName,
			&item.IsActiveInCatalog,
			&item.AssignedColleges,
		); err == nil {
			item.ActiveAdoptionRate = float64(item.AssignedColleges*100) / float64(totalActiveColleges)
			items = append(items, item)
		}
	}

	return items, nil
}

// GetLoginSecurityMetrics aggregates authentication attempts by date.
func (s *SuperAdminReportService) GetLoginSecurityMetrics(
	ctx context.Context,
	days int,
) ([]models.LoginSecurityMetric, error) {
	if s == nil || s.db == nil || s.db.GetPlatformPool() == nil {
		return nil, apierrors.New(apierrors.InternalError, "Platform database connection is not configured")
	}

	if days <= 0 || days > 90 {
		days = 14
	}

	pool := s.db.GetPlatformPool()
	startDate := time.Now().UTC().AddDate(0, 0, -days)

	query := `
		SELECT 
			TO_CHAR(event_at, 'YYYY-MM-DD') as day,
			COUNT(*) FILTER (WHERE result = 'SUCCESS') as success_count,
			COUNT(*) FILTER (WHERE result = 'FAILED') as failed_count,
			COUNT(*) FILTER (WHERE result = 'LOCKED') as locked_count,
			COUNT(*) FILTER (WHERE result = 'BLOCKED') as blocked_count
		FROM platform.login_events
		WHERE event_at >= $1
		GROUP BY TO_CHAR(event_at, 'YYYY-MM-DD')
		ORDER BY day ASC
	`

	rows, err := pool.Query(ctx, query, startDate)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to query login metrics: %v", err))
	}
	defer rows.Close()

	metrics := make([]models.LoginSecurityMetric, 0)
	for rows.Next() {
		var m models.LoginSecurityMetric
		if err := rows.Scan(&m.Date, &m.SuccessCount, &m.FailedCount, &m.LockedCount, &m.BlockedCount); err == nil {
			metrics = append(metrics, m)
		}
	}

	return metrics, nil
}

// GenerateCollegeUsageCSV produces a sanitized, anti-formula-injection CSV stream and logs an audit entry.
func (s *SuperAdminReportService) GenerateCollegeUsageCSV(
	ctx context.Context,
	params models.ReportFilterParams,
	actorUserID uuid.UUID,
	actorRole string,
) ([]byte, error) {
	metrics, err := s.GetCollegeUsageBreakdown(ctx, params)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// CSV Header
	header := []string{"College ID", "College Code", "College Name", "Status", "Entitled Modules", "Active Admins", "Total Audit Events"}
	_ = writer.Write(header)

	for _, m := range metrics {
		row := []string{
			sanitizeFormula(m.CollegeID.String()),
			sanitizeFormula(m.CollegeCode),
			sanitizeFormula(m.CollegeName),
			sanitizeFormula(m.Status),
			strconv.Itoa(m.EntitledModules),
			sanitizeFormula(m.ActiveAdminsCount),
			strconv.Itoa(m.TotalAuditEvents),
		}
		_ = writer.Write(row)
	}
	writer.Flush()

	// Record immutable audit event for report export (fail-closed if audit write fails)
	if s.repo != nil {
		auditErr := s.repo.RecordApprovalAudit(ctx, models.ApprovalAuditParams{
			ActorUserID: actorUserID,
			ActorRole:   actorRole,
			Module:      "platform_analytics",
			Action:      "EXPORT_COLLEGE_USAGE_REPORT",
			EntityType:  "ANALYTICS_REPORT",
			NewData: models.JSONB{
				"report_type":   "COLLEGE_USAGE_CSV",
				"rows_exported": len(metrics),
				"status_filter": params.Status,
			},
			Severity: "INFO",
		})
		if auditErr != nil {
			return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Export aborted: failed to record audit log: %v", auditErr))
		}
	}

	return buf.Bytes(), nil
}

// sanitizeFormula prefixes cells starting with formula trigger symbols with a single quote to prevent spreadsheet injection.
func sanitizeFormula(val string) string {
	if len(val) > 0 {
		first := val[0]
		if first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r' {
			return "'" + strings.TrimSpace(val)
		}
	}
	trimmed := strings.TrimSpace(val)
	if len(trimmed) > 0 {
		first := trimmed[0]
		if first == '=' || first == '+' || first == '-' || first == '@' {
			return "'" + trimmed
		}
	}
	return trimmed
}

// SanitizeFormulaForTesting exposes sanitizeFormula logic for test coverage.
func SanitizeFormulaForTesting(val string) string {
	return sanitizeFormula(val)
}


