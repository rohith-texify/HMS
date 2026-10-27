package validators

import (
	"strings"

	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// NewValidationError creates a new validation error.
func NewValidationError(message string) *apierrors.APIError {
	return apierrors.New(apierrors.ValidationError, message)
}

// ValidateCollegeID validates that a college ID is a valid UUID.
func ValidateCollegeID(collegeIDStr string) (uuid.UUID, error) {
	if collegeIDStr == "" {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	collegeID, err := uuid.Parse(collegeIDStr)
	if err != nil {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"Invalid college ID format",
		)
	}

	return collegeID, nil
}

// ValidateListCollegesParams validates query parameters for listing colleges.
func ValidateListCollegesParams(params *models.ListCollegesParams) error {
	// Validate status if provided
	if params.Status != "" {
		validStatuses := map[string]bool{
			"ONBOARDING":  true,
			"ACTIVE":      true,
			"SUSPENDED":   true,
			"DEACTIVATED": true,
		}
		if !validStatuses[params.Status] {
			return apierrors.New(
				apierrors.ValidationError,
				"Invalid status. Must be one of: ONBOARDING, ACTIVE, SUSPENDED, DEACTIVATED",
			)
		}
	}

	// Validate pagination limits
	if params.Limit < 0 {
		return apierrors.New(
			apierrors.ValidationError,
			"Limit must be greater than or equal to 0",
		)
	}

	if params.Limit > 100 {
		return apierrors.New(
			apierrors.ValidationError,
			"Limit cannot exceed 100",
		)
	}

	if params.Offset < 0 {
		return apierrors.New(
			apierrors.ValidationError,
			"Offset must be greater than or equal to 0",
		)
	}

	// Validate search length
	if len(params.Search) > 100 {
		return apierrors.New(
			apierrors.ValidationError,
			"Search term cannot exceed 100 characters",
		)
	}

	return nil
}

// ValidateCreateCollegeRequest validates the create college request payload.
func ValidateCreateCollegeRequest(req *models.CreateCollegeRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	// College code validation
	if req.CollegeCode == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"College code is required",
		)
	}

	if len(req.CollegeCode) > 100 {
		return apierrors.New(
			apierrors.ValidationError,
			"College code cannot exceed 100 characters",
		)
	}

	if !IsValidCollegeCode(req.CollegeCode) {
		return apierrors.New(
			apierrors.ValidationError,
			"College code must contain only alphanumeric characters, hyphens, and underscores",
		)
	}

	// Name validation
	if req.Name == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"College name is required",
		)
	}

	if len(req.Name) > 200 {
		return apierrors.New(
			apierrors.ValidationError,
			"College name cannot exceed 200 characters",
		)
	}

	// Timezone validation
	if req.Timezone == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"Timezone is required",
		)
	}

	if len(req.Timezone) > 100 {
		return apierrors.New(
			apierrors.ValidationError,
			"Timezone cannot exceed 100 characters",
		)
	}

	if !IsValidTimezone(req.Timezone) {
		return apierrors.New(
			apierrors.ValidationError,
			"Invalid timezone format",
		)
	}

	// Optional field validations
	if req.City != nil && len(*req.City) > 100 {
		return apierrors.New(
			apierrors.ValidationError,
			"City cannot exceed 100 characters",
		)
	}

	if req.State != nil && len(*req.State) > 100 {
		return apierrors.New(
			apierrors.ValidationError,
			"State cannot exceed 100 characters",
		)
	}

	if req.ContactEmail != nil && *req.ContactEmail != "" {
		if !IsValidEmailFormat(*req.ContactEmail) {
			return apierrors.New(
				apierrors.ValidationError,
				"Invalid email format",
			)
		}
	}

	if req.AdminEmail != nil && *req.AdminEmail != "" {
		if !IsValidEmailFormat(*req.AdminEmail) {
			return apierrors.New(
				apierrors.ValidationError,
				"Invalid admin email format",
			)
		}
	}

	if req.Password != nil && *req.Password != "" {
		if len(*req.Password) < 8 {
			return apierrors.New(
				apierrors.ValidationError,
				"Password must be at least 8 characters long",
			)
		}
		if len(*req.Password) > 128 {
			return apierrors.New(
				apierrors.ValidationError,
				"Password cannot exceed 128 characters",
			)
		}
	}

	return nil
}

