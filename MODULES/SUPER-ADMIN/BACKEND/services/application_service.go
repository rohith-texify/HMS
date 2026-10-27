package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

// ApplicationService manages business rules and transitions for application management.
type ApplicationService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewApplicationService creates a new application service instance.
func NewApplicationService(db *database.Database, repo *repository.Repository) *ApplicationService {
	return &ApplicationService{
		db:   db,
		repo: repo,
	}
}

// GetCatalogue returns the standard five-application platform catalogue.
func (s *ApplicationService) GetCatalogue(ctx context.Context) []models.ApplicationCatalogueItem {
	return models.DefaultApplicationCatalogue
}

// ListCollegeApplications returns all 5 application configurations for a specified college.
func (s *ApplicationService) ListCollegeApplications(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]models.CollegeApplicationConfig, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Application service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	// Verify college exists
	_, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	storedMap, err := s.repo.ListCollegeAppSettings(ctx, collegeID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to retrieve application settings: %v", err))
	}

	configs := make([]models.CollegeApplicationConfig, 0, len(models.DefaultApplicationCatalogue))

	for _, item := range models.DefaultApplicationCatalogue {
		cfg := models.CollegeApplicationConfig{
			CollegeID:          collegeID,
			AppID:              item.AppID,
			AppCode:            item.AppCode,
			Name:               item.Name,
			Description:        item.Description,
			Status:             models.AppStatusEnabled, // default
			IsProtected:        item.IsProtected,
			MinVersion:         item.DefaultMinVersion,
			ForceUpdate:        item.DefaultForceUpdate,
			AssociatedModules:  item.AssociatedModules,
			TotalModulesCount:  len(item.AssociatedModules),
		}

		if stored, exists := storedMap[item.AppID]; exists {
			cfg.Status = stored.Status
			if stored.MinVersion != "" {
				cfg.MinVersion = stored.MinVersion
			}
			cfg.ForceUpdate = stored.ForceUpdate
			cfg.UpdatedAt = &stored.UpdatedAt
			cfg.UpdatedBy = stored.UpdatedBy
			cfg.ChangeReason = stored.ChangeReason
		}

		// Calculate active modules count
		activeCount, err := s.repo.GetCollegeActiveModulesCount(ctx, collegeID, item.AssociatedModules)
		if err == nil {
			cfg.ActiveModulesCount = activeCount
		} else {
			cfg.ActiveModulesCount = 0
		}

		// Effective Access:
		// When an application is DISABLED or SUSPENDED, its effective access is FALSE
		// regardless of individual module configurations.
		// When ENABLED, access is permitted and operates on active module entitlements.
		if cfg.Status == models.AppStatusEnabled {
			cfg.EffectiveAccess = true
		} else {
			cfg.EffectiveAccess = false
		}

		configs = append(configs, cfg)
	}

	return configs, nil
}

// GetCollegeApplication retrieves a single application configuration for a college.
func (s *ApplicationService) GetCollegeApplication(
	ctx context.Context,
	collegeID uuid.UUID,
	appID string,
) (*models.CollegeApplicationConfig, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Application service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	item, found := models.GetCatalogueItem(appID)
	if !found {
		return nil, apierrors.New(apierrors.NotFound, fmt.Sprintf("Application '%s' not found in catalogue", appID))
	}

	// Verify college exists
	_, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	stored, err := s.repo.GetCollegeAppSetting(ctx, collegeID, item.AppID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to load application setting: %v", err))
	}

	cfg := &models.CollegeApplicationConfig{
		CollegeID:         collegeID,
		AppID:             item.AppID,
		AppCode:           item.AppCode,
		Name:              item.Name,
		Description:       item.Description,
		Status:            models.AppStatusEnabled,
		IsProtected:       item.IsProtected,
		MinVersion:        item.DefaultMinVersion,
		ForceUpdate:       item.DefaultForceUpdate,
		AssociatedModules: item.AssociatedModules,
		TotalModulesCount: len(item.AssociatedModules),
	}

	if stored != nil {
		cfg.Status = stored.Status
		if stored.MinVersion != "" {
			cfg.MinVersion = stored.MinVersion
		}
		cfg.ForceUpdate = stored.ForceUpdate
		cfg.UpdatedAt = &stored.UpdatedAt
		cfg.UpdatedBy = stored.UpdatedBy
		cfg.ChangeReason = stored.ChangeReason
	}

	activeCount, err := s.repo.GetCollegeActiveModulesCount(ctx, collegeID, item.AssociatedModules)
	if err == nil {
		cfg.ActiveModulesCount = activeCount
	}

	cfg.EffectiveAccess = (cfg.Status == models.AppStatusEnabled)
	return cfg, nil
}

