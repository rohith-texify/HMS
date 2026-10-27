package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// SettingsService handles business logic for college settings.
type SettingsService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewSettingsService creates a new college settings service.
func NewSettingsService(
	db *database.Database,
	repo *repository.Repository,
) *SettingsService {
	return &SettingsService{
		db:   db,
		repo: repo,
	}
}

// extractActor extracts actor user ID and role from variadic arguments or context.
func (s *SettingsService) extractActor(ctx context.Context, actors ...interface{}) (uuid.UUID, string, error) {
	var actorID uuid.UUID
	actorRole := "SUPER_ADMIN"

	if len(actors) > 0 {
		if id, ok := actors[0].(uuid.UUID); ok {
			actorID = id
		}
	}
	if len(actors) > 1 {
		if role, ok := actors[1].(string); ok && strings.TrimSpace(role) != "" {
			actorRole = strings.TrimSpace(role)
		}
	}

	if actorID == uuid.Nil {
		if ctxID, ok := database.PlatformUserIDFromContext(ctx); ok && ctxID != uuid.Nil {
			actorID = ctxID
		} else {
			return uuid.Nil, "", apierrors.New(
				apierrors.Unauthorized,
				"Authenticated actor user ID is required",
			)
		}
	}

	return actorID, actorRole, nil
}

// ListCollegeSettings retrieves raw stored college settings from platform.college_settings.
// Sensitive settings are excluded unless explicitly requested.
func (s *SettingsService) ListCollegeSettings(
	ctx context.Context,
	collegeID uuid.UUID,
	includeSensitive bool,
) ([]models.CollegeSetting, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Settings service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	_, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"College not found",
			)
		}

		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to verify college",
		)
	}

	settings, err := s.repo.ListCollegeSettings(
		ctx,
		collegeID,
		includeSensitive,
	)
	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve college settings",
		)
	}

	if settings == nil {
		settings = []models.CollegeSetting{}
	}

	return settings, nil
}

// GetCollegeSetting retrieves a raw stored setting by college ID and setting key.
func (s *SettingsService) GetCollegeSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	settingKey string,
) (*models.CollegeSetting, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Settings service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	validKey, err := validators.ValidateSettingKey(settingKey)
	if err != nil {
		return nil, err
	}

	_, err = s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"College not found",
			)
		}

		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to verify college",
		)
	}

	setting, err := s.repo.GetCollegeSettingByKey(
		ctx,
		collegeID,
		validKey,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"College setting not found",
			)
		}

		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve college setting",
		)
	}

	return setting, nil
}

