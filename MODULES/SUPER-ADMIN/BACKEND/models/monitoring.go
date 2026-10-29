package models

import (
	"time"

	"github.com/google/uuid"
)

// PlatformMonitoringMetrics aggregates authentic runtime metrics and telemetry signals.
type PlatformMonitoringMetrics struct {
	Timestamp            time.Time            `json:"timestamp"`
	ServiceHealthSummary ServiceHealthSummary `json:"service_health"`
	DatabaseStats        DatabasePoolStats    `json:"database_stats"`
	TenantStats          TenantStatusMetrics  `json:"tenant_stats"`
	RecentAuditErrors    []RecentSystemError  `json:"recent_system_errors"`
	TelemetrySignals     SystemTelemetry      `json:"telemetry_signals"`
}

// DatabasePoolStats provides real pool statistics from pgxpool.Stat().
type DatabasePoolStats struct {
	PlatformPoolTotalConns int32 `json:"platform_pool_total_conns"`
	PlatformPoolIdleConns  int32 `json:"platform_pool_idle_conns"`
	PlatformPoolAcquired   int32 `json:"platform_pool_acquired_conns"`
	CollegePoolTotalConns  int32 `json:"college_pool_total_conns"`
	CollegePoolIdleConns   int32 `json:"college_pool_idle_conns"`
	CollegePoolAcquired    int32 `json:"college_pool_acquired_conns"`
}

// TenantStatusMetrics provides active counts of tenants across lifecycle states.
type TenantStatusMetrics struct {
	TotalColleges int `json:"total_colleges"`
	Active        int `json:"active"`
	Onboarding    int `json:"onboarding"`
	Suspended     int `json:"suspended"`
	Deactivated   int `json:"deactivated"`
}

// RecentSystemError exposes sanitized errors recorded in platform.audit_logs with status FAILED/ERROR.
type RecentSystemError struct {
	ID          uuid.UUID `json:"id"`
	Action      string    `json:"action"`
	Module      string    `json:"module"`
	CollegeCode *string   `json:"college_code,omitempty"`
	ErrorMessage string   `json:"error_message"`
	OccurredAt  time.Time `json:"occurred_at"`
	Severity    string    `json:"severity"`
}

// SystemTelemetry conveys status of background integrations without fabricating values.
type SystemTelemetry struct {
	AuthServiceStatus         string `json:"auth_service_status"`         // OPERATIONAL
	NotificationProviderStatus string `json:"notification_provider_status"` // NOT_CONFIGURED
	BackgroundSchedulerStatus string `json:"background_scheduler_status"` // NOT_CONFIGURED
	MetricsCollectorStatus    string `json:"metrics_collector_status"`    // IN_PROCESS
}
