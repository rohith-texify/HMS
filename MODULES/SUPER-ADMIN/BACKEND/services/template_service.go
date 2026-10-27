package services

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// TemplateService provides business logic for entitlement template management.
type TemplateService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewTemplateService constructs a new TemplateService instance.
func NewTemplateService(db *database.Database, repo *repository.Repository) *TemplateService {
	return &TemplateService{
		db:   db,
		repo: repo,
	}
}

// ListTemplates retrieves entitlement templates matching the criteria with pagination.
func (s *TemplateService) ListTemplates(
	ctx context.Context,
	params models.ListTemplatesParams,
) ([]models.EntitlementTemplate, *models.PaginationMeta, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, nil, apierrors.New(
			apierrors.InternalError,
			"Template service is not configured",
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

	templates, total, err := s.repo.ListEntitlementTemplates(ctx, params.IsActive, limit, offset)
	if err != nil {
		return nil, nil, apierrors.New(
			apierrors.InternalError,
			"Failed to list entitlement templates",
		)
	}

	if templates == nil {
		templates = []models.EntitlementTemplate{}
	}

	meta := models.NewPaginationMeta(limit, offset, total)
	return templates, meta, nil
}

// GetTemplate retrieves a single entitlement template by its UUID.
func (s *TemplateService) GetTemplate(
	ctx context.Context,
	templateID uuid.UUID,
) (*models.EntitlementTemplate, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Template service is not configured",
		)
	}

	if templateID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Template ID is required",
		)
	}

	tmpl, err := s.repo.GetEntitlementTemplateByID(ctx, templateID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"Entitlement template not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve entitlement template",
		)
	}

	return tmpl, nil
}

// CreateTemplate creates a new entitlement template with validation and audit logging.
func (s *TemplateService) CreateTemplate(
	ctx context.Context,
	req models.CreateTemplateRequest,
	actors ...interface{},
) (*models.EntitlementTemplate, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Template service is not configured",
		)
	}

	if err := validators.ValidateCreateTemplateRequest(&req); err != nil {
		return nil, err
	}

	// Extract actor ID and role
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
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"Authenticated actor user ID is required",
			)
		}
	}

	// Verify template code availability
	existing, err := s.repo.GetEntitlementTemplateByCode(ctx, req.TemplateCode)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to check template code availability",
		)
	}
	if existing != nil {
		return nil, apierrors.New(
			apierrors.Conflict,
			"Template code already exists",
		)
	}

	version := 1
	if req.Version > 0 {
		version = req.Version
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	var created *models.EntitlementTemplate
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var createErr error
		created, createErr = s.repo.CreateEntitlementTemplate(txCtx, models.EntitlementTemplate{
			TemplateCode: req.TemplateCode,
			Name:         req.Name,
			Description:  req.Description,
			Version:      version,
			IsActive:     isActive,
		})
		if createErr != nil {
			return createErr
		}

		auditErr := s.repo.RecordTemplateAudit(txCtx, repository.TemplateAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Action:      "CREATE_TEMPLATE",
			TemplateID:  created.TemplateID,
			NewData:     created,
		})
		if auditErr != nil {
			return fmt.Errorf("failed to write audit log: %w", auditErr)
		}

		return nil
	})

	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			return nil, apierrors.New(
				apierrors.Conflict,
				"Template code already exists",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to create entitlement template",
		)
	}

	return created, nil
}

// UpdateTemplate updates permitted fields of an existing entitlement template.
func (s *TemplateService) UpdateTemplate(
	ctx context.Context,
	templateID uuid.UUID,
	req models.UpdateTemplateRequest,
	actors ...interface{},
) (*models.EntitlementTemplate, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Template service is not configured",
		)
	}

	if templateID == uuid.Nil {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Template ID is required",
		)
	}

	if err := validators.ValidateUpdateTemplateRequest(&req); err != nil {
		return nil, err
	}

	// Extract actor ID and role
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
			return nil, apierrors.New(
				apierrors.Unauthorized,
				"Authenticated actor user ID is required",
			)
		}
	}

	// Verify template exists
	existing, err := s.repo.GetEntitlementTemplateByID(ctx, templateID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(
				apierrors.NotFound,
				"Entitlement template not found",
			)
		}
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve existing entitlement template",
		)
	}

	var updated *models.EntitlementTemplate
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var updateErr error
		updated, updateErr = s.repo.UpdateEntitlementTemplate(txCtx, templateID, repository.UpdateTemplateParams{
			Name:        req.Name,
			Description: req.Description,
			Version:     req.Version,
			IsActive:    req.IsActive,
		})
		if updateErr != nil {
			return updateErr
		}

		auditErr := s.repo.RecordTemplateAudit(txCtx, repository.TemplateAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Action:      "UPDATE_TEMPLATE",
			TemplateID:  templateID,
			OldData:     existing,
			NewData:     updated,
		})
		if auditErr != nil {
			return fmt.Errorf("failed to write audit log: %w", auditErr)
		}

		return nil
	})

	if err != nil {
		return nil, apierrors.New(
			apierrors.InternalError,
			"Failed to update entitlement template",
		)
	}

	return updated, nil
}

