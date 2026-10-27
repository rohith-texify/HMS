package validators

import (
	"encoding/json"
	"fmt"
	"net/mail"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

var (
	settingKeyRegex   = regexp.MustCompile(`^[A-Za-z0-9_\-\.]{1,150}$`)
	localeRegex       = regexp.MustCompile(`^[a-z]{2,3}(-[A-Z]{2,3})?$`)
	phoneRegex        = regexp.MustCompile(`^\+?[0-9\s\-\(\)]{7,20}$`)
	supportedLocales  = map[string]bool{
		"en-IN": true, "en-US": true, "en-GB": true,
		"hi-IN": true, "ta-IN": true, "te-IN": true,
		"mr-IN": true, "bn-IN": true, "gu-IN": true,
		"kn-IN": true, "ml-IN": true, "pa-IN": true,
	}
	supportedChannels = map[string]bool{
		"EMAIL": true, "SMS": true, "WHATSAPP": true, "IN_APP": true,
	}
	supportedRetentionClassifications = map[string]bool{
		"STANDARD": true, "EXTENDED": true, "ARCHIVAL": true, "LEGAL_HOLD": true,
	}
)

// ValidateSettingKey validates that a setting key is non-empty, within limits, and matches permitted characters.
func ValidateSettingKey(key string) (string, error) {
	trimmed := strings.TrimSpace(key)
	if trimmed == "" {
		return "", apierrors.New(
			apierrors.ValidationError,
			"Setting key is required",
		)
	}

	if len(trimmed) > 150 {
		return "", apierrors.New(
			apierrors.ValidationError,
			"Setting key cannot exceed 150 characters",
		)
	}

	if !settingKeyRegex.MatchString(trimmed) {
		return "", apierrors.New(
			apierrors.ValidationError,
			"Setting key must contain only letters, numbers, underscores, dashes, or dots",
		)
	}

	return trimmed, nil
}

// ValidatePlatformSettingKey verifies that a key belongs to the platform tenant domain,
// is not an unauthorized college-owned operational setting, and exists in the registry.
func ValidatePlatformSettingKey(key string) (string, error) {
	trimmed, err := ValidateSettingKey(key)
	if err != nil {
		return "", err
	}

	// Ownership boundary check: Operational policies belong exclusively to College Admin module
	if models.IsCollegeOwnedOperationalSetting(trimmed) {
		return "", apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("Setting '%s' is an operational college-owned setting managed exclusively by the College Admin module and cannot be configured via Super Admin platform", trimmed),
		)
	}

	// Registry check: Reject unknown keys
	if _, exists := models.GetSettingDefinition(trimmed); !exists {
		return "", apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("Unknown configuration key '%s'. Unregistered settings are rejected", trimmed),
		)
	}

	return trimmed, nil
}

// ValidateUpdateCollegeSettingRequest validates the payload for updating a college setting.
func ValidateUpdateCollegeSettingRequest(req *models.UpdateCollegeSettingRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	if req.SettingValue == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Setting value is required",
		)
	}

	// Validate JSON serialization
	if _, err := json.Marshal(req.SettingValue); err != nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Setting value must be valid JSON",
		)
	}

	return nil
}

// ValidateResetCollegeSettingRequest validates the payload for resetting a college setting to default.
func ValidateResetCollegeSettingRequest(req *models.ResetCollegeSettingRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	if strings.TrimSpace(req.Reason) == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"Reason for reset is required and cannot be empty or whitespace-only",
		)
	}

	if len(req.Reason) > 500 {
		return apierrors.New(
			apierrors.ValidationError,
			"Reason cannot exceed 500 characters",
		)
	}

	return nil
}

// ValidateRevertCollegeSettingRequest validates the payload for reverting a setting to a historical version.
func ValidateRevertCollegeSettingRequest(req *models.RevertCollegeSettingRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	if req.AuditID == uuid.Nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Audit ID is required to identify the target historical version",
		)
	}

	if strings.TrimSpace(req.Reason) == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"Reason for revert is required and cannot be empty or whitespace-only",
		)
	}

	if len(req.Reason) > 500 {
		return apierrors.New(
			apierrors.ValidationError,
			"Reason cannot exceed 500 characters",
		)
	}

	return nil
}

