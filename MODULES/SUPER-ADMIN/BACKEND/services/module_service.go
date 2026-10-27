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

// ModuleService handles business logic for module catalogue and college module management.
type ModuleService struct {
	repo *repository.Repository
	db   *database.Database
}

// NewModuleService creates a new module service.
func NewModuleService(
	db *database.Database,
	repo *repository.Repository,
) *ModuleService {
	return &ModuleService{
		repo: repo,
		db:   db,
	}
}

// ListModules retrieves the platform module catalogue with optional filtering and pagination.
func (s *ModuleService) ListModules(
	ctx context.Context,
	params models.ListModulesParams,
) ([]models.Module, *models.PaginationMeta, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, nil, apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
		)
	}

	limit := 20
	if params.Limit > 0 {
		limit = params.Limit
	}
	if limit > 100 {
		limit = 100
	}

	offset := 0
	if params.Offset > 0 {
		offset = params.Offset
	}

	var kindFilter *string
	if params.Kind != "" {
		kindFilter = &params.Kind
	}

	modules, total, err := s.repo.ListModules(ctx, kindFilter, params.IsActive, limit, offset)
	if err != nil {
		return nil, nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve modules",
		)
	}

	if modules == nil {
		modules = []models.Module{}
	}

	meta := models.NewPaginationMeta(limit, offset, total)
	return modules, meta, nil
}

// GetModule retrieves a single module by its ID.
func (s *ModuleService) GetModule(
	ctx context.Context,
	moduleID uuid.UUID,
) (*models.Module, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
		)
	}

	if moduleID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Module ID is required",
		)
	}

	module, err := s.repo.GetModuleByID(ctx, moduleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"Module not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve module",
		)
	}

	return module, nil
}

// CreateModule creates a new platform module with hierarchy verification and audit logging.
func (s *ModuleService) CreateModule(
	ctx context.Context,
	req models.CreateModuleRequest,
	actorID uuid.UUID,
	actorRole string,
) (*models.Module, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
		)
	}

	if actorID == uuid.Nil {
		if ctxID, ok := database.PlatformUserIDFromContext(ctx); ok && ctxID != uuid.Nil {
			actorID = ctxID
		} else {
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"Authenticated actor user ID is required",
			)
		}
	}

	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Verify hierarchy rules
	if req.ParentID != nil && *req.ParentID != uuid.Nil {
		parent, err := s.repo.GetModuleByID(ctx, *req.ParentID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, apierrors.New(
					apierrors.ValidationError,
					"Parent module does not exist",
				)
			}
			return nil, apierrors.New(
				apierrors.InternalError,
				"Failed to verify parent module",
			)
		}

		if req.Kind == "APP" {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"APP root modules cannot have a parent",
			)
		}

		if req.Kind == "MODULE" && parent.Kind != "APP" {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"Parent of a MODULE must be an APP",
			)
		}

		if req.Kind == "FEATURE" && parent.Kind != "MODULE" {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"Parent of a FEATURE must be a MODULE",
			)
		}
	} else if req.Kind != "APP" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("%s must specify a valid parent_id", req.Kind),
		)
	}

	// Check for duplicate module code upfront
	existing, err := s.repo.GetModuleByCode(ctx, req.ModuleCode)
	if err == nil && existing != nil {
		return nil, apierrors.New(
			apierrors.Conflict,
			fmt.Sprintf("Module with code '%s' already exists", req.ModuleCode),
		)
	}

	var created *models.Module
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		created, txErr = s.repo.CreateModule(txCtx, req)
		if txErr != nil {
			return txErr
		}

		auditErr := s.repo.RecordModuleAudit(txCtx, models.ModuleAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Module:      "platform_modules",
			Action:      "CREATE_MODULE",
			EntityType:  "MODULE",
			EntityID:    &created.ModuleID,
			NewData:     created,
			Severity:    "INFO",
		})
		if auditErr != nil {
			return fmt.Errorf("failed to record module audit: %w", auditErr)
		}

		return nil
	})

	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			return nil, apierrors.New(
				apierrors.Conflict,
				err.Error(),
			)
		}
		if strings.Contains(err.Error(), "cannot have a parent") || strings.Contains(err.Error(), "must be") {
			return nil, apierrors.New(
				apierrors.ValidationError,
				err.Error(),
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to create module: %v", err),
		)
	}

	return created, nil
}