// EnableApplication re-enables an application for a college.
func (s *ApplicationService) EnableApplication(
	ctx context.Context,
	collegeID uuid.UUID,
	appID string,
	actorID uuid.UUID,
	actorRole string,
	reason *string,
) (*models.CollegeApplicationConfig, error) {
	return s.updateApplicationStatus(ctx, collegeID, appID, models.AppStatusEnabled, actorID, actorRole, reason)
}

// DisableApplication disables an application for a college.
// CRITICAL: The Admin/Management Portal (admin_portal) can NEVER be disabled.
func (s *ApplicationService) DisableApplication(
	ctx context.Context,
	collegeID uuid.UUID,
	appID string,
	actorID uuid.UUID,
	actorRole string,
	reason *string,
) (*models.CollegeApplicationConfig, error) {
	item, found := models.GetCatalogueItem(appID)
	if !found {
		return nil, apierrors.New(apierrors.NotFound, fmt.Sprintf("Application '%s' not found in catalogue", appID))
	}

	// Protected Admin Portal check: enforce backend service invariant
	if item.IsProtected || item.AppID == models.AppAdminPortal {
		return nil, apierrors.New(
			apierrors.Conflict,
			"The Admin/Management Portal cannot be disabled as college administrative access must be preserved.",
		)
	}

	return s.updateApplicationStatus(ctx, collegeID, item.AppID, models.AppStatusDisabled, actorID, actorRole, reason)
}

// SuspendApplication temporarily suspends an application for a college.
// CRITICAL: The Admin/Management Portal (admin_portal) can NEVER be suspended.
func (s *ApplicationService) SuspendApplication(
	ctx context.Context,
	collegeID uuid.UUID,
	appID string,
	actorID uuid.UUID,
	actorRole string,
	reason *string,
) (*models.CollegeApplicationConfig, error) {
	item, found := models.GetCatalogueItem(appID)
	if !found {
		return nil, apierrors.New(apierrors.NotFound, fmt.Sprintf("Application '%s' not found in catalogue", appID))
	}

	// Protected Admin Portal check: enforce backend service invariant
	if item.IsProtected || item.AppID == models.AppAdminPortal {
		return nil, apierrors.New(
			apierrors.Conflict,
			"The Admin/Management Portal cannot be suspended as college administrative access must be preserved.",
		)
	}

	return s.updateApplicationStatus(ctx, collegeID, item.AppID, models.AppStatusSuspended, actorID, actorRole, reason)
}

// updateApplicationStatus handles state transition validation, persistence, and audit logging.
func (s *ApplicationService) updateApplicationStatus(
	ctx context.Context,
	collegeID uuid.UUID,
	appID string,
	targetStatus string,
	actorID uuid.UUID,
	actorRole string,
	reason *string,
) (*models.CollegeApplicationConfig, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Application service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	item, found := models.GetCatalogueItem(appID)
	if !found {
		return nil, apierrors.New(apierrors.NotFound, fmt.Sprintf("Application '%s' not found in catalogue", appID))
	}

	// Protected Portal check
	if (targetStatus == models.AppStatusDisabled || targetStatus == models.AppStatusSuspended) &&
		(item.IsProtected || item.AppID == models.AppAdminPortal) {
		return nil, apierrors.New(
			apierrors.Conflict,
			"The Admin/Management Portal cannot be disabled or suspended as college administrative access must be preserved.",
		)
	}

	// Actor validation
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Verify college
	_, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	existing, err := s.repo.GetCollegeAppSetting(ctx, collegeID, item.AppID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to load current application setting: %v", err))
	}

	currentStatus := models.AppStatusEnabled
	currentMinVersion := item.DefaultMinVersion
	currentForceUpdate := item.DefaultForceUpdate

	if existing != nil {
		currentStatus = existing.Status
		if existing.MinVersion != "" {
			currentMinVersion = existing.MinVersion
		}
		currentForceUpdate = existing.ForceUpdate
	}

	// Idempotent check
	if currentStatus == targetStatus {
		return s.GetCollegeApplication(ctx, collegeID, item.AppID)
	}

	// Determine audit action & severity
	var action string
	severity := "INFO"
	switch targetStatus {
	case models.AppStatusEnabled:
		action = "ENABLE_APPLICATION"
	case models.AppStatusDisabled:
		action = "DISABLE_APPLICATION"
		severity = "WARNING"
	case models.AppStatusSuspended:
		action = "SUSPEND_APPLICATION"
		severity = "WARNING"
	default:
		return nil, apierrors.New(apierrors.ValidationError, fmt.Sprintf("Invalid target status: %s", targetStatus))
	}

	newSetting := models.ApplicationStoredSetting{
		AppID:        item.AppID,
		AppCode:      item.AppCode,
		Name:         item.Name,
		Status:       targetStatus,
		MinVersion:   currentMinVersion,
		ForceUpdate:  currentForceUpdate,
		UpdatedAt:    time.Now().UTC(),
		UpdatedBy:    &actorID,
		ChangeReason: reason,
	}

	// Execute within platform transaction boundary
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		// 1. Save application configuration
		if txErr := s.repo.UpsertCollegeAppSetting(txCtx, collegeID, newSetting); txErr != nil {
			return txErr
		}

		// 2. Record immutable audit log
		auditErr := s.repo.RecordApplicationAudit(
			txCtx,
			collegeID,
			actorID,
			actorRole,
			action,
			item.AppID,
			existing,
			newSetting,
			reason,
			severity,
		)
		if auditErr != nil {
			return fmt.Errorf("failed to record application audit log: %w", auditErr)
		}

		return nil
	})

	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update application status: %v", err))
	}

	return s.GetCollegeApplication(ctx, collegeID, item.AppID)
}

