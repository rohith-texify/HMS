package models

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Supported Application Identifiers
const (
	AppStudent        = "student_app"
	AppParent         = "parent_app"
	AppSecurity       = "security_app"
	AppHostelIncharge = "hostel_incharge_app"
	AppAdminPortal    = "admin_portal"
)

// Supported Application Statuses
const (
	AppStatusEnabled   = "ENABLED"
	AppStatusDisabled  = "DISABLED"
	AppStatusSuspended = "SUSPENDED"
)

// ApplicationCatalogueItem represents an application definition in the catalogue.
type ApplicationCatalogueItem struct {
	AppID              string   `json:"app_id"`
	AppCode            string   `json:"app_code"`
	Name               string   `json:"name"`
	Description        string   `json:"description"`
	Platform           string   `json:"platform"` // MOBILE, WEB, HYBRID
	PrimaryRole        string   `json:"primary_role"`
	AssociatedModules  []string `json:"associated_modules"`
	IsProtected        bool     `json:"is_protected"` // True for Admin Portal (cannot be disabled)
	DefaultMinVersion  string   `json:"default_min_version"`
	DefaultForceUpdate bool     `json:"default_force_update"`
}

// CollegeApplicationConfig represents the configuration and status of an application for a college.
type CollegeApplicationConfig struct {
	CollegeID          uuid.UUID  `json:"college_id"`
	AppID              string     `json:"app_id"`
	AppCode            string     `json:"app_code"`
	Name               string     `json:"name"`
	Description        string     `json:"description"`
	Status             string     `json:"status"` // ENABLED, DISABLED, SUSPENDED
	IsProtected        bool       `json:"is_protected"`
	MinVersion         string     `json:"min_version"`
	ForceUpdate        bool       `json:"force_update"`
	AssociatedModules  []string   `json:"associated_modules"`
	ActiveModulesCount int        `json:"active_modules_count"`
	TotalModulesCount  int        `json:"total_modules_count"`
	EffectiveAccess    bool       `json:"effective_access"` // Application is usable and has accessible modules
	UpdatedAt          *time.Time `json:"updated_at,omitempty"`
	UpdatedBy          *uuid.UUID `json:"updated_by,omitempty"`
	ChangeReason       *string    `json:"change_reason,omitempty"`
}

// UpdateAppVersionRequest represents request payload to update min version and force update policy.
type UpdateAppVersionRequest struct {
	MinVersion  string  `json:"min_version" binding:"required"`
	ForceUpdate *bool   `json:"force_update,omitempty"`
	Reason      *string `json:"reason,omitempty"`
}

// UpdateAppStatusRequest represents request payload to change application state.
type UpdateAppStatusRequest struct {
	Status string  `json:"status" binding:"required,oneof=ENABLED DISABLED SUSPENDED"`
	Reason *string `json:"reason,omitempty"`
}

// ApplicationHistoryItem represents an audit trail record for an application configuration change.
type ApplicationHistoryItem struct {
	AuditID       uuid.UUID   `json:"audit_id"`
	CollegeID     uuid.UUID   `json:"college_id"`
	AppID         string      `json:"app_id"`
	Action        string      `json:"action"` // ENABLE, DISABLE, SUSPEND, UPDATE_VERSION, UPDATE_FORCE_UPDATE
	PreviousState interface{} `json:"previous_state,omitempty"`
	NewState      interface{} `json:"new_state,omitempty"`
	ActorUserID   uuid.UUID   `json:"actor_user_id"`
	ActorRole     string      `json:"actor_role"`
	Reason        *string     `json:"reason,omitempty"`
	Timestamp     time.Time   `json:"timestamp"`
	Severity      string      `json:"severity"`
}

// ApplicationStoredSetting represents the JSONB payload stored in platform.college_settings.
type ApplicationStoredSetting struct {
	AppID        string     `json:"app_id"`
	AppCode      string     `json:"app_code"`
	Name         string     `json:"name"`
	Status       string     `json:"status"`
	MinVersion   string     `json:"min_version"`
	ForceUpdate  bool       `json:"force_update"`
	UpdatedAt    time.Time  `json:"updated_at"`
	UpdatedBy    *uuid.UUID `json:"updated_by,omitempty"`
	ChangeReason *string    `json:"change_reason,omitempty"`
}

// ToJSONB serializes the stored setting to a JSONB map.
func (s ApplicationStoredSetting) ToJSONB() (JSONB, error) {
	bytes, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}
	var res JSONB
	err = json.Unmarshal(bytes, &res)
	return res, err
}

