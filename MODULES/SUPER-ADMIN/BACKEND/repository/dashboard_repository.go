package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// GetCollegeSummary returns the count of colleges grouped by their lifecycle status.
// If collegeID is provided, it returns the summary scoped to that specific tenant.
func (r *Repository) GetCollegeSummary(ctx context.Context, collegeID *uuid.UUID) (*models.CollegeStatusSummary, error) {
	query := `
		SELECT
			COUNT(*)::int AS total,
			COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
			COUNT(*) FILTER (WHERE status = 'DEACTIVATED')::int AS deactivated,
			COUNT(*) FILTER (WHERE status = 'SUSPENDED')::int AS suspended,
			COUNT(*) FILTER (WHERE status = 'ONBOARDING')::int AS onboarding
		FROM platform.colleges
		WHERE ($1::uuid IS NULL OR college_id = $1)
	`

	var total, active, deactivated, suspended, onboarding int
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID).Scan(
		&total,
		&active,
		&deactivated,
		&suspended,
		&onboarding,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query college summary: %w", err)
	}

	return &models.CollegeStatusSummary{
		TotalColleges:       total,
		ActiveColleges:      active,
		InactiveColleges:    deactivated, // Mapped to DEACTIVATED per schema constraints
		SuspendedColleges:   suspended,
		OnboardingColleges:  onboarding,
		DeactivatedColleges: deactivated,
		IsCurrentSnapshot:   true,
	}, nil
}

// GetEntitlementSummary returns counts for enabled and disabled applications and modules.
// If collegeID is nil, it counts across the global platform catalog (platform.modules).
// If collegeID is provided, it counts assignments for that college (platform.college_modules).
func (r *Repository) GetEntitlementSummary(ctx context.Context, collegeID *uuid.UUID) (*models.EntitlementSummary, error) {
	if collegeID == nil {
		// Global catalog summary
		query := `
			SELECT
				COUNT(*) FILTER (WHERE kind = 'MODULE' AND is_active = true)::int AS enabled_modules,
				COUNT(*) FILTER (WHERE kind = 'MODULE' AND is_active = false)::int AS disabled_modules,
				COUNT(*) FILTER (WHERE kind = 'APP' AND is_active = true)::int AS enabled_apps,
				COUNT(*) FILTER (WHERE kind = 'APP' AND is_active = false)::int AS disabled_apps,
				COUNT(*) FILTER (WHERE kind = 'FEATURE')::int AS total_features
			FROM platform.modules
		`
		var enMod, disMod, enApp, disApp, totFeat int
		err := r.Executor(ctx).QueryRow(ctx, query).Scan(&enMod, &disMod, &enApp, &disApp, &totFeat)
		if err != nil {
			return nil, fmt.Errorf("failed to query global entitlement summary: %w", err)
		}

		return &models.EntitlementSummary{
			Scope:                "GLOBAL_CATALOG",
			EnabledModules:       enMod,
			DisabledModules:      disMod,
			EnabledApplications:  enApp,
			DisabledApplications: disApp,
			TotalFeatures:        totFeat,
			IsCurrentSnapshot:    true,
		}, nil
	}

	// College-specific entitlement assignments
	query := `
		SELECT
			COUNT(*) FILTER (WHERE m.kind = 'MODULE' AND cm.status = 'ACTIVE')::int AS enabled_modules,
			COUNT(*) FILTER (WHERE m.kind = 'MODULE' AND cm.status = 'DISABLED')::int AS disabled_modules,
			COUNT(*) FILTER (WHERE m.kind = 'APP' AND cm.status = 'ACTIVE')::int AS enabled_apps,
			COUNT(*) FILTER (WHERE m.kind = 'APP' AND cm.status = 'DISABLED')::int AS disabled_apps,
			COUNT(*) FILTER (WHERE m.kind = 'FEATURE' AND cm.status = 'ACTIVE')::int AS total_features
		FROM platform.college_modules cm
		JOIN platform.modules m ON m.module_id = cm.module_id
		WHERE cm.college_id = $1
	`
	var enMod, disMod, enApp, disApp, totFeat int
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID).Scan(&enMod, &disMod, &enApp, &disApp, &totFeat)
	if err != nil {
		return nil, fmt.Errorf("failed to query college entitlement summary: %w", err)
	}

	return &models.EntitlementSummary{
		Scope:                "COLLEGE_TENANT",
		EnabledModules:       enMod,
		DisabledModules:      disMod,
		EnabledApplications:  enApp,
		DisabledApplications: disApp,
		TotalFeatures:        totFeat,
		IsCurrentSnapshot:    true,
	}, nil
}