// UpdateModule updates an existing platform module with core protection and audit logging.
func (s *ModuleService) UpdateModule(
	ctx context.Context,
	moduleID uuid.UUID,
	req models.UpdateModuleRequest,
	actorID uuid.UUID,
	actorRole string,
) (*models.Module, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
		)
	}

	if moduleID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Module ID is required",
		)
	}

	if actorID == uuid.Nil {
		if ctxID, ok := database.PlatformUserIDFromContext(ctx); ok && ctxID != uuid.Nil {
			actorID = ctxID
		} else {
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"Authenticated actor user ID is required",
			)
		}
	}

	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	existing, err := s.repo.GetModuleByID(ctx, moduleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"Module not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve module",
		)
	}

	// Core module protections
	if existing.IsCore {
		if req.IsActive != nil && !*req.IsActive {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"Cannot deactivate core module",
			)
		}
		if req.IsCore != nil && !*req.IsCore {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"Cannot remove core status from a core module",
			)
		}
	}

	// Verify hierarchy if ParentID is being changed
	if req.ParentID != nil && *req.ParentID != uuid.Nil {
		parent, err := s.repo.GetModuleByID(ctx, *req.ParentID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, apierrors.New(
					apierrors.ValidationError,
					"Parent module does not exist",
				)
			}
			return nil, apierrors.New(
				apierrors.InternalError,
				"Failed to verify parent module",
			)
		}

		kind := existing.Kind
		if req.Kind != nil {
			kind = *req.Kind
		}

		if kind == "APP" {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"APP root modules cannot have a parent",
			)
		}
		if kind == "MODULE" && parent.Kind != "APP" {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"Parent of a MODULE must be an APP",
			)
		}
		if kind == "FEATURE" && parent.Kind != "MODULE" {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"Parent of a FEATURE must be a MODULE",
			)
		}
	}

	var updated *models.Module
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		updated, txErr = s.repo.UpdateModule(txCtx, moduleID, req)
		if txErr != nil {
			return txErr
		}

		auditErr := s.repo.RecordModuleAudit(txCtx, models.ModuleAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Module:      "platform_modules",
			Action:      "UPDATE_MODULE",
			EntityType:  "MODULE",
			EntityID:    &moduleID,
			OldData:     existing,
			NewData:     updated,
			Severity:    "INFO",
		})
		if auditErr != nil {
			return fmt.Errorf("failed to record module audit: %w", auditErr)
		}

		return nil
	})

	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to update module: %v", err),
		)
	}

	return updated, nil
}

// ToggleModuleStatus activates or deactivates a module with core protection.
func (s *ModuleService) ToggleModuleStatus(
	ctx context.Context,
	moduleID uuid.UUID,
	req models.ToggleModuleStatusRequest,
	actorID uuid.UUID,
	actorRole string,
) (*models.Module, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
		)
	}

	if moduleID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Module ID is required",
		)
	}

	if actorID == uuid.Nil {
		if ctxID, ok := database.PlatformUserIDFromContext(ctx); ok && ctxID != uuid.Nil {
			actorID = ctxID
		} else {
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"Authenticated actor user ID is required",
			)
		}
	}

	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	existing, err := s.repo.GetModuleByID(ctx, moduleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"Module not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve module",
		)
	}

	// Core module protection: cannot deactivate core module
	if existing.IsCore && !req.IsActive {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Cannot deactivate core module",
		)
	}

	if existing.IsActive == req.IsActive {
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("Module is already in the requested state (is_active=%v)", req.IsActive),
		)
	}

	severity := "INFO"
	if !req.IsActive {
		severity = "WARNING"
	}

	var updated *models.Module
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		updated, txErr = s.repo.ToggleModuleStatus(txCtx, moduleID, req.IsActive)
		if txErr != nil {
			return txErr
		}

		reason := req.Reason
		auditErr := s.repo.RecordModuleAudit(txCtx, models.ModuleAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Module:      "platform_modules",
			Action:      "TOGGLE_MODULE_STATUS",
			EntityType:  "MODULE",
			EntityID:    &moduleID,
			OldData:     existing,
			NewData:     updated,
			Reason:      &reason,
			Severity:    severity,
		})
		if auditErr != nil {
			return fmt.Errorf("failed to record module audit: %w", auditErr)
		}

		return nil
	})

	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to toggle module status: %v", err),
		)
	}

	return updated, nil
}

