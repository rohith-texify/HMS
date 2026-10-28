package models

import (
	"time"

	"github.com/google/uuid"
)

// SystemSetting represents a company-wide platform configuration setting from platform.system_settings.
type SystemSetting struct {
	SettingKey       string     `json:"setting_key" db:"setting_key"`
	Category         string     `json:"category" db:"category"`
	DisplayName      string     `json:"display_name" db:"display_name"`
	Description      string     `json:"description" db:"description"`
	DataType         string     `json:"data_type" db:"data_type"`
	SettingValue     JSONB      `json:"setting_value" db:"setting_value"`
	DefaultValue     JSONB      `json:"default_value" db:"default_value"`
	MinValue         JSONB      `json:"min_value,omitempty" db:"min_value"`
	IsSensitive      bool       `json:"is_sensitive" db:"is_sensitive"`
	RequiresApproval bool       `json:"requires_approval" db:"requires_approval"`
	AllowOverride    bool       `json:"allow_override" db:"allow_override"`
	CreatedAt        time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at" db:"updated_at"`
	UpdatedBy        *uuid.UUID `json:"updated_by,omitempty" db:"updated_by"`
}

// SystemSettingHistory represents a version audit log entry from platform.system_settings_history.
type SystemSettingHistory struct {
	HistoryID   uuid.UUID  `json:"history_id" db:"history_id"`
	SettingKey  string     `json:"setting_key" db:"setting_key"`
	OldValue    JSONB      `json:"old_value,omitempty" db:"old_value"`
	NewValue    JSONB      `json:"new_value" db:"new_value"`
	Action      string     `json:"action" db:"action"` // UPDATE, RESET, REVERT
	Reason      string     `json:"reason" db:"reason"`
	ActorUserID *uuid.UUID `json:"actor_user_id,omitempty" db:"actor_user_id"`
	ActorRole   string     `json:"actor_role" db:"actor_role"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
}

// UpdateSystemSettingRequest represents payload to update a global setting.
type UpdateSystemSettingRequest struct {
	SettingValue JSONB  `json:"setting_value" binding:"required"`
	Reason       string `json:"reason" binding:"required"`
}

// RevertSystemSettingRequest represents payload to roll back a global setting to a historical version.
type RevertSystemSettingRequest struct {
	HistoryID uuid.UUID `json:"history_id" binding:"required"`
	Reason    string    `json:"reason" binding:"required"`
}

// MaintenanceModeConfig represents structured global maintenance mode settings.
type MaintenanceModeConfig struct {
	Enabled          bool       `json:"enabled"`
	BannerMessage    string     `json:"banner_message"`
	ScheduledEndTime *time.Time `json:"scheduled_end_time,omitempty"`
	AllowSuperAdmins bool       `json:"allow_super_admins"`
}

// TenantSettingInheritanceOverview represents how tenant colleges inherit or override global settings.
type TenantSettingInheritanceOverview struct {
	SettingKey          string      `json:"setting_key"`
	Category            string      `json:"category"`
	DisplayName         string      `json:"display_name"`
	GlobalDefaultValue  interface{} `json:"global_default_value"`
	TotalTenants        int         `json:"total_tenants"`
	OverriddenTenants   int         `json:"overridden_tenants"`
	InheritedTenants    int         `json:"inherited_tenants"`
	AllowTenantOverride bool        `json:"allow_tenant_override"`
}