// GetActiveCollegeAdminCount returns the distinct number of active College Admin accounts.
// Applies checks on user status = 'ACTIVE', role status = 'ACTIVE', unexpired validity,
// and ensures no duplicate counting due to joins.
func (r *Repository) GetActiveCollegeAdminCount(ctx context.Context, collegeID *uuid.UUID) (int, error) {
	query := `
		SELECT COUNT(DISTINCT u.user_id)::int
		FROM app.users u
		JOIN platform.user_roles ur ON ur.user_id = u.user_id
		JOIN platform.roles r ON r.role_id = ur.role_id
		WHERE r.role_code = 'COLLEGE_ADMIN'
		  AND u.status = 'ACTIVE'
		  AND ur.status = 'ACTIVE'
		  AND (ur.expires_at IS NULL OR ur.expires_at > now())
		  AND ($1::uuid IS NULL OR ur.college_id = $1)
	`

	var count int
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count active college admins: %w", err)
	}

	return count, nil
}

// GetRecentAdministrativeActivity returns bounded platform administrative events from platform.audit_logs.
// Orders deterministically by created_at DESC, audit_id DESC.
func (r *Repository) GetRecentAdministrativeActivity(
	ctx context.Context,
	collegeID *uuid.UUID,
	startDate, endDate *time.Time,
	limit int,
) ([]models.AdministrativeActivityItem, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	query := `
		SELECT
			a.audit_id,
			a.created_at,
			COALESCE(a.action, ''),
			COALESCE(a.module, ''),
			COALESCE(a.entity_type, ''),
			a.entity_id,
			COALESCE(a.actor_role, 'PLATFORM_USER'),
			COALESCE('user-' || SUBSTRING(a.actor_user_id::text, 1, 8), 'SYSTEM'),
			a.college_id,
			COALESCE(c.name, ''),
			'SUCCESS' AS outcome,
			COALESCE(a.reason, '')
		FROM platform.audit_logs a
		LEFT JOIN platform.colleges c ON c.college_id = a.college_id
		WHERE ($1::uuid IS NULL OR a.college_id = $1)
		  AND ($2::timestamptz IS NULL OR a.created_at >= $2)
		  AND ($3::timestamptz IS NULL OR a.created_at <= $3)
		ORDER BY a.created_at DESC, a.audit_id DESC
		LIMIT $4
	`

	rows, err := r.Executor(ctx).Query(ctx, query, collegeID, startDate, endDate, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query administrative activity: %w", err)
	}
	defer rows.Close()

	items := make([]models.AdministrativeActivityItem, 0, limit)
	for rows.Next() {
		var item models.AdministrativeActivityItem
		err := rows.Scan(
			&item.AuditID,
			&item.CreatedAt,
			&item.Action,
			&item.Module,
			&item.EntityType,
			&item.EntityID,
			&item.ActorRole,
			&item.ActorSafeID,
			&item.CollegeID,
			&item.CollegeName,
			&item.Outcome,
			&item.Reason,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan administrative activity: %w", err)
		}
		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error reading activity rows: %w", err)
	}

	return items, nil
}

