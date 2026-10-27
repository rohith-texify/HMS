package models

import (
	"time"

	"github.com/google/uuid"
)

// SettingSource defines where a configuration value originates.
type SettingSource string

const (
	SourceExplicitOverride SettingSource = "EXPLICIT_OVERRIDE"
	SourceGlobalDefault    SettingSource = "GLOBAL_DEFAULT"
)

// SettingCategory groups configuration logically.
type SettingCategory string

const (
	CategoryGeneral  SettingCategory = "general"
	CategorySecurity SettingCategory = "security"
	CategorySystem   SettingCategory = "system"
)

// CollegeSetting represents a per-college configuration setting from platform.college_settings.
type CollegeSetting struct {
	CollegeSettingID uuid.UUID `json:"college_setting_id" db:"college_setting_id"`
	CollegeID        uuid.UUID `json:"college_id" db:"college_id"`
	SettingKey       string    `json:"setting_key" db:"setting_key"`
	SettingValue     JSONB     `json:"setting_value" db:"setting_value"`
	IsSensitive      bool      `json:"is_sensitive" db:"is_sensitive"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

// UpdateCollegeSettingRequest represents the payload for updating a college setting.
type UpdateCollegeSettingRequest struct {
	SettingValue JSONB   `json:"setting_value" binding:"required"`
	Reason       *string `json:"reason,omitempty"`
}

// ResetCollegeSettingRequest represents the payload for resetting a college setting to its global default.
type ResetCollegeSettingRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// RevertCollegeSettingRequest represents the payload for reverting a setting to a historical audit log version.
type RevertCollegeSettingRequest struct {
	AuditID uuid.UUID `json:"audit_id" binding:"required"`
	Reason  string    `json:"reason" binding:"required"`
}

// ListCollegeSettingsParams represents query parameters for listing college settings.
type ListCollegeSettingsParams struct {
	Category         string `form:"category"`
	IncludeSensitive bool   `form:"include_sensitive"`
	Limit            int    `form:"limit" binding:"omitempty,min=1,max=100"`
	Offset           int    `form:"offset" binding:"omitempty,min=0"`
}

// SettingDefinition represents the specification and validation rules for a platform setting.
type SettingDefinition struct {
	Key             string          `json:"key"`
	Category        SettingCategory `json:"category"`
	DisplayName     string          `json:"display_name"`
	Description     string          `json:"description"`
	DataType        string          `json:"data_type"` // string, integer, boolean, object, array
	DefaultValue    interface{}     `json:"default_value"`
	IsSensitive     bool            `json:"is_sensitive"`
	AllowOverride   bool            `json:"allow_override"`
	OwnerDomain     string          `json:"owner_domain"` // PLATFORM_TENANT or COLLEGE_OPERATIONAL
}

// EffectiveSetting represents the resolved configuration for a college.
type EffectiveSetting struct {
	SettingKey   string          `json:"setting_key"`
	Category     SettingCategory `json:"category"`
	DisplayName  string          `json:"display_name"`
	Value        interface{}     `json:"value"`
	Source       SettingSource   `json:"source"`
	IsOverridden bool            `json:"is_overridden"`
	IsSensitive  bool            `json:"is_sensitive"`
	DataType     string          `json:"data_type"`
	UpdatedAt    *time.Time      `json:"updated_at,omitempty"`
}

// SettingComparison represents the difference between a college setting and its global default.
type SettingComparison struct {
	SettingKey       string          `json:"setting_key"`
	Category         SettingCategory `json:"category"`
	DisplayName      string          `json:"display_name"`
	GlobalDefault    interface{}     `json:"global_default"`
	EffectiveValue   interface{}     `json:"effective_value"`
	IsOverridden     bool            `json:"is_overridden"`
	IsOverrideValid  bool            `json:"is_override_valid"`
	IsSensitive      bool            `json:"is_sensitive"`
	ValidationNotice string          `json:"validation_notice,omitempty"`
}

// SettingHistoryEntry represents a historical change to a college setting retrieved from platform.audit_logs.
type SettingHistoryEntry struct {
	AuditID     uuid.UUID   `json:"audit_id"`
	CollegeID   uuid.UUID   `json:"college_id"`
	SettingKey  string      `json:"setting_key"`
	OldValue    interface{} `json:"old_value"`
	NewValue    interface{} `json:"new_value"`
	Action      string      `json:"action"` // UPDATE_COLLEGE_SETTING, RESET_COLLEGE_SETTING, REVERT_COLLEGE_SETTING
	ActorUserID uuid.UUID   `json:"actor_user_id"`
	ActorRole   string      `json:"actor_role"`
	Reason      *string     `json:"reason,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
}