// DeleteModule deletes a module with core protection.
func (s *ModuleService) DeleteModule(
	ctx context.Context,
	moduleID uuid.UUID,
	actorID uuid.UUID,
	actorRole string,
) error {
	if s == nil || s.repo == nil || s.db == nil {
		return apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
		)
	}

	if moduleID == uuid.Nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Module ID is required",
		)
	}

	if actorID == uuid.Nil {
		if ctxID, ok := database.PlatformUserIDFromContext(ctx); ok && ctxID != uuid.Nil {
			actorID = ctxID
		} else {
			return apierrors.New(
				apierrors.Unauthorized,
				"Authenticated actor user ID is required",
			)
		}
	}

	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	existing, err := s.repo.GetModuleByID(ctx, moduleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apierrors.New(
				apierrors.NotFound,
				"Module not found",
			)
		}
		return apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve module",
		)
	}

	if existing.IsCore {
		return apierrors.New(
			apierrors.ValidationError,
			"Cannot delete core module",
		)
	}

	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		if txErr := s.repo.DeleteModule(txCtx, moduleID); txErr != nil {
			return txErr
		}

		auditErr := s.repo.RecordModuleAudit(txCtx, models.ModuleAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Module:      "platform_modules",
			Action:      "DELETE_MODULE",
			EntityType:  "MODULE",
			EntityID:    &moduleID,
			OldData:     existing,
			Severity:    "WARNING",
		})
		if auditErr != nil {
			return fmt.Errorf("failed to record module audit: %w", auditErr)
		}

		return nil
	})

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apierrors.New(
				apierrors.NotFound,
				"Module not found",
			)
		}
		if strings.Contains(err.Error(), "cannot delete module with") {
			return apierrors.New(
				apierrors.Conflict,
				err.Error(),
			)
		}
		return apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to delete module: %v", err),
		)
	}

	return nil
}

// ListCollegeModules retrieves college-specific module availability.
func (s *ModuleService) ListCollegeModules(
	ctx context.Context,
	collegeID uuid.UUID,
	status *string,
	limit, offset int,
) ([]models.CollegeModuleWithDetails, *models.PaginationMeta, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, nil, apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return nil, nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
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

	_, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, apierrors.New(
				apierrors.NotFound,
				"College not found",
			)
		}
		return nil, nil, apierrors.New(
			apierrors.InternalError,
			"Failed to verify college",
		)
	}

	collegeModules, total, err := s.repo.ListCollegeModules(ctx, collegeID, status, limit, offset)
	if err != nil {
		return nil, nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve college modules",
		)
	}

	if collegeModules == nil {
		collegeModules = []models.CollegeModuleWithDetails{}
	}

	meta := models.NewPaginationMeta(limit, offset, total)
	return collegeModules, meta, nil
}

// AssignCollegeModule assigns a module to a college with entitlement checks and audit logging.
func (s *ModuleService) AssignCollegeModule(
	ctx context.Context,
	collegeID uuid.UUID,
	req models.AssignCollegeModuleRequest,
	changedBy uuid.UUID,
	actorRole string,
) (*models.CollegeModuleWithDetails, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	if req.ModuleID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Module ID is required",
		)
	}

	if changedBy == uuid.Nil {
		if ctxID, ok := database.PlatformUserIDFromContext(ctx); ok && ctxID != uuid.Nil {
			changedBy = ctxID
		} else {
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"Authenticated actor user ID is required",
			)
		}
	}

	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// 1. Verify college exists and check lifecycle rules
	college, err := s.repo.GetCollegeByID(ctx, collegeID)
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

	if college.Status == "DEACTIVATED" || college.Status == "ARCHIVED" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("cannot assign module to college with status '%s'", college.Status),
		)
	}

	if college.Status == "SUSPENDED" && req.Status == "ACTIVE" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"cannot activate module for a suspended college",
		)
	}

	// 2. Verify module exists and is active
	module, err := s.repo.GetModuleByID(ctx, req.ModuleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"Module not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to verify module",
		)
	}

	if !module.IsActive {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Cannot assign an inactive module to a college",
		)
	}

	// 3. Entitlement boundary: if module has a parent, verify parent is assigned to this college
	if module.ParentID != nil && *module.ParentID != uuid.Nil {
		parentAssignment, err := s.repo.GetCollegeModuleByCollegeAndModuleID(ctx, collegeID, *module.ParentID)
		if err != nil || parentAssignment == nil {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"Cannot assign module/feature: parent module must be assigned to this college first",
			)
		}
		if parentAssignment.Status != "ACTIVE" {
			return nil, apierrors.New(
				apierrors.ValidationError,
				"Cannot assign module/feature: parent module assignment is not active",
			)
		}
	}

	// 4. Verify not already assigned
	existingAssignment, _ := s.repo.GetCollegeModuleByCollegeAndModuleID(ctx, collegeID, req.ModuleID)
	if existingAssignment != nil {
		return nil, apierrors.New(
			apierrors.Conflict,
			"Module is already assigned to this college",
		)
	}

	// 5. Execute assignment in transaction
	var result *models.CollegeModuleWithDetails
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		result, txErr = s.repo.AssignCollegeModule(txCtx, collegeID, req, changedBy)
		if txErr != nil {
			return txErr
		}

		auditErr := s.repo.RecordModuleAudit(txCtx, models.ModuleAuditParams{
			CollegeID:   &collegeID,
			ActorUserID: changedBy,
			ActorRole:   actorRole,
			Module:      "platform_college_modules",
			Action:      "ASSIGN_COLLEGE_MODULE",
			EntityType:  "COLLEGE_MODULE",
			EntityID:    &result.CollegeModuleID,
			NewData:     result,
			Reason:      req.Reason,
			Severity:    "INFO",
		})
		if auditErr != nil {
			return fmt.Errorf("failed to record audit: %w", auditErr)
		}

		return nil
	})

	if err != nil {
		if strings.Contains(err.Error(), "already assigned") {
			return nil, apierrors.New(
				apierrors.Conflict,
				err.Error(),
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to assign college module: %v", err),
		)
	}

	return result, nil
}