// Standard application catalogue entries (exactly 5 applications as defined by HMS specification)
var DefaultApplicationCatalogue = []ApplicationCatalogueItem{
	{
		AppID:              AppStudent,
		AppCode:            "STUDENT_APP",
		Name:               "Student App",
		Description:        "Mobile application for students to access hostel facilities, submit leave requests, view attendance, mess menus, and emergency alerts.",
		Platform:           "MOBILE",
		PrimaryRole:        "STUDENT",
		AssociatedModules:  []string{"PEOPLE", "MOVEMENT", "REQUESTS", "COMMUNICATION"},
		IsProtected:        false,
		DefaultMinVersion:  "1.0.0",
		DefaultForceUpdate: false,
	},
	{
		AppID:              AppParent,
		AppCode:            "PARENT_APP",
		Name:               "Parent App",
		Description:        "Mobile application for parents to monitor ward movements, approve leave requests, view notices, and communicate with hostel administration.",
		Platform:           "MOBILE",
		PrimaryRole:        "PARENT",
		AssociatedModules:  []string{"COMMUNICATION", "PEOPLE", "REQUESTS"},
		IsProtected:        false,
		DefaultMinVersion:  "1.0.0",
		DefaultForceUpdate: false,
	},
	{
		AppID:              AppSecurity,
		AppCode:            "SECURITY_APP",
		Name:               "Security App",
		Description:        "Mobile and gate terminal application for security personnel to verify gate passes, register visitors, and record entry/exit logs.",
		Platform:           "MOBILE",
		PrimaryRole:        "SECURITY",
		AssociatedModules:  []string{"MOVEMENT", "SUPPORT", "HOSTEL"},
		IsProtected:        false,
		DefaultMinVersion:  "1.0.0",
		DefaultForceUpdate: false,
	},
	{
		AppID:              AppHostelIncharge,
		AppCode:            "HOSTEL_INCHARGE_APP",
		Name:               "Hostel Incharge App",
		Description:        "Application for hostel incharge to manage rooms, attendance, complaints, and student welfare.",
		Platform:           "HYBRID",
		PrimaryRole:        "INCHARGE",
		AssociatedModules:  []string{"HOSTEL", "MOVEMENT", "MEALS", "REQUESTS", "SUPPORT"},
		IsProtected:        false,
		DefaultMinVersion:  "1.0.0",
		DefaultForceUpdate: false,
	},
	{
		AppID:              AppAdminPortal,
		AppCode:            "ADMIN_PORTAL",
		Name:               "Admin/Management Portal",
		Description:        "Web administration portal for college and hostel administrators. Provides operational control, student allocations, staff management, and system configuration.",
		Platform:           "WEB",
		PrimaryRole:        "COLLEGE_ADMIN",
		AssociatedModules:  []string{"PLATFORM", "ACADEMIC", "HOSTEL", "PEOPLE", "MOVEMENT", "REQUESTS", "SUPPORT", "COMMUNICATION", "MEALS", "REPORTS", "RESOURCES"},
		IsProtected:        true, // Must NEVER be disabled or suspended
		DefaultMinVersion:  "1.0.0",
		DefaultForceUpdate: false,
	},
}

// GetCatalogueItem returns the catalogue item matching the appID.
func GetCatalogueItem(appID string) (*ApplicationCatalogueItem, bool) {
	for _, item := range DefaultApplicationCatalogue {
		if strings.EqualFold(item.AppID, appID) || strings.EqualFold(item.AppCode, appID) {
			return &item, true
		}
	}
	return nil, false
}

// MapRoleToAppID maps an authenticated user role to its corresponding application identifier.
func MapRoleToAppID(role string) string {
	switch strings.ToUpper(strings.TrimSpace(role)) {
	case "STUDENT":
		return AppStudent
	case "PARENT":
		return AppParent
	case "SECURITY":
		return AppSecurity
	case "INCHARGE", "HOSTEL_INCHARGE":
		return AppHostelIncharge
	case "COLLEGE_ADMIN", "HOSTEL_ADMIN":
		return AppAdminPortal
	default:
		return ""
	}
}

var semVerRegex = regexp.MustCompile(`^v?(\d+)\.(\d+)(?:\.(\d+))?$`)

// ParseSemVer parses a semantic version string into major, minor, patch integers.
func ParseSemVer(v string) (int, int, int, error) {
	v = strings.TrimSpace(v)
	matches := semVerRegex.FindStringSubmatch(v)
	if len(matches) < 3 {
		return 0, 0, 0, fmt.Errorf("invalid semantic version format '%s': expected X.Y or X.Y.Z", v)
	}

	major, err := strconv.Atoi(matches[1])
	if err != nil {
		return 0, 0, 0, err
	}
	minor, err := strconv.Atoi(matches[2])
	if err != nil {
		return 0, 0, 0, err
	}
	patch := 0
	if len(matches) >= 4 && matches[3] != "" {
		patch, err = strconv.Atoi(matches[3])
		if err != nil {
			return 0, 0, 0, err
		}
	}

	return major, minor, patch, nil
}

// CompareSemVer compares two semantic version strings numerically.
// Returns:
//   -1 if v1 < v2
//    0 if v1 == v2
//    1 if v1 > v2
func CompareSemVer(v1, v2 string) (int, error) {
	maj1, min1, pat1, err := ParseSemVer(v1)
	if err != nil {
		return 0, err
	}
	maj2, min2, pat2, err := ParseSemVer(v2)
	if err != nil {
		return 0, err
	}

	if maj1 != maj2 {
		if maj1 < maj2 {
			return -1, nil
		}
		return 1, nil
	}
	if min1 != min2 {
		if min1 < min2 {
			return -1, nil
		}
		return 1, nil
	}
	if pat1 != pat2 {
		if pat1 < pat2 {
			return -1, nil
		}
		return 1, nil
	}
	return 0, nil
}