// ValidateSettingValue validates setting data against its definition and enforces mandatory security floors.
func ValidateSettingValue(key string, val interface{}) error {
	if _, err := ValidatePlatformSettingKey(key); err != nil {
		return err
	}

	def, exists := models.GetSettingDefinition(key)
	if !exists {
		return apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("Unknown configuration key '%s'", key),
		)
	}

	// Extract actual underlying value if wrapped in JSONB or map
	rawVal := val
	if m, ok := val.(models.JSONB); ok {
		rawVal = m
	}

	switch key {
	case "college_name", "logo_url", "contact_email", "contact_phone", "address", "timezone", "locale", "academic_year_start":
		rawVal = extractScalarValue(rawVal, key)
	case "allowed_notification_channels":
		rawVal = extractSliceValue(rawVal, key)
	}

	switch key {
	case "college_name":
		str, ok := rawVal.(string)
		if !ok || strings.TrimSpace(str) == "" {
			return apierrors.New(apierrors.ValidationError, "College display name must be a non-empty string")
		}
		if len(strings.TrimSpace(str)) > 200 {
			return apierrors.New(apierrors.ValidationError, "College display name cannot exceed 200 characters")
		}

	case "logo_url":
		str, ok := rawVal.(string)
		if !ok {
			return apierrors.New(apierrors.ValidationError, "Logo URL must be a string")
		}
		trimmed := strings.TrimSpace(str)
		if trimmed != "" {
			u, err := url.ParseRequestURI(trimmed)
			if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
				return apierrors.New(apierrors.ValidationError, "Logo URL must be a valid HTTP or HTTPS URL")
			}
		}

	case "contact_email":
		str, ok := rawVal.(string)
		if !ok || strings.TrimSpace(str) == "" {
			return apierrors.New(apierrors.ValidationError, "Contact email must be a non-empty string")
		}
		if _, err := mail.ParseAddress(strings.TrimSpace(str)); err != nil || !strings.Contains(str, "@") {
			return apierrors.New(apierrors.ValidationError, "Contact email must be a valid email address")
		}

	case "contact_phone":
		str, ok := rawVal.(string)
		if !ok || strings.TrimSpace(str) == "" {
			return apierrors.New(apierrors.ValidationError, "Contact phone must be a non-empty string")
		}
		if !phoneRegex.MatchString(strings.TrimSpace(str)) {
			return apierrors.New(apierrors.ValidationError, "Contact phone number format is invalid")
		}

	case "address":
		str, ok := rawVal.(string)
		if !ok {
			return apierrors.New(apierrors.ValidationError, "Campus address must be a string")
		}
		if len(strings.TrimSpace(str)) > 500 {
			return apierrors.New(apierrors.ValidationError, "Campus address cannot exceed 500 characters")
		}

	case "timezone":
		str, ok := rawVal.(string)
		if !ok || strings.TrimSpace(str) == "" {
			return apierrors.New(apierrors.ValidationError, "Timezone must be a non-empty string")
		}
		// Validate against IANA database
		if _, err := time.LoadLocation(strings.TrimSpace(str)); err != nil {
			return apierrors.New(
				apierrors.ValidationError,
				fmt.Sprintf("Invalid IANA timezone identifier '%s'", str),
			)
		}

	case "locale":
		str, ok := rawVal.(string)
		if !ok || strings.TrimSpace(str) == "" {
			return apierrors.New(apierrors.ValidationError, "Locale must be a non-empty string")
		}
		trimmed := strings.TrimSpace(str)
		if !supportedLocales[trimmed] && !localeRegex.MatchString(trimmed) {
			return apierrors.New(
				apierrors.ValidationError,
				fmt.Sprintf("Unsupported locale '%s'. Must be a supported locale tag (e.g. en-IN, hi-IN, ta-IN)", str),
			)
		}

	case "academic_year_start":
		var monthInt int
		switch v := rawVal.(type) {
		case string:
			m, err := strconv.Atoi(strings.TrimSpace(v))
			if err != nil {
				return apierrors.New(apierrors.ValidationError, "Academic year start must be a valid month representation (01-12)")
			}
			monthInt = m
		case float64:
			monthInt = int(v)
		case int:
			monthInt = v
		default:
			return apierrors.New(apierrors.ValidationError, "Academic year start must be a month between 1 and 12")
		}
		if monthInt < 1 || monthInt > 12 {
			return apierrors.New(apierrors.ValidationError, "Academic year start must be between 1 and 12")
		}

	case "password_policy":
		obj, ok := toMapStringInterface(rawVal)
		if !ok {
			return apierrors.New(apierrors.ValidationError, "Password policy must be a JSON object")
		}
		// Security floor: min_length >= 8
		if minLenVal, ok := obj["min_length"]; ok {
			minLen, ok := toInt(minLenVal)
			if !ok || minLen < 8 {
				return apierrors.New(
					apierrors.ValidationError,
					"Password policy violation: min_length cannot be less than mandatory security floor of 8 characters",
				)
			}
		} else {
			return apierrors.New(apierrors.ValidationError, "Password policy must define 'min_length'")
		}

		// Security floor: max_age_days <= 90
		if maxAgeVal, ok := obj["max_age_days"]; ok {
			maxAge, ok := toInt(maxAgeVal)
			if !ok || maxAge <= 0 || maxAge > 90 {
				return apierrors.New(
					apierrors.ValidationError,
					"Password policy violation: max_age_days cannot exceed mandatory security floor of 90 days",
				)
			}
		}

		// Security floor: require_uppercase cannot be disabled
		if reqUpper, ok := obj["require_uppercase"]; ok {
			if b, ok := reqUpper.(bool); ok && !b {
				return apierrors.New(
					apierrors.ValidationError,
					"Password policy violation: require_uppercase cannot be disabled below platform security floor",
				)
			}
		}

		// Security floor: require_number cannot be disabled
		if reqNum, ok := obj["require_number"]; ok {
			if b, ok := reqNum.(bool); ok && !b {
				return apierrors.New(
					apierrors.ValidationError,
					"Password policy violation: require_number cannot be disabled below platform security floor",
				)
			}
		}

	case "session_policy":
		obj, ok := toMapStringInterface(rawVal)
		if !ok {
			return apierrors.New(apierrors.ValidationError, "Session policy must be a JSON object")
		}
		// Security floor: idle_timeout_minutes <= 30
		if idleVal, ok := obj["idle_timeout_minutes"]; ok {
			idle, ok := toInt(idleVal)
			if !ok || idle <= 0 || idle > 30 {
				return apierrors.New(
					apierrors.ValidationError,
					"Session policy violation: idle_timeout_minutes cannot exceed mandatory security floor of 30 minutes",
				)
			}
		} else {
			return apierrors.New(apierrors.ValidationError, "Session policy must define 'idle_timeout_minutes'")
		}

		// Security floor: absolute_timeout_hours <= 24
		if absVal, ok := obj["absolute_timeout_hours"]; ok {
			abs, ok := toInt(absVal)
			if !ok || abs <= 0 || abs > 24 {
				return apierrors.New(
					apierrors.ValidationError,
					"Session policy violation: absolute_timeout_hours cannot exceed mandatory security floor of 24 hours",
				)
			}
		} else {
			return apierrors.New(apierrors.ValidationError, "Session policy must define 'absolute_timeout_hours'")
		}

		// Max concurrent sessions floor: 1 to 5
		if sessVal, ok := obj["max_concurrent_sessions"]; ok {
			sessions, ok := toInt(sessVal)
			if !ok || sessions < 1 || sessions > 5 {
				return apierrors.New(
					apierrors.ValidationError,
					"Session policy violation: max_concurrent_sessions must be between 1 and 5",
				)
			}
		}

	case "data_retention_policy":
		obj, ok := toMapStringInterface(rawVal)
		if !ok {
			return apierrors.New(apierrors.ValidationError, "Data retention policy must be a JSON object")
		}
		classVal, ok := obj["classification"]
		if !ok {
			return apierrors.New(apierrors.ValidationError, "Data retention policy must define 'classification'")
		}
		classStr, ok := classVal.(string)
		if !ok || !supportedRetentionClassifications[strings.ToUpper(strings.TrimSpace(classStr))] {
			return apierrors.New(
				apierrors.ValidationError,
				"Invalid data retention classification. Allowed values: STANDARD, EXTENDED, ARCHIVAL, LEGAL_HOLD",
			)
		}
		if retYearsVal, ok := obj["retention_years"]; ok {
			years, ok := toInt(retYearsVal)
			if !ok || years < 1 || years > 30 {
				return apierrors.New(apierrors.ValidationError, "Data retention years must be between 1 and 30")
			}
		}

	case "allowed_notification_channels":
		channels, ok := toSlice(rawVal)
		if !ok || len(channels) == 0 {
			return apierrors.New(apierrors.ValidationError, "Allowed notification channels must be a non-empty array of channel identifiers")
		}
		for _, ch := range channels {
			chStr, ok := ch.(string)
			if !ok || !supportedChannels[strings.ToUpper(strings.TrimSpace(chStr))] {
				return apierrors.New(
					apierrors.ValidationError,
					fmt.Sprintf("Invalid notification channel '%v'. Allowed channels: EMAIL, SMS, WHATSAPP, IN_APP", ch),
				)
			}
		}

	default:
		// Fallback check against definition data type
		switch def.DataType {
		case "string":
			if _, ok := rawVal.(string); !ok {
				return apierrors.New(apierrors.ValidationError, fmt.Sprintf("Setting '%s' must be a string", key))
			}
		case "object":
			if _, ok := toMapStringInterface(rawVal); !ok {
				return apierrors.New(apierrors.ValidationError, fmt.Sprintf("Setting '%s' must be a JSON object", key))
			}
		case "array":
			if _, ok := toSlice(rawVal); !ok {
				return apierrors.New(apierrors.ValidationError, fmt.Sprintf("Setting '%s' must be an array", key))
			}
		}
	}

	return nil
}