// UpdateCollegeModule updates college module availability and settings by college_module_id.
func (s *ModuleService) UpdateCollegeModule(
	ctx context.Context,
	collegeModuleID uuid.UUID,
	req models.UpdateCollegeModuleRequest,
	changedBy uuid.UUID,
	actorRole string,
) (*models.CollegeModule, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
		)
	}

	if collegeModuleID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College module ID is required",
		)
	}

	if changedBy == uuid.Nil {
		if ctxID, ok := database.PlatformUserIDFromContext(ctx); ok && ctxID != uuid.Nil {
			changedBy = ctxID
		} else {
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"Authenticated actor user ID is required",
			)
		}
	}

	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	existing, err := s.repo.GetCollegeModuleByID(ctx, collegeModuleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"College module assignment not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve college module",
		)
	}

	// Verify college lifecycle
	college, err := s.repo.GetCollegeByID(ctx, existing.CollegeID)
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

	if college.Status == "DEACTIVATED" || college.Status == "ARCHIVED" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("cannot modify college modules for college with status '%s'", college.Status),
		)
	}

	if college.Status == "SUSPENDED" && req.Status == "ACTIVE" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"cannot activate module for a suspended college",
		)
	}

	// Core module check: cannot disable a core module for a college
	module, err := s.repo.GetModuleByID(ctx, existing.ModuleID)
	if err == nil && module != nil && module.IsCore && req.Status != "ACTIVE" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Cannot disable core module for college",
		)
	}

	var collegeModule *models.CollegeModule
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		collegeModule, txErr = s.repo.UpdateCollegeModule(txCtx, collegeModuleID, req, changedBy)
		if txErr != nil {
			return txErr
		}

		auditErr := s.repo.RecordModuleAudit(txCtx, models.ModuleAuditParams{
			CollegeID:   &existing.CollegeID,
			ActorUserID: changedBy,
			ActorRole:   actorRole,
			Module:      "platform_college_modules",
			Action:      "UPDATE_COLLEGE_MODULE",
			EntityType:  "COLLEGE_MODULE",
			EntityID:    &collegeModuleID,
			OldData:     existing,
			NewData:     collegeModule,
			Reason:      req.Reason,
			Severity:    "INFO",
		})
		if auditErr != nil {
			return fmt.Errorf("failed to record audit: %w", auditErr)
		}

		if req.Status != "ACTIVE" {
			cascadeReason := "Cascaded deactivation from parent module"
			if req.Reason != nil && strings.TrimSpace(*req.Reason) != "" {
				cascadeReason = fmt.Sprintf("Cascaded deactivation from parent module: %s", *req.Reason)
			}
			children, err := s.repo.CascadeDeactivateChildCollegeModules(txCtx, existing.CollegeID, existing.ModuleID, changedBy, cascadeReason)
			if err != nil {
				return fmt.Errorf("failed to cascade deactivate child college modules: %w", err)
			}
			for _, child := range children {
				childAuditErr := s.repo.RecordModuleAudit(txCtx, models.ModuleAuditParams{
					CollegeID:   &existing.CollegeID,
					ActorUserID: changedBy,
					ActorRole:   actorRole,
					Module:      "platform_college_modules",
					Action:      "CASCADE_DEACTIVATE_COLLEGE_MODULE",
					EntityType:  "COLLEGE_MODULE",
					EntityID:    &child.CollegeModuleID,
					OldData:     map[string]interface{}{"status": "ACTIVE"},
					NewData:     child,
					Reason:      &cascadeReason,
					Severity:    "INFO",
				})
				if childAuditErr != nil {
					return fmt.Errorf("failed to record cascade deactivation audit: %w", childAuditErr)
				}
			}
		}

		return nil
	})

	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to update college module: %v", err),
		)
	}

	return collegeModule, nil
}