// GetEffectiveCollegeSettings returns resolved configuration settings for a college,
// distinguishing explicit tenant overrides from global defaults, filtering by category,
// redacting sensitive values, and applying pagination.
func (s *SettingsService) GetEffectiveCollegeSettings(
	ctx context.Context,
	collegeID uuid.UUID,
	params models.ListCollegeSettingsParams,
) ([]models.EffectiveSetting, int, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, 0, apierrors.New(apierrors.InternalError, "Settings service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, 0, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, 0, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, 0, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	storedSettings, err := s.repo.ListCollegeSettings(ctx, collegeID, true)
	if err != nil {
		return nil, 0, apierrors.New(apierrors.InternalError, "Failed to retrieve college settings")
	}

	storedMap := make(map[string]models.CollegeSetting, len(storedSettings))
	for _, st := range storedSettings {
		storedMap[st.SettingKey] = st
	}

	// Build resolved list from definitions
	var allEffective []models.EffectiveSetting
	for _, def := range models.GlobalSettingDefinitions {
		// Category filter
		if params.Category != "" && string(def.Category) != strings.ToLower(strings.TrimSpace(params.Category)) {
			continue
		}

		effective := models.EffectiveSetting{
			SettingKey:  def.Key,
			Category:    def.Category,
			DisplayName: def.DisplayName,
			IsSensitive: def.IsSensitive,
			DataType:    def.DataType,
		}

		if stored, exists := storedMap[def.Key]; exists {
			effective.Value = stored.SettingValue
			effective.Source = models.SourceExplicitOverride
			effective.IsOverridden = true
			effective.UpdatedAt = &stored.UpdatedAt
		} else {
			// Inherited default
			effective.Source = models.SourceGlobalDefault
			effective.IsOverridden = false
			effective.Value = def.DefaultValue

			// Fallback to college root fields if present
			if def.Key == "timezone" && college.Timezone != "" {
				effective.Value = college.Timezone
			} else if def.Key == "college_name" && college.Name != "" {
				effective.Value = college.Name
			} else if def.Key == "contact_email" && college.ContactEmail != nil && *college.ContactEmail != "" {
				effective.Value = *college.ContactEmail
			}
		}

		// Redact sensitive settings if not requested/authorized
		if effective.IsSensitive && !params.IncludeSensitive {
			effective.Value = "[REDACTED]"
		}

		allEffective = append(allEffective, effective)
	}

	// Sort alphabetically by setting key for consistent ordering
	sort.Slice(allEffective, func(i, j int) bool {
		return allEffective[i].SettingKey < allEffective[j].SettingKey
	})

	total := len(allEffective)

	// Bounded pagination
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}
	if offset > total {
		offset = total
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 50
	}
	end := offset + limit
	if end > total {
		end = total
	}

	paged := allEffective[offset:end]
	if paged == nil {
		paged = []models.EffectiveSetting{}
	}

	return paged, total, nil
}

// GetEffectiveCollegeSetting returns the resolved configuration for a single setting key.
func (s *SettingsService) GetEffectiveCollegeSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	settingKey string,
	includeSensitive bool,
) (*models.EffectiveSetting, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Settings service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	validKey, err := validators.ValidateSettingKey(settingKey)
	if err != nil {
		return nil, err
	}

	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	def, exists := models.GetSettingDefinition(validKey)
	if !exists {
		// If not in registry, check if exists in DB (legacy / stored setting)
		stored, err := s.repo.GetCollegeSettingByKey(ctx, collegeID, validKey)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, apierrors.New(apierrors.NotFound, "College setting not found")
			}
			return nil, apierrors.New(apierrors.InternalError, "Failed to retrieve college setting")
		}

		effective := &models.EffectiveSetting{
			SettingKey:   stored.SettingKey,
			Category:     models.CategoryGeneral,
			DisplayName:  stored.SettingKey,
			Value:        stored.SettingValue,
			Source:       models.SourceExplicitOverride,
			IsOverridden: true,
			IsSensitive:  stored.IsSensitive,
			DataType:     "object",
			UpdatedAt:    &stored.UpdatedAt,
		}
		if effective.IsSensitive && !includeSensitive {
			effective.Value = "[REDACTED]"
		}
		return effective, nil
	}

	effective := &models.EffectiveSetting{
		SettingKey:  def.Key,
		Category:    def.Category,
		DisplayName: def.DisplayName,
		IsSensitive: def.IsSensitive,
		DataType:    def.DataType,
	}

	stored, err := s.repo.GetCollegeSettingByKey(ctx, collegeID, validKey)
	if err == nil {
		effective.Value = stored.SettingValue
		effective.Source = models.SourceExplicitOverride
		effective.IsOverridden = true
		effective.UpdatedAt = &stored.UpdatedAt
	} else if errors.Is(err, pgx.ErrNoRows) {
		effective.Source = models.SourceGlobalDefault
		effective.IsOverridden = false
		effective.Value = def.DefaultValue

		if def.Key == "timezone" && college.Timezone != "" {
			effective.Value = college.Timezone
		} else if def.Key == "college_name" && college.Name != "" {
			effective.Value = college.Name
		} else if def.Key == "contact_email" && college.ContactEmail != nil && *college.ContactEmail != "" {
			effective.Value = *college.ContactEmail
		}
	} else {
		return nil, apierrors.New(apierrors.InternalError, "Failed to retrieve college setting")
	}

	if effective.IsSensitive && !includeSensitive {
		effective.Value = "[REDACTED]"
	}

	return effective, nil
}

