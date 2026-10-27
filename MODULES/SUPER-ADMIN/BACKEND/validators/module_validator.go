package validators

import (
	"regexp"
	"strings"

	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

var moduleCodeRegex = regexp.MustCompile(`^[A-Za-z0-9_\-\.]{2,150}$`)

// ValidateModuleID validates that a module ID is a valid UUID.
func ValidateModuleID(moduleIDStr string) (uuid.UUID, error) {
	if strings.TrimSpace(moduleIDStr) == "" {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"Module ID is required",
		)
	}

	moduleID, err := uuid.Parse(moduleIDStr)
	if err != nil || moduleID == uuid.Nil {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"Invalid module ID format",
		)
	}

	return moduleID, nil
}

// ValidateCollegeModuleID validates that a college module ID is a valid UUID.
func ValidateCollegeModuleID(collegeModuleIDStr string) (uuid.UUID, error) {
	if strings.TrimSpace(collegeModuleIDStr) == "" {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"College module ID is required",
		)
	}

	collegeModuleID, err := uuid.Parse(collegeModuleIDStr)
	if err != nil || collegeModuleID == uuid.Nil {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"Invalid college module ID format",
		)
	}

	return collegeModuleID, nil
}

// ValidateCreateModuleRequest validates the payload for creating a module.
func ValidateCreateModuleRequest(req *models.CreateModuleRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	req.ModuleCode = strings.TrimSpace(req.ModuleCode)
	if req.ModuleCode == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"Module code is required",
		)
	}

	if !moduleCodeRegex.MatchString(req.ModuleCode) {
		return apierrors.New(
			apierrors.ValidationError,
			"Module code must be 2-150 characters and contain only letters, numbers, underscores, dashes, or dots",
		)
	}

	req.ModuleName = strings.TrimSpace(req.ModuleName)
	if req.ModuleName == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"Module name is required",
		)
	}

	if len(req.ModuleName) < 2 || len(req.ModuleName) > 200 {
		return apierrors.New(
			apierrors.ValidationError,
			"Module name must be between 2 and 200 characters",
		)
	}

	req.Kind = strings.ToUpper(strings.TrimSpace(req.Kind))
	switch req.Kind {
	case "APP", "MODULE", "FEATURE":
	default:
		return apierrors.New(
			apierrors.ValidationError,
			"Kind must be APP, MODULE, or FEATURE",
		)
	}

	// Hierarchy validation
	if req.Kind == "APP" {
		if req.ParentID != nil && *req.ParentID != uuid.Nil {
			return apierrors.New(
				apierrors.ValidationError,
				"APP root modules cannot have a parent",
			)
		}
	} else {
		// MODULE or FEATURE must have a parent
		if req.ParentID == nil || *req.ParentID == uuid.Nil {
			return apierrors.New(
				apierrors.ValidationError,
				"MODULE and FEATURE must specify a valid parent_id",
			)
		}
	}

	if req.Priority != "" {
		req.Priority = strings.ToUpper(strings.TrimSpace(req.Priority))
		switch req.Priority {
		case "M", "S", "R":
		default:
			return apierrors.New(
				apierrors.ValidationError,
				"Priority must be M, S, or R",
			)
		}
	} else {
		req.Priority = "M"
	}

	return nil
}

// ValidateUpdateModuleRequest validates the payload for updating a module.
func ValidateUpdateModuleRequest(req *models.UpdateModuleRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	if req.ModuleName == nil && req.ParentID == nil && req.Kind == nil &&
		req.Priority == nil && req.IsCore == nil && req.IsActive == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"At least one field must be provided for update",
		)
	}

	if req.ModuleName != nil {
		trimmed := strings.TrimSpace(*req.ModuleName)
		if trimmed == "" || len(trimmed) < 2 || len(trimmed) > 200 {
			return apierrors.New(
				apierrors.ValidationError,
				"Module name must be between 2 and 200 characters",
			)
		}
		*req.ModuleName = trimmed
	}

	if req.Kind != nil {
		*req.Kind = strings.ToUpper(strings.TrimSpace(*req.Kind))
		switch *req.Kind {
		case "APP", "MODULE", "FEATURE":
		default:
			return apierrors.New(
				apierrors.ValidationError,
				"Kind must be APP, MODULE, or FEATURE",
			)
		}

		if *req.Kind == "APP" && req.ParentID != nil && *req.ParentID != uuid.Nil {
			return apierrors.New(
				apierrors.ValidationError,
				"APP root modules cannot have a parent",
			)
		}
	}

	if req.Priority != nil {
		*req.Priority = strings.ToUpper(strings.TrimSpace(*req.Priority))
		switch *req.Priority {
		case "M", "S", "R":
		default:
			return apierrors.New(
				apierrors.ValidationError,
				"Priority must be M, S, or R",
			)
		}
	}

	return nil
}

// ValidateAssignCollegeModuleRequest validates the payload for assigning a module to a college.
func ValidateAssignCollegeModuleRequest(req *models.AssignCollegeModuleRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	if req.ModuleID == uuid.Nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Module ID is required",
		)
	}

	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	switch req.Status {
	case "ACTIVE", "DISABLED", "SCHEDULED":
	default:
		return apierrors.New(
			apierrors.ValidationError,
			"Status must be ACTIVE, DISABLED, or SCHEDULED",
		)
	}

	req.Mode = strings.ToUpper(strings.TrimSpace(req.Mode))
	switch req.Mode {
	case "FULL", "READ_ONLY":
	default:
		return apierrors.New(
			apierrors.ValidationError,
			"Mode must be FULL or READ_ONLY",
		)
	}

	if req.EffectiveFrom != nil && req.EffectiveTo != nil {
		if !req.EffectiveTo.After(*req.EffectiveFrom) {
			return apierrors.New(
				apierrors.ValidationError,
				"Effective to date must be after effective from date",
			)
		}
	}

	return nil
}

// ValidateUpdateCollegeModuleRequest validates the payload for updating college module assignment.
func ValidateUpdateCollegeModuleRequest(req *models.UpdateCollegeModuleRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	switch req.Status {
	case "ACTIVE", "DISABLED", "SCHEDULED":
	default:
		return apierrors.New(
			apierrors.ValidationError,
			"Status must be ACTIVE, DISABLED, or SCHEDULED",
		)
	}

	req.Mode = strings.ToUpper(strings.TrimSpace(req.Mode))
	switch req.Mode {
	case "FULL", "READ_ONLY":
	default:
		return apierrors.New(
			apierrors.ValidationError,
			"Mode must be FULL or READ_ONLY",
		)
	}

	if req.EffectiveFrom != nil && req.EffectiveTo != nil {
		if !req.EffectiveTo.After(*req.EffectiveFrom) {
			return apierrors.New(
				apierrors.ValidationError,
				"Effective to date must be after effective from date",
			)
		}
	}

	return nil
}