// ValidateUpdateCollegeAdminPasswordRequest validates password update payload for a college admin.
func ValidateUpdateCollegeAdminPasswordRequest(req *models.UpdateCollegeAdminPasswordRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	if req.Password == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"Password is required",
		)
	}

	if len(req.Password) < 8 {
		return apierrors.New(
			apierrors.ValidationError,
			"Password must be at least 8 characters long",
		)
	}

	if len(req.Password) > 128 {
		return apierrors.New(
			apierrors.ValidationError,
			"Password cannot exceed 128 characters",
		)
	}

	if req.AdminEmail != nil && *req.AdminEmail != "" {
		if !IsValidEmailFormat(*req.AdminEmail) {
			return apierrors.New(
				apierrors.ValidationError,
				"Invalid admin email format",
			)
		}
	}

	return nil
}

// ValidateUpdateCollegeRequest validates the update college request payload.
func ValidateUpdateCollegeRequest(req *models.UpdateCollegeRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	// Check that at least one field is provided
	if req.Name == nil && req.City == nil && req.State == nil &&
		req.Timezone == nil && req.ContactEmail == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"At least one field must be provided for update",
		)
	}

	// Validate name if provided
	if req.Name != nil {
		if *req.Name == "" {
			return apierrors.New(
				apierrors.ValidationError,
				"Name cannot be empty",
			)
		}
		if len(*req.Name) > 200 {
			return apierrors.New(
				apierrors.ValidationError,
				"Name cannot exceed 200 characters",
			)
		}
	}

	// Validate city if provided
	if req.City != nil && len(*req.City) > 100 {
		return apierrors.New(
			apierrors.ValidationError,
			"City cannot exceed 100 characters",
		)
	}

	// Validate state if provided
	if req.State != nil && len(*req.State) > 100 {
		return apierrors.New(
			apierrors.ValidationError,
			"State cannot exceed 100 characters",
		)
	}

	// Validate timezone if provided
	if req.Timezone != nil {
		if *req.Timezone == "" {
			return apierrors.New(
				apierrors.ValidationError,
				"Timezone cannot be empty",
			)
		}
		if len(*req.Timezone) > 100 {
			return apierrors.New(
				apierrors.ValidationError,
				"Timezone cannot exceed 100 characters",
			)
		}
		if !IsValidTimezone(*req.Timezone) {
			return apierrors.New(
				apierrors.ValidationError,
				"Invalid timezone format",
			)
		}
	}

	// Validate contact email if provided
	if req.ContactEmail != nil && *req.ContactEmail != "" {
		if !IsValidEmailFormat(*req.ContactEmail) {
			return apierrors.New(
				apierrors.ValidationError,
				"Invalid email format",
			)
		}
	}

	return nil
}

// ValidateUpdateCollegeStatusRequest validates the update college status request.
func ValidateUpdateCollegeStatusRequest(req *models.UpdateCollegeStatusRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	// Validate status
	validStatuses := map[string]bool{
		"ONBOARDING":  true,
		"ACTIVE":      true,
		"SUSPENDED":   true,
		"DEACTIVATED": true,
	}

	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if req.Status == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"Status is required",
		)
	}

	if !validStatuses[req.Status] {
		return apierrors.New(
			apierrors.ValidationError,
			"Invalid status. Must be one of: ONBOARDING, ACTIVE, SUSPENDED, DEACTIVATED",
		)
	}

	// Lifecycle reason is required according to the established service contract
	reason := strings.TrimSpace(req.GetReason())
	if reason == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"Lifecycle reason is required",
		)
	}

	if len(reason) > 500 {
		return apierrors.New(
			apierrors.ValidationError,
			"Reason cannot exceed 500 characters",
		)
	}

	return nil
}