// UpdateCollegeModuleByCollegeAndModule updates college module assignment by collegeID and moduleID.
func (s *ModuleService) UpdateCollegeModuleByCollegeAndModule(
	ctx context.Context,
	collegeID, moduleID uuid.UUID,
	req models.UpdateCollegeModuleRequest,
	changedBy uuid.UUID,
	actorRole string,
) (*models.CollegeModuleWithDetails, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	if moduleID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Module ID is required",
		)
	}

	if changedBy == uuid.Nil {
		if ctxID, ok := database.PlatformUserIDFromContext(ctx); ok && ctxID != uuid.Nil {
			changedBy = ctxID
		} else {
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"Authenticated actor user ID is required",
			)
		}
	}

	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Verify college lifecycle
	college, err := s.repo.GetCollegeByID(ctx, collegeID)
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

	if college.Status == "DEACTIVATED" || college.Status == "ARCHIVED" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("cannot modify college modules for college with status '%s'", college.Status),
		)
	}

	if college.Status == "SUSPENDED" && req.Status == "ACTIVE" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"cannot activate module for a suspended college",
		)
	}

	existing, err := s.repo.GetCollegeModuleByCollegeAndModuleID(ctx, collegeID, moduleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"College module assignment not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve college module assignment",
		)
	}

	// Core module check: cannot disable a core module for a college
	if existing.IsCore && req.Status != "ACTIVE" {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Cannot disable core module for college",
		)
	}

	var result *models.CollegeModuleWithDetails
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		result, txErr = s.repo.UpdateCollegeModuleByCollegeAndModule(txCtx, collegeID, moduleID, req, changedBy)
		if txErr != nil {
			return txErr
		}

		auditErr := s.repo.RecordModuleAudit(txCtx, models.ModuleAuditParams{
			CollegeID:   &collegeID,
			ActorUserID: changedBy,
			ActorRole:   actorRole,
			Module:      "platform_college_modules",
			Action:      "UPDATE_COLLEGE_MODULE",
			EntityType:  "COLLEGE_MODULE",
			EntityID:    &result.CollegeModuleID,
			OldData:     existing,
			NewData:     result,
			Reason:      req.Reason,
			Severity:    "INFO",
		})
		if auditErr != nil {
			return fmt.Errorf("failed to record audit: %w", auditErr)
		}

		if req.Status != "ACTIVE" {
			cascadeReason := "Cascaded deactivation from parent module"
			if req.Reason != nil && strings.TrimSpace(*req.Reason) != "" {
				cascadeReason = fmt.Sprintf("Cascaded deactivation from parent module: %s", *req.Reason)
			}
			children, err := s.repo.CascadeDeactivateChildCollegeModules(txCtx, collegeID, moduleID, changedBy, cascadeReason)
			if err != nil {
				return fmt.Errorf("failed to cascade deactivate child college modules: %w", err)
			}
			for _, child := range children {
				childAuditErr := s.repo.RecordModuleAudit(txCtx, models.ModuleAuditParams{
					CollegeID:   &collegeID,
					ActorUserID: changedBy,
					ActorRole:   actorRole,
					Module:      "platform_college_modules",
					Action:      "CASCADE_DEACTIVATE_COLLEGE_MODULE",
					EntityType:  "COLLEGE_MODULE",
					EntityID:    &child.CollegeModuleID,
					OldData:     map[string]interface{}{"status": "ACTIVE"},
					NewData:     child,
					Reason:      &cascadeReason,
					Severity:    "INFO",
				})
				if childAuditErr != nil {
					return fmt.Errorf("failed to record cascade deactivation audit: %w", childAuditErr)
				}
			}
		}

		return nil
	})

	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			fmt.Sprintf("Failed to update college module: %v", err),
		)
	}

	return result, nil
}

// GetCollegeEntitlements retrieves all module entitlements for a college.
func (s *ModuleService) GetCollegeEntitlements(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]models.CollegeModuleWithDetails, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
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

	items, _, err := s.repo.ListCollegeModules(ctx, collegeID, nil, 100, 0)
	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve college entitlements",
		)
	}

	if items == nil {
		items = []models.CollegeModuleWithDetails{}
	}

	return items, nil
}