// UpdateVersion updates the minimum supported version and force-update requirement for an application.
func (s *ApplicationService) UpdateVersion(
	ctx context.Context,
	collegeID uuid.UUID,
	appID string,
	req models.UpdateAppVersionRequest,
	actorID uuid.UUID,
	actorRole string,
) (*models.CollegeApplicationConfig, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Application service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	item, found := models.GetCatalogueItem(appID)
	if !found {
		return nil, apierrors.New(apierrors.NotFound, fmt.Sprintf("Application '%s' not found in catalogue", appID))
	}

	// Validate SemVer
	trimmedVersion := strings.TrimSpace(req.MinVersion)
	if trimmedVersion == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Minimum version is required")
	}

	_, _, _, err := models.ParseSemVer(trimmedVersion)
	if err != nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("Invalid semantic version format '%s'. Must follow format X.Y or X.Y.Z (e.g. 1.2.0)", trimmedVersion),
		)
	}

	// Actor validation
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Verify college
	_, err = s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	existing, err := s.repo.GetCollegeAppSetting(ctx, collegeID, item.AppID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to load current application setting: %v", err))
	}

	currentStatus := models.AppStatusEnabled
	forceUpdate := item.DefaultForceUpdate
	if req.ForceUpdate != nil {
		forceUpdate = *req.ForceUpdate
	} else if existing != nil {
		forceUpdate = existing.ForceUpdate
	}

	if existing != nil {
		currentStatus = existing.Status
	}

	newSetting := models.ApplicationStoredSetting{
		AppID:        item.AppID,
		AppCode:      item.AppCode,
		Name:         item.Name,
		Status:       currentStatus,
		MinVersion:   trimmedVersion,
		ForceUpdate:  forceUpdate,
		UpdatedAt:    time.Now().UTC(),
		UpdatedBy:    &actorID,
		ChangeReason: req.Reason,
	}

	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		if txErr := s.repo.UpsertCollegeAppSetting(txCtx, collegeID, newSetting); txErr != nil {
			return txErr
		}

		auditErr := s.repo.RecordApplicationAudit(
			txCtx,
			collegeID,
			actorID,
			actorRole,
			"UPDATE_APPLICATION_VERSION",
			item.AppID,
			existing,
			newSetting,
			req.Reason,
			"INFO",
		)
		if auditErr != nil {
			return fmt.Errorf("failed to record version audit: %w", auditErr)
		}

		return nil
	})

	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update application version: %v", err))
	}

	return s.GetCollegeApplication(ctx, collegeID, item.AppID)
}

// GetApplicationHistory retrieves change history for application configuration from platform.audit_logs.
func (s *ApplicationService) GetApplicationHistory(
	ctx context.Context,
	collegeID uuid.UUID,
	appID string,
	limit, offset int,
) ([]models.ApplicationHistoryItem, *models.PaginationMeta, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, nil, apierrors.New(apierrors.InternalError, "Application service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	// Verify college
	_, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	var canonicalAppID string
	if appID != "" {
		item, found := models.GetCatalogueItem(appID)
		if found {
			canonicalAppID = item.AppID
		} else {
			canonicalAppID = appID
		}
	}

	history, total, err := s.repo.ListApplicationHistory(ctx, collegeID, canonicalAppID, limit, offset)
	if err != nil {
		return nil, nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to retrieve application history: %v", err))
	}

	if history == nil {
		history = []models.ApplicationHistoryItem{}
	}

	meta := models.NewPaginationMeta(limit, offset, total)
	return history, meta, nil
}
