package models

import (
	"time"

	"github.com/google/uuid"
)

// DashboardFilterParams holds validated filter parameters for the dashboard.
type DashboardFilterParams struct {
	StartDate *time.Time `json:"start_date,omitempty"`
	EndDate   *time.Time `json:"end_date,omitempty"`
	CollegeID *uuid.UUID `json:"college_id,omitempty"`
}

// CollegeStatusSummary captures the current snapshot of college tenant statuses.
type CollegeStatusSummary struct {
	TotalColleges       int  `json:"total_colleges"`
	ActiveColleges      int  `json:"active_colleges"`
	InactiveColleges    int  `json:"inactive_colleges"` // Mapped to DEACTIVATED in PostgreSQL schema
	SuspendedColleges   int  `json:"suspended_colleges"`
	OnboardingColleges  int  `json:"onboarding_colleges"`
	DeactivatedColleges int  `json:"deactivated_colleges"`
	IsCurrentSnapshot   bool `json:"is_current_snapshot"`
}

// EntitlementSummary captures counts for enabled and disabled applications and modules.
type EntitlementSummary struct {
	Scope                string `json:"scope"` // "GLOBAL_CATALOG" or "COLLEGE_TENANT"
	EnabledModules       int    `json:"enabled_modules"`
	DisabledModules      int    `json:"disabled_modules"`
	EnabledApplications  int    `json:"enabled_applications"`
	DisabledApplications int    `json:"disabled_applications"`
	TotalFeatures        int    `json:"total_features"`
	IsCurrentSnapshot    bool   `json:"is_current_snapshot"`
}

// CollegeAdminSummary captures the active College Admin account count.
type CollegeAdminSummary struct {
	ActiveCount       int  `json:"active_count"`
	IsCurrentSnapshot bool `json:"is_current_snapshot"`
}

// ServiceHealthCheck represents the health status of an individual platform dependency.
type ServiceHealthCheck struct {
	ServiceName string    `json:"service_name"`
	Status      string    `json:"status"` // "HEALTHY", "DEGRADED", "UNAVAILABLE", "UNKNOWN"
	Message     string    `json:"message"`
	CheckedAt   time.Time `json:"checked_at"`
}

// ServiceHealthSummary aggregates health checks for the Super Admin system.
type ServiceHealthSummary struct {
	OverallStatus string               `json:"overall_status"` // "HEALTHY", "DEGRADED", "UNAVAILABLE"
	Checks        []ServiceHealthCheck `json:"checks"`
}

// AdministrativeActivityItem represents a single platform administrative audit event.
type AdministrativeActivityItem struct {
	AuditID     uuid.UUID  `json:"audit_id"`
	CreatedAt   time.Time  `json:"created_at"`
	Action      string     `json:"action"`
	Module      string     `json:"module"`
	EntityType  string     `json:"entity_type"`
	EntityID    *uuid.UUID `json:"entity_id,omitempty"`
	ActorSafeID string     `json:"actor_safe_id"`
	ActorRole   string     `json:"actor_role"`
	CollegeID   *uuid.UUID `json:"college_id,omitempty"`
	CollegeName string     `json:"college_name,omitempty"`
	Outcome     string     `json:"outcome"`
	Reason      string     `json:"reason,omitempty"`
}

// CriticalAlert represents a verified platform alert derived from real system signals.
type CriticalAlert struct {
	AlertID     string    `json:"alert_id"`
	Severity    string    `json:"severity"` // "CRITICAL", "WARNING", "INFO"
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Timestamp   time.Time `json:"timestamp"`
	ResourceID  string    `json:"resource_id,omitempty"`
}

// PendingApprovalItem represents an individual pending approval request.
type PendingApprovalItem struct {
	RequestID     uuid.UUID  `json:"request_id"`
	OperationType string     `json:"operation_type"`
	CollegeID     *uuid.UUID `json:"college_id,omitempty"`
	CollegeName   string     `json:"college_name,omitempty"`
	RequestedBy   string     `json:"requested_by"`
	CreatedAt     time.Time  `json:"created_at"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	IsOverdue     bool       `json:"is_overdue"`
}

// ApprovalSummary aggregates pending approval requests and configuration changes.
type ApprovalSummary struct {
	PendingCount              int                   `json:"pending_count"`
	PendingConfigurationCount int                   `json:"pending_configuration_count"`
	RecentPending             []PendingApprovalItem `json:"recent_pending"`
	ConfigurationSourceNote   string                `json:"configuration_source_note"`
}

// DashboardResponse is the complete response DTO for the Super Admin Dashboard.
type DashboardResponse struct {
	GeneratedAt         time.Time                    `json:"generated_at"`
	CollegeSummary      CollegeStatusSummary         `json:"college_summary"`
	EntitlementSummary  EntitlementSummary           `json:"entitlement_summary"`
	CollegeAdminSummary CollegeAdminSummary          `json:"college_admin_summary"`
	ServiceHealth       ServiceHealthSummary         `json:"service_health"`
	RecentActivity      []AdministrativeActivityItem `json:"recent_activity"`
	CriticalAlerts      []CriticalAlert              `json:"critical_alerts"`
	ApprovalSummary     ApprovalSummary              `json:"approval_summary"`
	UnsupportedMetrics  []string                     `json:"unsupported_metrics"`
	AppliedFilters      DashboardFilterParams        `json:"applied_filters"`
}