// UpdateCollegeEntitlement updates or assigns an entitlement for a college.
func (s *ModuleService) UpdateCollegeEntitlement(
	ctx context.Context,
	collegeID uuid.UUID,
	req models.AssignCollegeModuleRequest,
	changedBy uuid.UUID,
	actorRole string,
) (*models.CollegeModuleWithDetails, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Module service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	if req.ModuleID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Module ID is required",
		)
	}

	existing, err := s.repo.GetCollegeModuleByCollegeAndModuleID(ctx, collegeID, req.ModuleID)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to check existing entitlement",
		)
	}

	if existing == nil {
		// New assignment
		return s.AssignCollegeModule(ctx, collegeID, req, changedBy, actorRole)
	}

	// Update existing assignment
	updateReq := models.UpdateCollegeModuleRequest{
		Status:        req.Status,
		Mode:          req.Mode,
		EffectiveFrom: req.EffectiveFrom,
		EffectiveTo:   req.EffectiveTo,
		Reason:        req.Reason,
		ChangeReason:  req.ChangeReason,
	}

	return s.UpdateCollegeModuleByCollegeAndModule(ctx, collegeID, req.ModuleID, updateReq, changedBy, actorRole)
}

// GetCollegeEntitlementMatrix returns the comprehensive entitlement matrix for a college,
// joining the full module catalogue with the college's configured and effective states,
// dependency satisfaction, pending approvals, and active workflow counts.
func (s *ModuleService) GetCollegeEntitlementMatrix(
	ctx context.Context,
	collegeID uuid.UUID,
) ([]models.CollegeEntitlementMatrixItem, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Module service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	// 1. Verify college exists
	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	// 2. Fetch full catalogue
	allModules, _, err := s.repo.ListModules(ctx, nil, nil, 100, 0)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, "Failed to fetch module catalogue")
	}

	// Index catalogue by ID
	moduleByID := make(map[uuid.UUID]models.Module, len(allModules))
	childrenByParent := make(map[uuid.UUID][]string)
	for _, m := range allModules {
		moduleByID[m.ModuleID] = m
		if m.ParentID != nil && *m.ParentID != uuid.Nil {
			childrenByParent[*m.ParentID] = append(childrenByParent[*m.ParentID], m.ModuleName)
		}
	}

	// 3. Fetch college module assignments
	assigned, _, err := s.repo.ListCollegeModules(ctx, collegeID, nil, 100, 0)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, "Failed to fetch college assignments")
	}

	assignedByModuleID := make(map[uuid.UUID]models.CollegeModuleWithDetails, len(assigned))
	for _, a := range assigned {
		assignedByModuleID[a.ModuleID] = a
	}

	now := time.Now()
	matrix := make([]models.CollegeEntitlementMatrixItem, 0, len(allModules))

	for _, m := range allModules {
		item := models.CollegeEntitlementMatrixItem{
			CollegeID:        collegeID,
			ModuleID:         m.ModuleID,
			ModuleCode:       m.ModuleCode,
			ModuleName:       m.ModuleName,
			Kind:             m.Kind,
			ParentID:         m.ParentID,
			Priority:         m.Priority,
			IsCore:           m.IsCore,
			CatalogueActive:  m.IsActive,
			ConfiguredStatus: "DISABLED",
			ConfiguredMode:   "FULL",
			EffectiveStatus:  "DISABLED",
			EffectiveMode:    "FULL",
			DependentModules: childrenByParent[m.ModuleID],
		}

		if m.ParentID != nil {
			if parent, exists := moduleByID[*m.ParentID]; exists {
				item.ParentCode = parent.ModuleCode
				item.ParentName = parent.ModuleName
			}
		}

		// Check assignment
		if cm, has := assignedByModuleID[m.ModuleID]; has {
			cmID := cm.CollegeModuleID
			item.CollegeModuleID = &cmID
			item.ConfiguredStatus = cm.Status
			item.ConfiguredMode = cm.Mode
			effFrom := cm.EffectiveFrom
			item.EffectiveFrom = &effFrom
			item.EffectiveTo = cm.EffectiveTo
			item.Reason = cm.Reason
			item.ChangedBy = cm.ChangedBy
			updatedAt := cm.UpdatedAt
			item.UpdatedAt = &updatedAt

			// Evaluate effective access based on catalogue status, dates, and college status
			isDateActive := (cm.EffectiveFrom.Before(now) || cm.EffectiveFrom.Equal(now)) &&
				(cm.EffectiveTo == nil || cm.EffectiveTo.After(now))

			if college.Status == "DEACTIVATED" || college.Status == "ARCHIVED" || college.Status == "SUSPENDED" {
				item.EffectiveStatus = "DISABLED"
			} else if !m.IsActive {
				item.EffectiveStatus = "DISABLED"
			} else if cm.Status == "ACTIVE" && isDateActive {
				item.EffectiveStatus = "ACTIVE"
				item.EffectiveMode = cm.Mode
			} else if cm.Status == "SCHEDULED" {
				item.EffectiveStatus = "SCHEDULED"
			} else {
				item.EffectiveStatus = "DISABLED"
			}
		}

		// Check dependencies (Parent dependency)
		item.DependenciesSatisfied = true
		if m.ParentID != nil && *m.ParentID != uuid.Nil {
			parentAssignment, parentAssigned := assignedByModuleID[*m.ParentID]
			if !parentAssigned || parentAssignment.Status != "ACTIVE" {
				item.DependenciesSatisfied = false
				if parent, exists := moduleByID[*m.ParentID]; exists {
					item.MissingDependencies = append(item.MissingDependencies, parent.ModuleName)
				}
			}
		}

		// Check pending approval
		if approval, _ := s.repo.GetPendingModuleApproval(ctx, collegeID, m.ModuleID); approval != nil {
			item.PendingApprovalID = &approval.RequestID
			item.PendingApprovalStatus = approval.Status
		}

		// Get active workflow counts if applicable
		if wCount, _, err := s.repo.GetPendingWorkflowCounts(ctx, collegeID, m.ModuleCode); err == nil {
			item.PendingWorkflowsCount = wCount
		}

		matrix = append(matrix, item)
	}

	return matrix, nil
}

