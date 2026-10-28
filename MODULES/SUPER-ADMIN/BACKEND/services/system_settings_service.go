package services

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

// SystemSettingsService handles company-wide configuration business logic, validation of minimum floors,
// version rollbacks, and maintenance mode controls.
type SystemSettingsService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewSystemSettingsService creates a new SystemSettingsService.
func NewSystemSettingsService(db *database.Database, repo *repository.Repository) *SystemSettingsService {
	return &SystemSettingsService{
		db:   db,
		repo: repo,
	}
}

// ListSettings returns all global settings, filtered by optional category.
func (s *SystemSettingsService) ListSettings(
	ctx context.Context,
	category string,
) ([]models.SystemSetting, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "System settings service is not configured")
	}

	return s.repo.ListSystemSettings(ctx, category)
}

// GetSetting retrieves a specific global setting by key.
func (s *SystemSettingsService) GetSetting(
	ctx context.Context,
	key string,
) (*models.SystemSetting, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "System settings service is not configured")
	}

	cleanKey := strings.TrimSpace(key)
	if cleanKey == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Setting key is required")
	}

	setting, err := s.repo.GetSystemSettingByKey(ctx, cleanKey)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to get system setting: %v", err))
	}
	if setting == nil {
		return nil, apierrors.New(apierrors.NotFound, fmt.Sprintf("System setting '%s' not found", cleanKey))
	}

	return setting, nil
}

// UpdateSetting validates and updates a global configuration.
func (s *SystemSettingsService) UpdateSetting(
	ctx context.Context,
	key string,
	req models.UpdateSystemSettingRequest,
	actorUserID *uuid.UUID,
	actorRole string,
) (*models.SystemSetting, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "System settings service is not configured")
	}

	cleanKey := strings.TrimSpace(key)
	if cleanKey == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Setting key is required")
	}

	cleanReason := strings.TrimSpace(req.Reason)
	if len(cleanReason) < 3 {
		return nil, apierrors.New(apierrors.ValidationError, "Reason for changing platform configuration is mandatory (min 3 characters)")
	}

	// 1. Fetch current setting
	existing, err := s.repo.GetSystemSettingByKey(ctx, cleanKey)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to retrieve setting: %v", err))
	}
	if existing == nil {
		return nil, apierrors.New(apierrors.NotFound, fmt.Sprintf("System setting '%s' not found", cleanKey))
	}

	// 2. Validate against security minimums
	if err := s.validateSecurityMinimums(cleanKey, req.SettingValue); err != nil {
		return nil, err
	}

	if actorUserID == nil || *actorUserID == uuid.Nil {
		if ctxID, ok := database.PlatformUserIDFromContext(ctx); ok && ctxID != uuid.Nil {
			actorUserID = &ctxID
		}
	}
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// 3. Update setting & write history version
	updated, err := s.repo.UpdateSystemSetting(ctx, cleanKey, req.SettingValue, "UPDATE", cleanReason, actorUserID, actorRole)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update system setting: %v", err))
	}

	return updated, nil
}

// ResetSetting resets a global setting back to its system default value.
func (s *SystemSettingsService) ResetSetting(
	ctx context.Context,
	key string,
	reason string,
	actorUserID *uuid.UUID,
	actorRole string,
) (*models.SystemSetting, error) {
	cleanKey := strings.TrimSpace(key)
	existing, err := s.GetSetting(ctx, cleanKey)
	if err != nil {
		return nil, err
	}

	cleanReason := strings.TrimSpace(reason)
	if cleanReason == "" {
		cleanReason = "Reset to system factory default"
	}

	return s.repo.UpdateSystemSetting(ctx, cleanKey, existing.DefaultValue, "RESET", cleanReason, actorUserID, actorRole)
}