// GlobalSettingDefinitions defines the supported platform tenant configuration registry.
var GlobalSettingDefinitions = map[string]SettingDefinition{
	// General Settings
	"college_name": {
		Key:           "college_name",
		Category:      CategoryGeneral,
		DisplayName:   "College Display Name",
		Description:   "Official institutional display name",
		DataType:      "string",
		DefaultValue:  "",
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},
	"logo_url": {
		Key:           "logo_url",
		Category:      CategoryGeneral,
		DisplayName:   "College Logo URL",
		Description:   "HTTPS URL or asset reference for institutional branding",
		DataType:      "string",
		DefaultValue:  "",
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},
	"contact_email": {
		Key:           "contact_email",
		Category:      CategoryGeneral,
		DisplayName:   "Administrative Contact Email",
		Description:   "Primary contact email for administrative alerts",
		DataType:      "string",
		DefaultValue:  "",
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},
	"contact_phone": {
		Key:           "contact_phone",
		Category:      CategoryGeneral,
		DisplayName:   "Contact Phone Number",
		Description:   "Primary phone contact for campus administration",
		DataType:      "string",
		DefaultValue:  "",
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},
	"address": {
		Key:           "address",
		Category:      CategoryGeneral,
		DisplayName:   "Campus Physical Address",
		Description:   "Official campus physical address line",
		DataType:      "string",
		DefaultValue:  "",
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},
	"timezone": {
		Key:           "timezone",
		Category:      CategoryGeneral,
		DisplayName:   "Institutional Timezone",
		Description:   "IANA timezone identifier (e.g. Asia/Kolkata, UTC)",
		DataType:      "string",
		DefaultValue:  "Asia/Kolkata",
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},
	"locale": {
		Key:           "locale",
		Category:      CategoryGeneral,
		DisplayName:   "Default UI Locale",
		Description:   "Language and regional locale tag (e.g. en-IN, hi-IN, ta-IN)",
		DataType:      "string",
		DefaultValue:  "en-IN",
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},
	"academic_year_start": {
		Key:           "academic_year_start",
		Category:      CategoryGeneral,
		DisplayName:   "Academic Year Starting Month",
		Description:   "Two-digit month (01-12) marking academic cycle commencement",
		DataType:      "string",
		DefaultValue:  "06",
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},

	// User & Session Policy Settings (Security floors enforced)
	"password_policy": {
		Key:           "password_policy",
		Category:      CategorySecurity,
		DisplayName:   "Password Security Policy",
		Description:   "Institutional password complexity rules. Cannot weaken company-wide minimum floors (min_length >= 8, max_age_days <= 90).",
		DataType:      "object",
		DefaultValue: map[string]interface{}{
			"min_length":           8,
			"require_uppercase":    true,
			"require_lowercase":    true,
			"require_number":       true,
			"require_special_char": true,
			"max_age_days":         90,
		},
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},
	"session_policy": {
		Key:           "session_policy",
		Category:      CategorySecurity,
		DisplayName:   "User Session Expiry Policy",
		Description:   "Idle and absolute session lifetime rules. Cannot weaken security floors (idle_timeout_minutes <= 30, absolute_timeout_hours <= 24).",
		DataType:      "object",
		DefaultValue: map[string]interface{}{
			"idle_timeout_minutes":   30,
			"absolute_timeout_hours": 24,
			"max_concurrent_sessions": 2,
		},
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},

	// System Settings
	"data_retention_policy": {
		Key:           "data_retention_policy",
		Category:      CategorySystem,
		DisplayName:   "Data Retention Policy",
		Description:   "Statutory retention classification (STANDARD, EXTENDED, ARCHIVAL, LEGAL_HOLD)",
		DataType:      "object",
		DefaultValue: map[string]interface{}{
			"classification":  "STANDARD",
			"retention_years": 7,
		},
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},
	"allowed_notification_channels": {
		Key:           "allowed_notification_channels",
		Category:      CategorySystem,
		DisplayName:   "Permitted Notification Channels",
		Description:   "Authorized outbound delivery channels for alerts and broadcast (EMAIL, SMS, WHATSAPP, IN_APP)",
		DataType:      "array",
		DefaultValue:  []interface{}{"EMAIL", "IN_APP"},
		IsSensitive:   false,
		AllowOverride: true,
		OwnerDomain:   "PLATFORM_TENANT",
	},
}

// CollegeOwnedOperationalSettings lists settings that belong to the College Admin operational domain.
// Super Admin cannot take over or modify these platform-wide.
var CollegeOwnedOperationalSettings = map[string]bool{
	"curfew_time":             true,
	"attendance_tolerance":    true,
	"room_allocation_rules":   true,
	"leave_approval_policy":   true,
	"visitor_policy":          true,
	"gate_pass_rules":         true,
	"meal_schedule":           true,
	"night_curfew_exceptions": true,
}

// GetSettingDefinition retrieves the definition for a setting key.
func GetSettingDefinition(key string) (*SettingDefinition, bool) {
	def, exists := GlobalSettingDefinitions[key]
	if !exists {
		return nil, false
	}
	return &def, true
}

// IsCollegeOwnedOperationalSetting checks if a key belongs to the college-owned operational boundary.
func IsCollegeOwnedOperationalSetting(key string) bool {
	return CollegeOwnedOperationalSettings[key]
}