// PreviewModuleImpact computes dependency impact, pending workflows, and approval requirements
// before an entitlement change is applied.
func (s *ModuleService) PreviewModuleImpact(
	ctx context.Context,
	collegeID, moduleID uuid.UUID,
	targetStatus, targetMode string,
) (*models.ModuleImpactPreview, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Module service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}
	if moduleID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "Module ID is required")
	}

	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "College not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify college")
	}

	module, err := s.repo.GetModuleByID(ctx, moduleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "Module not found")
		}
		return nil, apierrors.New(apierrors.InternalError, "Failed to verify module")
	}

	assignment, _ := s.repo.GetCollegeModuleByCollegeAndModuleID(ctx, collegeID, moduleID)

	currentStatus := "DISABLED"
	currentMode := "FULL"
	if assignment != nil {
		currentStatus = assignment.Status
		currentMode = assignment.Mode
	}

	if targetStatus == "" {
		targetStatus = currentStatus
	}
	if targetMode == "" {
		targetMode = currentMode
	}

	preview := &models.ModuleImpactPreview{
		CollegeID:        collegeID,
		ModuleID:         moduleID,
		ModuleCode:       module.ModuleCode,
		ModuleName:       module.ModuleName,
		CurrentStatus:    currentStatus,
		CurrentMode:      currentMode,
		ProposedStatus:   targetStatus,
		ProposedMode:     targetMode,
		IsMandatory:      module.IsCore || module.Priority == "M",
		CanProceedSafely: true,
	}

	// 1. Mandatory Core Protection
	if (module.IsCore || module.Priority == "M") && targetStatus != "ACTIVE" {
		preview.RequiresApproval = true
		preview.ApprovalReason = fmt.Sprintf("Module '%s' is designated as mandatory/core for the platform. Disabling or suspending requires Super Admin Maker-Checker approval.", module.ModuleName)
	}

	// 2. Identify Dependent Child Modules
	allModules, _, _ := s.repo.ListModules(ctx, nil, nil, 100, 0)
	for _, m := range allModules {
		if m.ParentID != nil && *m.ParentID == moduleID {
			preview.DependentModules = append(preview.DependentModules, m.ModuleName)
		}
	}
	preview.DependentModulesCount = len(preview.DependentModules)

	// 3. Pending Workflow Calculations
	wfCount, summaries, _ := s.repo.GetPendingWorkflowCounts(ctx, collegeID, module.ModuleCode)
	preview.PendingWorkflowsCount = wfCount
	preview.PendingWorkflowsSummary = summaries

	if targetStatus != "ACTIVE" && wfCount > 0 {
		if !preview.RequiresApproval {
			preview.RequiresApproval = true
			preview.ApprovalReason = fmt.Sprintf("Module has %d active or pending workflows. Freeze/read-only policy applies and maker-checker approval is recommended.", wfCount)
		}
	}

	// 4. College Lifecycle Rules
	if college.Status == "DEACTIVATED" || college.Status == "ARCHIVED" {
		preview.CanProceedSafely = false
		preview.RestrictionMessage = fmt.Sprintf("Cannot modify module entitlement: college is '%s'.", college.Status)
	} else if college.Status == "SUSPENDED" && targetStatus == "ACTIVE" {
		preview.CanProceedSafely = false
		preview.RestrictionMessage = "Cannot activate module while college is suspended."
	}

	// 5. Existing pending approval check
	if pendingApp, _ := s.repo.GetPendingModuleApproval(ctx, collegeID, moduleID); pendingApp != nil {
		preview.PendingApprovalID = &pendingApp.RequestID
		preview.CanProceedSafely = false
		preview.RestrictionMessage = "An approval request is already pending for this module entitlement."
	}

	return preview, nil
}