// UpdateCollegeSetting updates or creates an explicit configuration setting for a college.
// It verifies lifecycle status, enforces typed validation and mandatory security floors,
// writes the audit record atomically, and rolls back if the audit log fails.
func (s *SettingsService) UpdateCollegeSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	settingKey string,
	req models.UpdateCollegeSettingRequest,
	actors ...interface{},
) (*models.CollegeSetting, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Settings service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	validKey, err := validators.ValidateSettingKey(settingKey)
	if err != nil {
		return nil, err
	}

	if err := validators.ValidateUpdateCollegeSettingRequest(&req); err != nil {
		return nil, err
	}

	// Validate typed values, ownership boundaries, and security floors
	// If key is known in definitions or operational map, enforce rules
	if _, isDef := models.GetSettingDefinition(validKey); isDef || models.IsCollegeOwnedOperationalSetting(validKey) {
		if err := validators.ValidateSettingValue(validKey, req.SettingValue); err != nil {
			return nil, err
		}
	}

	actorID, actorRole, err := s.extractActor(ctx, actors...)
	if err != nil {
		return nil, err
	}

	// 1. Verify college exists
	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	// 2. Lifecycle check: do not permit modifying settings for deactivated or archived colleges
	if college.Status == "DEACTIVATED" || college.Status == "ARCHIVED" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("cannot update settings for college with status '%s'", college.Status),
		)
	}

	var updatedSetting *models.CollegeSetting

	err = s.db.WithPlatformTransaction(
		ctx,
		func(txCtx context.Context, _ pgx.Tx) error {
			// Retrieve existing setting to capture OldData
			existingSetting, getErr := s.repo.GetCollegeSettingByKey(txCtx, collegeID, validKey)
			var oldData map[string]interface{}
			if getErr == nil {
				oldData = map[string]interface{}{"setting_key": validKey, "setting_value": existingSetting.SettingValue}
			} else if errors.Is(getErr, pgx.ErrNoRows) {
				def, hasDef := models.GetSettingDefinition(validKey)
				if !hasDef {
					return apierrors.New(apierrors.NotFound, "College setting not found")
				}
				oldData = map[string]interface{}{"setting_key": validKey, "setting_value": def.DefaultValue}
			} else {
				return fmt.Errorf("failed to retrieve existing college setting: %w", getErr)
			}

			isSensitive := false
			if def, exists := models.GetSettingDefinition(validKey); exists {
				isSensitive = def.IsSensitive
			} else if existingSetting != nil {
				isSensitive = existingSetting.IsSensitive
			}

			var updateErr error
			updatedSetting, updateErr = s.repo.UpsertCollegeSetting(
				txCtx,
				collegeID,
				validKey,
				req.SettingValue,
				isSensitive,
			)
			if updateErr != nil {
				return updateErr
			}

			// Record audit log within transaction
			auditErr := s.repo.RecordSettingsAudit(txCtx, repository.SettingsAuditParams{
				CollegeID:   collegeID,
				ActorUserID: actorID,
				ActorRole:   actorRole,
				Module:      "platform_college_settings",
				Action:      "UPDATE_COLLEGE_SETTING",
				EntityType:  "COLLEGE_SETTING",
				EntityID:    &updatedSetting.CollegeSettingID,
				OldData:     oldData,
				NewData:     map[string]interface{}{"setting_key": validKey, "setting_value": updatedSetting.SettingValue},
				Reason:      req.Reason,
				Severity:    "INFO",
			})
			if auditErr != nil {
				return fmt.Errorf("failed to record settings audit: %w", auditErr)
			}

			return nil
		},
	)
	if err != nil {
		var apiErr *apierrors.APIError
		if errors.As(err, &apiErr) {
			return nil, apiErr
		}
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College setting not found")
		}

		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to update college setting: %v", err),
		)
	}

	return updatedSetting, nil
}

