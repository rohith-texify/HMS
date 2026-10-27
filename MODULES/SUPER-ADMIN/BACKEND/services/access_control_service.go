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

// AccessControlService provides business logic for granular feature access control,
// hierarchical inheritance, read-only mode restrictions, and "Why is this denied?" diagnostic tracing.
type AccessControlService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewAccessControlService creates a new AccessControlService.
func NewAccessControlService(db *database.Database, repo *repository.Repository) *AccessControlService {
	return &AccessControlService{
		db:   db,
		repo: repo,
	}
}

// GetTenantAccessHierarchy retrieves the comprehensive App -> Module -> Feature -> Action access tree.
func (s *AccessControlService) GetTenantAccessHierarchy(
	ctx context.Context,
	collegeID uuid.UUID,
) (*models.HierarchicalAccessMatrixResponse, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Access control service is not configured")
	}

	if collegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}

	res, err := s.repo.GetTenantAccessHierarchy(ctx, collegeID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to get access hierarchy: %v", err))
	}
	if res == nil {
		return nil, apierrors.New(apierrors.NotFound, "College tenant not found")
	}

	return res, nil
}

// UpdateFeatureAccess updates the configured status, mode, and effective dates for a feature or module.
func (s *AccessControlService) UpdateFeatureAccess(
	ctx context.Context,
	collegeID uuid.UUID,
	moduleID uuid.UUID,
	req models.UpdateFeatureAccessRequest,
	actorUserID uuid.UUID,
	actorRole string,
) error {
	if s == nil || s.repo == nil {
		return apierrors.New(apierrors.InternalError, "Access control service is not configured")
	}

	if collegeID == uuid.Nil {
		return apierrors.New(apierrors.ValidationError, "College ID is required")
	}
	if moduleID == uuid.Nil {
		return apierrors.New(apierrors.ValidationError, "Module ID is required")
	}

	cleanReason := strings.TrimSpace(req.Reason)
	if len(cleanReason) < 3 {
		return apierrors.New(apierrors.ValidationError, "Change reason is required (minimum 3 characters)")
	}

	if req.EffectiveTo != nil && req.EffectiveFrom != nil && req.EffectiveTo.Before(*req.EffectiveFrom) {
		return apierrors.New(apierrors.ValidationError, "Effective expiry date must be after start date")
	}

	if actorUserID == uuid.Nil {
		if ctxID, ok := database.PlatformUserIDFromContext(ctx); ok && ctxID != uuid.Nil {
			actorUserID = ctxID
		}
	}
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	err := s.repo.UpdateCollegeFeatureEntitlement(ctx, collegeID, moduleID, req, actorUserID, actorRole)
	if err != nil {
		return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update feature entitlement: %v", err))
	}

	return nil
}

// EvaluateWhyDenied evaluates an access request against tenant status, catalog status, parent inheritance,
// tenant entitlement, read-only mode, and user permissions to produce a transparent diagnostic trace.
func (s *AccessControlService) EvaluateWhyDenied(
	ctx context.Context,
	req models.EvaluateAccessRequest,
) (*models.WhyDeniedEvaluationReport, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Access control service is not configured")
	}

	if req.CollegeID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "College ID is required")
	}
	if strings.TrimSpace(req.ModuleOrFeatureCode) == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Module or feature code is required")
	}

	report, err := s.repo.EvaluateWhyDenied(ctx, req)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to evaluate access decision: %v", err))
	}

	return report, nil
}
