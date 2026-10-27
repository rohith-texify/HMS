package validators

import (
	"regexp"
	"strings"

	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

var templateCodeRegex = regexp.MustCompile(`^[A-Za-z0-9_\-]{2,100}$`)

// ValidateTemplateCode validates that a template code conforms to naming conventions.
func ValidateTemplateCode(code string) (string, error) {
	trimmed := strings.TrimSpace(code)
	if trimmed == "" {
		return "", apierrors.New(
			apierrors.ValidationError,
			"Template code is required",
		)
	}

	if len(trimmed) > 100 {
		return "", apierrors.New(
			apierrors.ValidationError,
			"Template code cannot exceed 100 characters",
		)
	}

	if !templateCodeRegex.MatchString(trimmed) {
		return "", apierrors.New(
			apierrors.ValidationError,
			"Template code must contain only letters, numbers, underscores, or dashes (2-100 characters)",
		)
	}

	return strings.ToUpper(trimmed), nil
}

// ValidateTemplateID parses and validates a template UUID from a string parameter.
func ValidateTemplateID(idStr string) (uuid.UUID, error) {
	if strings.TrimSpace(idStr) == "" {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"Template ID is required",
		)
	}

	id, err := uuid.Parse(strings.TrimSpace(idStr))
	if err != nil || id == uuid.Nil {
		return uuid.Nil, apierrors.New(
			apierrors.ValidationError,
			"Invalid template ID format",
		)
	}

	return id, nil
}

// ValidateCreateTemplateRequest validates payload for creating an entitlement template.
func ValidateCreateTemplateRequest(req *models.CreateTemplateRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	validCode, err := ValidateTemplateCode(req.TemplateCode)
	if err != nil {
		return err
	}
	req.TemplateCode = validCode

	trimmedName := strings.TrimSpace(req.Name)
	if trimmedName == "" {
		return apierrors.New(
			apierrors.ValidationError,
			"Template name is required",
		)
	}
	if len(trimmedName) > 150 {
		return apierrors.New(
			apierrors.ValidationError,
			"Template name cannot exceed 150 characters",
		)
	}
	req.Name = trimmedName

	if req.Version < 0 {
		return apierrors.New(
			apierrors.ValidationError,
			"Template version must be a non-negative integer",
		)
	}

	if req.Description != nil {
		trimmedDesc := strings.TrimSpace(*req.Description)
		req.Description = &trimmedDesc
	}

	return nil
}

// ValidateUpdateTemplateRequest validates payload for updating an entitlement template.
func ValidateUpdateTemplateRequest(req *models.UpdateTemplateRequest) error {
	if req == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Request body is required",
		)
	}

	if req.Name == nil && req.Description == nil && req.Version == nil && req.IsActive == nil {
		return apierrors.New(
			apierrors.ValidationError,
			"At least one field must be provided for update",
		)
	}

	if req.Name != nil {
		trimmedName := strings.TrimSpace(*req.Name)
		if trimmedName == "" {
			return apierrors.New(
				apierrors.ValidationError,
				"Template name cannot be empty",
			)
		}
		if len(trimmedName) > 150 {
			return apierrors.New(
				apierrors.ValidationError,
				"Template name cannot exceed 150 characters",
			)
		}
		*req.Name = trimmedName
	}

	if req.Description != nil {
		trimmedDesc := strings.TrimSpace(*req.Description)
		req.Description = &trimmedDesc
	}

	if req.Version != nil && *req.Version < 0 {
		return apierrors.New(
			apierrors.ValidationError,
			"Template version must be a non-negative integer",
		)
	}

	return nil
}