// ResetCollegeSetting resets an explicit tenant configuration override back to its global default.
// It verifies that an override exists, validates the default value, removes the override row,
// and records an audit log atomically.
func (s *SettingsService) ResetCollegeSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	settingKey string,
	req models.ResetCollegeSettingRequest,
	actors ...interface{},
) (*models.EffectiveSetting, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Settings service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	validKey, err := validators.ValidatePlatformSettingKey(settingKey)
	if err != nil {
		return nil, err
	}

	if err := validators.ValidateResetCollegeSettingRequest(&req); err != nil {
		return nil, err
	}

	def, exists := models.GetSettingDefinition(validKey)
	if !exists {
		return nil, apierrors.New(apierrors.ValidationError, fmt.Sprintf("Unknown configuration key '%s'", validKey))
	}

	actorID, actorRole, err := s.extractActor(ctx, actors...)
	if err != nil {
		return nil, err
	}

	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	if college.Status == "DEACTIVATED" || college.Status == "ARCHIVED" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("cannot reset settings for college with status '%s'", college.Status),
		)
	}

	// Validate the default value before resetting
	if err := validators.ValidateSettingValue(validKey, def.DefaultValue); err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("global default for '%s' failed validation: %v", validKey, err))
	}

	err = s.db.WithPlatformTransaction(
		ctx,
		func(txCtx context.Context, _ pgx.Tx) error {
			existingSetting, getErr := s.repo.GetCollegeSettingByKey(txCtx, collegeID, validKey)
			if getErr != nil {
				if errors.Is(getErr, pgx.ErrNoRows) {
					return apierrors.New(
						apierrors.ValidationError,
						fmt.Sprintf("setting '%s' does not have an explicit override to reset", validKey),
					)
				}
				return fmt.Errorf("failed to retrieve setting: %w", getErr)
			}

			if delErr := s.repo.DeleteCollegeSetting(txCtx, collegeID, validKey); delErr != nil {
				return fmt.Errorf("failed to delete setting override: %w", delErr)
			}

			auditErr := s.repo.RecordSettingsAudit(txCtx, repository.SettingsAuditParams{
				CollegeID:   collegeID,
				ActorUserID: actorID,
				ActorRole:   actorRole,
				Module:      "platform_college_settings",
				Action:      "RESET_COLLEGE_SETTING",
				EntityType:  "COLLEGE_SETTING",
				EntityID:    &existingSetting.CollegeSettingID,
				OldData:     map[string]interface{}{"setting_key": validKey, "setting_value": existingSetting.SettingValue},
				NewData:     map[string]interface{}{"setting_key": validKey, "setting_value": def.DefaultValue},
				Reason:      &req.Reason,
				Severity:    "INFO",
			})
			if auditErr != nil {
				return fmt.Errorf("failed to record reset audit: %w", auditErr)
			}

			return nil
		},
	)
	if err != nil {
		var apiErr *apierrors.APIError
		if errors.As(err, &apiErr) {
			return nil, apiErr
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to reset college setting: %v", err))
	}

	return s.GetEffectiveCollegeSetting(ctx, collegeID, validKey, false)
}