// RevertSetting rolls back a setting to a historical audit log version.
func (s *SystemSettingsService) RevertSetting(
	ctx context.Context,
	key string,
	req models.RevertSystemSettingRequest,
	actorUserID *uuid.UUID,
	actorRole string,
) (*models.SystemSetting, error) {
	cleanKey := strings.TrimSpace(key)
	cleanReason := strings.TrimSpace(req.Reason)
	if len(cleanReason) < 3 {
		return nil, apierrors.New(apierrors.ValidationError, "Reason for version rollback is mandatory")
	}

	history, err := s.repo.GetSystemSettingHistoryByID(ctx, req.HistoryID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to load historical version: %v", err))
	}
	if history == nil {
		return nil, apierrors.New(apierrors.NotFound, "Target historical version not found")
	}
	if history.SettingKey != cleanKey {
		return nil, apierrors.New(apierrors.ValidationError, "History record does not match the target setting key")
	}

	// Re-verify that target value respects current security minimums
	targetValue := history.NewValue
	if err := s.validateSecurityMinimums(cleanKey, targetValue); err != nil {
		return nil, err
	}

	return s.repo.UpdateSystemSetting(ctx, cleanKey, targetValue, "REVERT", cleanReason, actorUserID, actorRole)
}

// ListHistory retrieves change audit log history for settings.
func (s *SystemSettingsService) ListHistory(
	ctx context.Context,
	key string,
	limit int,
	offset int,
) ([]models.SystemSettingHistory, int, error) {
	if s == nil || s.repo == nil {
		return nil, 0, apierrors.New(apierrors.InternalError, "System settings service is not configured")
	}

	return s.repo.ListSystemSettingHistory(ctx, key, limit, offset)
}

// GetTenantInheritanceOverview calculates how colleges inherit vs override global settings.
func (s *SystemSettingsService) GetTenantInheritanceOverview(
	ctx context.Context,
) ([]models.TenantSettingInheritanceOverview, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "System settings service is not configured")
	}

	return s.repo.GetTenantInheritanceOverview(ctx)
}

// validateSecurityMinimums enforces that platform-wide configuration cannot be weakened below core company baselines.
func (s *SystemSettingsService) validateSecurityMinimums(key string, val models.JSONB) error {
	switch key {
	case "password_policy":
		// min_length >= 8
		if minLenVal, ok := val["min_length"]; ok {
			var minLen int
			switch v := minLenVal.(type) {
			case float64:
				minLen = int(v)
			case int:
				minLen = v
			}
			if minLen < 8 {
				return apierrors.New(apierrors.ValidationError, "Company security policy: password min_length cannot be less than 8")
			}
		}
		// max_age_days <= 90
		if maxAgeVal, ok := val["max_age_days"]; ok {
			var maxAge int
			switch v := maxAgeVal.(type) {
			case float64:
				maxAge = int(v)
			case int:
				maxAge = v
			}
			if maxAge <= 0 || maxAge > 90 {
				return apierrors.New(apierrors.ValidationError, "Company security policy: password max_age_days cannot exceed 90 days")
			}
		}

	case "session_policy":
		// idle_timeout_minutes <= 60
		if idleVal, ok := val["idle_timeout_minutes"]; ok {
			var idle int
			switch v := idleVal.(type) {
			case float64:
				idle = int(v)
			case int:
				idle = v
			}
			if idle <= 0 || idle > 60 {
				return apierrors.New(apierrors.ValidationError, "Company security policy: idle_timeout_minutes cannot exceed 60 minutes")
			}
		}

	case "login_lockout_policy":
		// max_failed_attempts <= 10
		if maxAttemptsVal, ok := val["max_failed_attempts"]; ok {
			var attempts int
			switch v := maxAttemptsVal.(type) {
			case float64:
				attempts = int(v)
			case int:
				attempts = v
			}
			if attempts <= 0 || attempts > 10 {
				return apierrors.New(apierrors.ValidationError, "Company security policy: max_failed_attempts cannot exceed 10 attempts")
			}
		}
	}

	return nil
}
