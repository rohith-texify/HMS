package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

// PermissionService handles business logic for the permission catalog,
// who-has-what access visualization, orphan detection, and deprecation advisories.
type PermissionService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewPermissionService creates a new PermissionService instance.
func NewPermissionService(db *database.Database, repo *repository.Repository) *PermissionService {
	return &PermissionService{
		db:   db,
		repo: repo,
	}
}

// ListPermissions retrieves a paginated and filtered list of permissions with mapped role counts.
func (s *PermissionService) ListPermissions(
	ctx context.Context,
	filter models.ListPermissionsFilter,
) (*models.ListPermissionsCatalogResponse, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Permission service is not configured")
	}

	limit := filter.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	filter.Limit = limit
	filter.Offset = offset

	perms, total, err := s.repo.ListPermissionsWithStats(ctx, filter)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to list permissions: %v", err))
	}

	return &models.ListPermissionsCatalogResponse{
		Permissions: perms,
		Total:       total,
		Limit:       limit,
		Offset:      offset,
	}, nil
}

// GetPermissionDetail retrieves a single permission and its mapped roles.
func (s *PermissionService) GetPermissionDetail(
	ctx context.Context,
	permissionID uuid.UUID,
) (*models.PermissionDetail, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Permission service is not configured")
	}

	detail, err := s.repo.GetPermissionDetailByID(ctx, permissionID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to get permission detail: %v", err))
	}
	if detail == nil {
		return nil, apierrors.New(apierrors.NotFound, "Permission not found in catalog")
	}

	return detail, nil
}

// GetWhoHasWhat retrieves mapped roles and all users assigned those roles.
func (s *PermissionService) GetWhoHasWhat(
	ctx context.Context,
	permissionID uuid.UUID,
) (*models.WhoHasWhatResponse, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Permission service is not configured")
	}

	resp, err := s.repo.GetPermissionWhoHasWhat(ctx, permissionID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to retrieve who-has-what: %v", err))
	}
	if resp == nil {
		return nil, apierrors.New(apierrors.NotFound, "Permission not found in catalog")
	}

	return resp, nil
}

// ListOrphanPermissions detects permissions with zero role mappings.
func (s *PermissionService) ListOrphanPermissions(
	ctx context.Context,
) (*models.OrphanPermissionsReport, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Permission service is not configured")
	}

	report, err := s.repo.ListOrphanPermissions(ctx)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to list orphan permissions: %v", err))
	}

	return report, nil
}

// GetDeprecationStatus reports the actual architectural status of permission deprecation.
func (s *PermissionService) GetDeprecationStatus(
	ctx context.Context,
) (*models.DeprecationAdvisoryStatus, error) {
	return &models.DeprecationAdvisoryStatus{
		Supported:     false,
		Status:        "BLOCKED",
		Reason:        "The existing PostgreSQL platform.permissions schema does not contain an is_deprecated, deprecated_at, or lifecycle status column. Project constraints strictly prohibit schema migrations or DDL modifications.",
		SchemaBlocker: "Missing column platform.permissions.is_deprecated (boolean) and deprecated_at (timestamptz). Deprecation operations cannot be executed safely without schema support.",
		BlockedCapabilities: []string{
			"flag_permission_deprecated",
			"soft_delete_permission",
			"deprecation_grace_period_enforcement",
			"auto_revoke_on_sunset",
		},
	}, nil
}