// RequestModuleEntitlementChange applies an immediate change if eligible or creates a maker-checker
// approval request when approval is required or requested.
func (s *ModuleService) RequestModuleEntitlementChange(
	ctx context.Context,
	collegeID, moduleID uuid.UUID,
	req models.UpdateCollegeModuleRequest,
	actorID uuid.UUID,
	actorRole string,
	requestApproval bool,
) (*models.CollegeModuleWithDetails, *models.ApprovalRequestWithSteps, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, nil, apierrors.New(apierrors.InternalError, "Module service is not configured")
	}

	if actorID == uuid.Nil {
		if ctxID, ok := database.PlatformUserIDFromContext(ctx); ok && ctxID != uuid.Nil {
			actorID = ctxID
		} else {
			return nil, nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
		}
	}

	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	if req.Reason == nil || strings.TrimSpace(*req.Reason) == "" {
		return nil, nil, apierrors.New(apierrors.ValidationError, "A meaningful reason is strictly required for entitlement changes")
	}

	// Run impact preview to verify rules and approval needs
	preview, err := s.PreviewModuleImpact(ctx, collegeID, moduleID, req.Status, req.Mode)
	if err != nil {
		return nil, nil, err
	}

	if !preview.CanProceedSafely {
		return nil, nil, apierrors.New(apierrors.Conflict, preview.RestrictionMessage)
	}

	// If policy requires approval OR caller explicitly opted for approval workflow
	if preview.RequiresApproval || requestApproval {
		approvalSvc := NewApprovalService(s.db, s.repo)
		reasonText := *req.Reason
		payload := models.JSONB{
			"college_id":     collegeID.String(),
			"module_id":      moduleID.String(),
			"status":         req.Status,
			"mode":           req.Mode,
			"reason":         reasonText,
			"effective_from": req.EffectiveFrom,
			"effective_to":   req.EffectiveTo,
		}
		snapshot := models.JSONB{
			"module_name":            preview.ModuleName,
			"module_code":            preview.ModuleCode,
			"current_status":         preview.CurrentStatus,
			"proposed_status":        preview.ProposedStatus,
			"dependent_modules":      preview.DependentModules,
			"pending_workflows_count": preview.PendingWorkflowsCount,
			"approval_reason":        preview.ApprovalReason,
		}

		expiresAt := time.Now().Add(7 * 24 * time.Hour) // 7 days window
		approvalReq, err := approvalSvc.CreateApprovalRequest(ctx, models.CreateApprovalRequestInput{
			OperationType: "COLLEGE_MODULE_UPDATE",
			CollegeID:     &collegeID,
			Payload:       payload,
			Reason:        &reasonText,
			Snapshot:      snapshot,
			ExpiresAt:     &expiresAt,
		}, actorID, actorRole)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to create approval request: %w", err)
		}

		return nil, approvalReq, nil
	}

	// Immediate direct execution
	assignReq := models.AssignCollegeModuleRequest{
		ModuleID:      moduleID,
		Status:        req.Status,
		Mode:          req.Mode,
		EffectiveFrom: req.EffectiveFrom,
		EffectiveTo:   req.EffectiveTo,
		Reason:        req.Reason,
		ChangeReason:  req.Reason,
	}

	updated, err := s.UpdateCollegeEntitlement(ctx, collegeID, assignReq, actorID, actorRole)
	if err != nil {
		return nil, nil, err
	}

	return updated, nil, nil
}

// ListModuleHistory retrieves the audit log history for module management.
func (s *ModuleService) ListModuleHistory(
	ctx context.Context,
	collegeID *uuid.UUID,
	moduleID *uuid.UUID,
	limit, offset int,
) ([]models.ModuleHistoryItem, *models.PaginationMeta, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, nil, apierrors.New(apierrors.InternalError, "Module service is not configured")
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

	items, total, err := s.repo.ListModuleHistory(ctx, collegeID, moduleID, limit, offset)
	if err != nil {
		return nil, nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to retrieve module history: %v", err))
	}

	meta := models.NewPaginationMeta(limit, offset, total)
	return items, meta, nil
}