// ValidateUpdateCollegeOnboardingRequest validates the update onboarding step request.
func ValidateUpdateCollegeOnboardingRequest(stepCode string, req *models.UpdateCollegeOnboardingRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	validSteps := map[string]bool{
		"COLLEGE_PROFILE":  true,
		"COLLEGE_ADMIN":    true,
		"BRANDING":         true,
		"ENTITLEMENTS":     true,
		"READINESS_REVIEW": true,
		"GO_LIVE":          true,
	}

	stepCode = strings.ToUpper(strings.TrimSpace(stepCode))
	if !validSteps[stepCode] {
		return apierrors.New(
			apierrors.ValidationError,
			"Invalid onboarding step code",
		)
	}

	validStatuses := map[string]bool{
		"PENDING":     true,
		"IN_PROGRESS": true,
		"COMPLETED":   true,
		"SKIPPED":     true,
		"FAILED":      true,
	}

	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if req.Status == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"Status is required",
		)
	}

	if !validStatuses[req.Status] {
		return apierrors.New(
			apierrors.ValidationError,
			"Invalid onboarding status. Must be one of: PENDING, IN_PROGRESS, COMPLETED, SKIPPED, FAILED",
		)
	}

	if req.Status == "COMPLETED" && (req.Notes == nil || strings.TrimSpace(*req.Notes) == "") {
		return apierrors.New(
			apierrors.ValidationError,
			"Notes are required to document step completion",
		)
	}

	if req.Notes != nil && len(*req.Notes) > 1000 {
		return apierrors.New(
			apierrors.ValidationError,
			"Notes cannot exceed 1000 characters",
		)
	}

	return nil
}

// IsValidEmailFormat performs basic email validation.
func IsValidEmailFormat(email string) bool {
	if len(email) < 3 || len(email) > 254 {
		return false
	}

	// Basic check: must contain @ and at least one character before and after
	atIndex := -1
	for i, c := range email {
		if c == '@' {
			if atIndex != -1 {
				return false // Multiple @ symbols
			}
			atIndex = i
		}
	}

	if atIndex <= 0 || atIndex >= len(email)-1 {
		return false
	}

	// Check for at least one dot after @
	hasDotAfterAt := false
	for i := atIndex + 1; i < len(email); i++ {
		if email[i] == '.' {
			hasDotAfterAt = true
			break
		}
	}

	return hasDotAfterAt
}

// isValidEmailFormat is an internal alias preserving backward compatibility.
func isValidEmailFormat(email string) bool {
	return IsValidEmailFormat(email)
}

// IsValidCollegeCode checks if the college code contains only valid characters.
func IsValidCollegeCode(code string) bool {
	if code == "" || len(code) > 100 {
		return false
	}
	for _, c := range code {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
			(c >= '0' && c <= '9') || c == '-' || c == '_') {
			return false
		}
	}
	return true
}

// IsValidTimezone performs basic timezone validation.
func IsValidTimezone(tz string) bool {
	if tz == "" || len(tz) > 100 {
		return false
	}
	// Basic check: should contain at least one slash or be UTC
	return strings.Contains(tz, "/") || tz == "UTC"
}

// CanonicalOnboardingSteps defines the required onboarding steps in sequence.
var CanonicalOnboardingSteps = []string{
	"COLLEGE_PROFILE",
	"COLLEGE_ADMIN",
	"READINESS_REVIEW",
	"GO_LIVE",
}

// ValidCollegeStatuses defines all permitted lifecycle status strings.
var ValidCollegeStatuses = map[string]bool{
	"ONBOARDING":  true,
	"ACTIVE":      true,
	"SUSPENDED":   true,
	"DEACTIVATED": true,
}