// CompareCollegeSettings compares all effective college configuration values against global defaults.
func (s *SettingsService) CompareCollegeSettings(
	ctx context.Context,
	collegeID uuid.UUID,
	includeSensitive bool,
) ([]models.SettingComparison, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Settings service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	storedSettings, err := s.repo.ListCollegeSettings(ctx, collegeID, true)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, "Failed to retrieve college settings")
	}

	storedMap := make(map[string]models.CollegeSetting, len(storedSettings))
	for _, st := range storedSettings {
		storedMap[st.SettingKey] = st
	}

	var comparisons []models.SettingComparison
	for _, def := range models.GlobalSettingDefinitions {
		comparison := models.SettingComparison{
			SettingKey:    def.Key,
			Category:      def.Category,
			DisplayName:   def.DisplayName,
			GlobalDefault: def.DefaultValue,
			IsSensitive:   def.IsSensitive,
		}

		if stored, exists := storedMap[def.Key]; exists {
			comparison.EffectiveValue = stored.SettingValue
			comparison.IsOverridden = true
		} else {
			comparison.IsOverridden = false
			comparison.EffectiveValue = def.DefaultValue

			if def.Key == "timezone" && college.Timezone != "" {
				comparison.EffectiveValue = college.Timezone
			} else if def.Key == "college_name" && college.Name != "" {
				comparison.EffectiveValue = college.Name
			} else if def.Key == "contact_email" && college.ContactEmail != nil && *college.ContactEmail != "" {
				comparison.EffectiveValue = *college.ContactEmail
			}
		}

		// Check if effective value is valid according to schema & security floors
		err := validators.ValidateSettingValue(def.Key, comparison.EffectiveValue)
		comparison.IsOverrideValid = (err == nil)
		if err != nil {
			comparison.ValidationNotice = err.Error()
		}

		// Redact secrets
		if def.IsSensitive && !includeSensitive {
			comparison.GlobalDefault = "[REDACTED]"
			comparison.EffectiveValue = "[REDACTED]"
		}

		comparisons = append(comparisons, comparison)
	}

	sort.Slice(comparisons, func(i, j int) bool {
		return comparisons[i].SettingKey < comparisons[j].SettingKey
	})

	return comparisons, nil
}

// ListCollegeSettingsHistory retrieves paginated audit logs for college settings operations.
func (s *SettingsService) ListCollegeSettingsHistory(
	ctx context.Context,
	collegeID uuid.UUID,
	settingKey string,
	limit int,
	offset int,
) ([]models.SettingHistoryEntry, int, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, 0, apierrors.New(apierrors.InternalError, "Settings service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, 0, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	_, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, 0, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, 0, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	if settingKey != "" {
		if _, err := validators.ValidateSettingKey(settingKey); err != nil {
			return nil, 0, err
		}
	}

	return s.repo.ListCollegeSettingsHistory(ctx, collegeID, settingKey, limit, offset)
}

