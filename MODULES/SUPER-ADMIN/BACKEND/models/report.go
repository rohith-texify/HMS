package models

import (
	"time"

	"github.com/google/uuid"
)

// PlatformAnalyticsSummary provides verifiable high-level platform health and usage statistics.
type PlatformAnalyticsSummary struct {
	GeneratedAt              time.Time              `json:"generated_at"`
	TotalColleges            int                    `json:"total_colleges"`
	ActiveColleges           int                    `json:"active_colleges"`
	OnboardingColleges       int                    `json:"onboarding_colleges"`
	SuspendedColleges        int                    `json:"suspended_colleges"`
	DeactivatedColleges      int                    `json:"deactivated_colleges"`
	ActiveUsers30Days        int                    `json:"active_users_30_days"`
	TotalRegisteredUsers     int                    `json:"total_registered_users"`
	TotalPlatformModules     int                    `json:"total_platform_modules"`
	ActivePlatformModules    int                    `json:"active_platform_modules"`
	TotalCollegeEntitlements int                    `json:"total_college_entitlements"`
	SuccessfulLogins7Days    int                    `json:"successful_logins_7_days"`
	FailedLogins7Days        int                    `json:"failed_logins_7_days"`
	SecurityIncidentsCount   int                    `json:"security_incidents_count"`
	SuppressionApplied       bool                   `json:"suppression_applied"`
}

// CollegeUsageMetric represents aggregated activity for an individual college tenant.
type CollegeUsageMetric struct {
	CollegeID          uuid.UUID `json:"college_id"`
	CollegeCode        string    `json:"college_code"`
	CollegeName        string    `json:"college_name"`
	Status             string    `json:"status"`
	EntitledModules    int       `json:"entitled_modules"`
	ActiveAdminsCount  string    `json:"active_admins_count"` // String to support small-count suppression (e.g., "< 5")
	TotalAuditEvents   int       `json:"total_audit_events"`
	LastActivityAt     *time.Time `json:"last_activity_at,omitempty"`
}

// ModuleAdoptionMetric details adoption rates of an individual feature or module across colleges.
type ModuleAdoptionMetric struct {
	ModuleID           uuid.UUID `json:"module_id"`
	ModuleCode         string    `json:"module_code"`
	ModuleName         string    `json:"module_name"`
	IsActiveInCatalog  bool      `json:"is_active_in_catalog"`
	AssignedColleges   int       `json:"assigned_colleges"`
	ActiveAdoptionRate float64   `json:"active_adoption_rate"` // Percentage of active colleges using this module
}

// LoginSecurityMetric summarizes authentication security events from platform.login_events.
type LoginSecurityMetric struct {
	Date               string `json:"date"`
	SuccessCount       int    `json:"success_count"`
	FailedCount        int    `json:"failed_count"`
	LockedCount        int    `json:"locked_count"`
	BlockedCount       int    `json:"blocked_count"`
}

// ReportFilterParams defines filter criteria for querying analytics reports and generating exports.
type ReportFilterParams struct {
	CollegeID          *uuid.UUID `form:"college_id"`
	Status             string     `form:"status"`
	StartDate          *time.Time `form:"start_date"`
	EndDate            *time.Time `form:"end_date"`
	ModuleCode         string     `form:"module_code"`
	Format             string     `form:"format"` // json, csv
	ApplySuppression   bool       `form:"apply_suppression"`
	Limit              int        `form:"limit"`
	Offset             int        `form:"offset"`
}