// GetPendingApprovalSummary retrieves count of pending approvals, count of pending config changes,
// and a bounded list of recent pending approval requests.
func (r *Repository) GetPendingApprovalSummary(
	ctx context.Context,
	collegeID *uuid.UUID,
	startDate, endDate *time.Time,
	limit int,
) (*models.ApprovalSummary, error) {
	if limit <= 0 || limit > 50 {
		limit = 10
	}

	// 1. Query pending counts (excluding expired)
	countQuery := `
		SELECT
			COUNT(*) FILTER (
				WHERE status = 'PENDING'
				  AND (expires_at IS NULL OR expires_at > now())
			)::int AS pending_total,
			COUNT(*) FILTER (
				WHERE status = 'PENDING'
				  AND (expires_at IS NULL OR expires_at > now())
				  AND operation_type IN ('COLLEGE_SETTING_UPDATE', 'COLLEGE_MODULE_UPDATE')
			)::int AS pending_config
		FROM platform.approval_requests
		WHERE ($1::uuid IS NULL OR college_id = $1)
		  AND ($2::timestamptz IS NULL OR created_at >= $2)
		  AND ($3::timestamptz IS NULL OR created_at <= $3)
	`

	var pendingTotal, pendingConfig int
	err := r.Executor(ctx).QueryRow(ctx, countQuery, collegeID, startDate, endDate).Scan(
		&pendingTotal,
		&pendingConfig,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query approval counts: %w", err)
	}

	// 2. Query bounded list of recent pending requests
	listQuery := `
		SELECT
			r.request_id,
			r.operation_type,
			r.college_id,
			COALESCE(c.name, ''),
			COALESCE('user-' || SUBSTRING(r.requested_by::text, 1, 8), 'SYSTEM'),
			r.created_at,
			r.expires_at,
			CASE WHEN r.expires_at IS NOT NULL AND r.expires_at < now() THEN true ELSE false END AS is_overdue
		FROM platform.approval_requests r
		LEFT JOIN platform.colleges c ON c.college_id = r.college_id
		WHERE r.status = 'PENDING'
		  AND ($1::uuid IS NULL OR r.college_id = $1)
		  AND ($2::timestamptz IS NULL OR r.created_at >= $2)
		  AND ($3::timestamptz IS NULL OR r.created_at <= $3)
		ORDER BY r.created_at DESC
		LIMIT $4
	`

	rows, err := r.Executor(ctx).Query(ctx, listQuery, collegeID, startDate, endDate, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query pending approval requests: %w", err)
	}
	defer rows.Close()

	recentPending := make([]models.PendingApprovalItem, 0, limit)
	for rows.Next() {
		var item models.PendingApprovalItem
		err := rows.Scan(
			&item.RequestID,
			&item.OperationType,
			&item.CollegeID,
			&item.CollegeName,
			&item.RequestedBy,
			&item.CreatedAt,
			&item.ExpiresAt,
			&item.IsOverdue,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan pending approval item: %w", err)
		}
		recentPending = append(recentPending, item)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error reading pending approval rows: %w", err)
	}

	return &models.ApprovalSummary{
		PendingCount:              pendingTotal,
		PendingConfigurationCount: pendingConfig,
		RecentPending:             recentPending,
		ConfigurationSourceNote:   "Configuration-change requests are tracked as platform.approval_requests with operation types COLLEGE_SETTING_UPDATE and COLLEGE_MODULE_UPDATE.",
	}, nil
}

// GetSuspendedCollegesForAlerts queries colleges currently in SUSPENDED status to build verifiable alerts.
func (r *Repository) GetSuspendedCollegesForAlerts(ctx context.Context) ([]models.CriticalAlert, error) {
	query := `
		SELECT college_id, name, updated_at
		FROM platform.colleges
		WHERE status = 'SUSPENDED'
		ORDER BY updated_at DESC
		LIMIT 5
	`

	rows, err := r.Executor(ctx).Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query suspended colleges: %w", err)
	}
	defer rows.Close()

	alerts := make([]models.CriticalAlert, 0)
	for rows.Next() {
		var colID uuid.UUID
		var name string
		var updatedAt time.Time
		if err := rows.Scan(&colID, &name, &updatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan suspended college: %w", err)
		}
		alerts = append(alerts, models.CriticalAlert{
			AlertID:     fmt.Sprintf("ALERT_COLLEGE_SUSPENDED_%s", colID.String()[:8]),
			Severity:    "WARNING",
			Title:       "College Suspended",
			Description: fmt.Sprintf("College '%s' is in SUSPENDED status.", name),
			Timestamp:   updatedAt,
			ResourceID:  colID.String(),
		})
	}

	return alerts, nil
}

// GetOverdueApprovalsForAlerts queries pending approval requests that have passed their expiration deadline.
func (r *Repository) GetOverdueApprovalsForAlerts(ctx context.Context) ([]models.CriticalAlert, error) {
	query := `
		SELECT request_id, operation_type, expires_at
		FROM platform.approval_requests
		WHERE status = 'PENDING'
		  AND expires_at IS NOT NULL
		  AND expires_at < now()
		ORDER BY expires_at ASC
		LIMIT 5
	`

	rows, err := r.Executor(ctx).Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query overdue approvals: %w", err)
	}
	defer rows.Close()

	alerts := make([]models.CriticalAlert, 0)
	for rows.Next() {
		var reqID uuid.UUID
		var opType string
		var expiresAt time.Time
		if err := rows.Scan(&reqID, &opType, &expiresAt); err != nil {
			return nil, fmt.Errorf("failed to scan overdue approval: %w", err)
		}
		alerts = append(alerts, models.CriticalAlert{
			AlertID:     fmt.Sprintf("ALERT_APPROVAL_OVERDUE_%s", reqID.String()[:8]),
			Severity:    "CRITICAL",
			Title:       "Approval Request Expired",
			Description: fmt.Sprintf("Approval request for %s expired at %s without a decision.", opType, expiresAt.Format(time.RFC3339)),
			Timestamp:   expiresAt,
			ResourceID:  reqID.String(),
		})
	}

	return alerts, nil
}