// DeleteTemplate removes an entitlement template by its UUID.
func (s *TemplateService) DeleteTemplate(
	ctx context.Context,
	templateID uuid.UUID,
	actors ...interface{},
) error {
	if s == nil || s.repo == nil || s.db == nil {
		return apierrors.New(
			apierrors.InternalError,
			"Template service is not configured",
		)
	}

	if templateID == uuid.Nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Template ID is required",
		)
	}

	// Extract actor ID and role
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
			return apierrors.New(
				apierrors.Unauthorized,
				"Authenticated actor user ID is required",
			)
		}
	}

	existing, err := s.repo.GetEntitlementTemplateByID(ctx, templateID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apierrors.New(
				apierrors.NotFound,
				"Entitlement template not found",
			)
		}
		return apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve existing entitlement template",
		)
	}

	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		delErr := s.repo.DeleteEntitlementTemplate(txCtx, templateID)
		if delErr != nil {
			return delErr
		}

		auditErr := s.repo.RecordTemplateAudit(txCtx, repository.TemplateAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			Action:      "DELETE_TEMPLATE",
			TemplateID:  templateID,
			OldData:     existing,
			Severity:    "WARNING",
		})
		if auditErr != nil {
			return fmt.Errorf("failed to write audit log: %w", auditErr)
		}

		return nil
	})

	if err != nil {
		if strings.Contains(err.Error(), "referenced by other records") {
			return apierrors.New(
				apierrors.Conflict,
				"Cannot delete entitlement template: it is referenced by other records",
			)
		}
		return apierrors.New(
			apierrors.InternalError,
			"Failed to delete entitlement template",
		)
	}

	return nil
}

// ApplyTemplateToCollege validates the prerequisites for template application and enforces
// college lifecycle states, while safely reporting the current database schema blocker
// regarding missing template-to-module mappings.
func (s *TemplateService) ApplyTemplateToCollege(
	ctx context.Context,
	collegeID uuid.UUID,
	templateID uuid.UUID,
	actors ...interface{},
) error {
	if s == nil || s.repo == nil || s.db == nil {
		return apierrors.New(
			apierrors.InternalError,
			"Template service is not configured",
		)
	}

	if collegeID == uuid.Nil {
		return apierrors.New(
			apierrors.ValidationError,
			"College ID is required",
		)
	}

	if templateID == uuid.Nil {
		return apierrors.New(
			apierrors.ValidationError,
			"Template ID is required",
		)
	}

	// 1. Verify college exists and lifecycle state
	college, err := s.repo.GetCollegeByID(ctx, collegeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apierrors.New(
				apierrors.NotFound,
				"College not found",
			)
		}
		return apierrors.New(
			apierrors.InternalError,
			"Failed to verify college",
		)
	}

	if college.Status == "DEACTIVATED" || college.Status == "ARCHIVED" || college.Status == "SUSPENDED" {
		return apierrors.New(
			apierrors.ValidationError,
			fmt.Sprintf("cannot apply entitlement template to college with status '%s'", college.Status),
		)
	}

	// 2. Verify template exists and active status
	tmpl, err := s.repo.GetEntitlementTemplateByID(ctx, templateID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apierrors.New(
				apierrors.NotFound,
				"Entitlement template not found",
			)
		}
		return apierrors.New(
			apierrors.InternalError,
			"Failed to retrieve entitlement template",
		)
	}

	if !tmpl.IsActive {
		return apierrors.New(
			apierrors.ValidationError,
			"cannot apply an inactive entitlement template",
		)
	}

	// 3. Schema limitation: The current database schema contains platform.entitlement_templates
	// metadata, but does not contain a mapping table (e.g. platform.entitlement_template_modules)
	// or module lists to associate specific modules with a template.
	return apierrors.New(
		apierrors.ValidationError,
		"entitlement template module mappings are not supported by the current database schema",
	)
}