// Helpers for type coercion from JSON deserialization
func toMapStringInterface(val interface{}) (map[string]interface{}, bool) {
	if val == nil {
		return nil, false
	}
	switch v := val.(type) {
	case map[string]interface{}:
		return v, true
	case models.JSONB:
		return v, true
	default:
		// Try JSON marshal/unmarshal
		data, err := json.Marshal(val)
		if err != nil {
			return nil, false
		}
		var m map[string]interface{}
		if err := json.Unmarshal(data, &m); err == nil {
			return m, true
		}
		return nil, false
	}
}

func toSlice(val interface{}) ([]interface{}, bool) {
	if val == nil {
		return nil, false
	}
	switch v := val.(type) {
	case []interface{}:
		return v, true
	case []string:
		res := make([]interface{}, len(v))
		for i, s := range v {
			res[i] = s
		}
		return res, true
	default:
		data, err := json.Marshal(val)
		if err != nil {
			return nil, false
		}
		var s []interface{}
		if err := json.Unmarshal(data, &s); err == nil {
			return s, true
		}
		return nil, false
	}
}

func toInt(val interface{}) (int, bool) {
	switch v := val.(type) {
	case int:
		return v, true
	case int64:
		return int(v), true
	case float64:
		return int(v), true
	case string:
		i, err := strconv.Atoi(strings.TrimSpace(v))
		return i, err == nil
	default:
		return 0, false
	}
}

// IsPrivilegedRole checks if a role string represents a privileged platform administrative role.
func IsPrivilegedRole(role string) bool {
	r := strings.ToUpper(strings.TrimSpace(role))
	return r == "SUPER_ADMIN" || r == "PLATFORM_ADMIN"
}

func extractScalarValue(rawVal interface{}, key string) interface{} {
	if m, ok := toMapStringInterface(rawVal); ok {
		if v, exists := m["value"]; exists {
			return v
		}
		if v, exists := m[key]; exists {
			return v
		}
	}
	return rawVal
}

func extractSliceValue(rawVal interface{}, key string) interface{} {
	if m, ok := toMapStringInterface(rawVal); ok {
		if v, exists := m["channels"]; exists {
			return v
		}
		if v, exists := m["value"]; exists {
			return v
		}
		if v, exists := m[key]; exists {
			return v
		}
	}
	return rawVal
}