// RevertCollegeSetting reverts a college setting to a prior historical version recorded in platform.audit_logs.
// Reversion revalidates the historical value against current mandatory security limits,
// applies the value as a new change, and records an audit log atomically.
func (s *SettingsService) RevertCollegeSetting(
	ctx context.Context,
	collegeID uuid.UUID,
	settingKey string,
	req models.RevertCollegeSettingRequest,
	actors ...interface{},
) (*models.CollegeSetting, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Settings service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	validKey, err := validators.ValidatePlatformSettingKey(settingKey)
	if err != nil {
		return nil, err
	}

	if err := validators.ValidateRevertCollegeSettingRequest(&req); err != nil {
		return nil, err
	}

	def, exists := models.GetSettingDefinition(validKey)
	if !exists {
		return nil, apierrors.New(apierrors.ValidationError, fmt.Sprintf("Unknown configuration key '%s'", validKey))
	}

	actorID, actorRole, err := s.extractActor(ctx, actors...)
	if err != nil {
		return nil, err
	}

	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	if college.Status == "DEACTIVATED" || college.Status == "ARCHIVED" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("cannot revert settings for college with status '%s'", college.Status),
		)
	}

	var updatedSetting *models.CollegeSetting

	err = s.db.WithPlatformTransaction(
		ctx,
		func(txCtx context.Context, _ pgx.Tx) error {
			// 1. Retrieve historical audit entry
			historyEntry, getErr := s.repo.GetSettingsAuditByID(txCtx, collegeID, req.AuditID)
			if getErr != nil {
				if errors.Is(getErr, pgx.ErrNoRows) {
					return apierrors.New(apierrors.NotFound, "Historical configuration audit record not found")
				}
				return fmt.Errorf("failed to retrieve historical audit: %w", getErr)
			}

			// 2. Validate historical value payload
			targetVal := historyEntry.NewValue
			if targetVal == nil {
				targetVal = historyEntry.OldValue
			}
			if targetVal == nil {
				return apierrors.New(apierrors.ValidationError, "Historical audit record contains no restorable setting value")
			}

			// 3. Security Floor Revalidation: Do not restore a historical value that violates current security limits!
			if err := validators.ValidateSettingValue(validKey, targetVal); err != nil {
				return apierrors.New(
					apierrors.ValidationError,
					fmt.Sprintf("Cannot revert: historical setting value violates current mandatory security policy: %v", err),
				)
			}

			// Convert targetVal to models.JSONB map
			jsonbVal, err := toJSONBMap(targetVal, validKey)
			if err != nil {
				return apierrors.New(apierrors.ValidationError, fmt.Sprintf("Failed to format historical setting value: %v", err))
			}

			// 4. Capture current setting value for audit
			var currentVal interface{}
			existing, currErr := s.repo.GetCollegeSettingByKey(txCtx, collegeID, validKey)
			if currErr == nil {
				currentVal = existing.SettingValue
			} else {
				currentVal = def.DefaultValue
			}

			// 5. Apply the historical value as a new update (preserves all history)
			var upsertErr error
			updatedSetting, upsertErr = s.repo.UpsertCollegeSetting(
				txCtx,
				collegeID,
				validKey,
				jsonbVal,
				def.IsSensitive,
			)
			if upsertErr != nil {
				return fmt.Errorf("failed to apply reverted setting: %w", upsertErr)
			}

			// 6. Record audit log for the reversion atomically
			auditErr := s.repo.RecordSettingsAudit(txCtx, repository.SettingsAuditParams{
				CollegeID:   collegeID,
				ActorUserID: actorID,
				ActorRole:   actorRole,
				Module:      "platform_college_settings",
				Action:      "REVERT_COLLEGE_SETTING",
				EntityType:  "COLLEGE_SETTING",
				EntityID:    &updatedSetting.CollegeSettingID,
				OldData:     map[string]interface{}{"setting_key": validKey, "setting_value": currentVal},
				NewData: map[string]interface{}{
					"setting_key":            validKey,
					"setting_value":          updatedSetting.SettingValue,
					"reverted_from_audit_id": req.AuditID,
				},
				Reason:   &req.Reason,
				Severity: "INFO",
			})
			if auditErr != nil {
				return fmt.Errorf("failed to record revert audit: %w", auditErr)
			}

			return nil
		},
	)
	if err != nil {
		var apiErr *apierrors.APIError
		if errors.As(err, &apiErr) {
			return nil, apiErr
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to revert college setting: %v", err))
	}

	return updatedSetting, nil
}

// toJSONBMap converts an arbitrary setting value into models.JSONB (map[string]interface{}).
func toJSONBMap(val interface{}, key string) (models.JSONB, error) {
	if m, ok := val.(models.JSONB); ok {
		return m, nil
	}
	if m, ok := val.(map[string]interface{}); ok {
		return models.JSONB(m), nil
	}

	// Try marshal/unmarshal as map
	b, err := json.Marshal(val)
	if err != nil {
		return nil, err
	}
	var m map[string]interface{}
	if err := json.Unmarshal(b, &m); err == nil {
		return models.JSONB(m), nil
	}

	// If scalar or array, wrap in standard value envelope
	return models.JSONB{"value": val}, nil
}

// ListSettingDefinitions returns all registered platform setting definitions sorted by key.
func (s *SettingsService) ListSettingDefinitions() []models.SettingDefinition {
	defs := make([]models.SettingDefinition, 0, len(models.GlobalSettingDefinitions))
	for _, def := range models.GlobalSettingDefinitions {
		defs = append(defs, def)
	}
	sort.Slice(defs, func(i, j int) bool {
		return defs[i].Key < defs[j].Key
	})
	return defs
}

