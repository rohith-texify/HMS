package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

// PlatformModuleService provides read-only access to the platform module catalogue.
type PlatformModuleService struct {
	repo *repository.Repository
}

// NewPlatformModuleService creates the platform module catalogue service.
func NewPlatformModuleService(repo *repository.Repository) *PlatformModuleService {
	return &PlatformModuleService{
		repo: repo,
	}
}

// ListModulesParams contains module catalogue filters and pagination settings.
type ListModulesParams struct {
	Kind     string
	IsActive *bool
	Limit    int
	Offset   int
}

// ListModulesResult contains the modules and pagination metadata.
type ListModulesResult struct {
	Items  []repository.ModuleCatalogItem `json:"items"`
	Total  int                            `json:"total"`
	Limit  int                            `json:"limit"`
	Offset int                            `json:"offset"`
}

// ListModules retrieves the platform module catalogue.
func (s *PlatformModuleService) ListModules(
	ctx context.Context,
	params ListModulesParams,
) (*ListModulesResult, error) {
	kind := strings.ToUpper(strings.TrimSpace(params.Kind))

	if kind != "" &&
		kind != "APP" &&
		kind != "MODULE" &&
		kind != "FEATURE" {
		return nil, fmt.Errorf("invalid module kind: must be APP, MODULE, or FEATURE")
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	var kindFilter *string
	if kind != "" {
		kindFilter = &kind
	}

	items, total, err := s.repo.ListModules(
		ctx,
		kindFilter,
		params.IsActive,
		limit,
		offset,
	)

	if err != nil {
		return nil, fmt.Errorf("list platform modules: %w", err)
	}

	return &ListModulesResult{
		Items:  items,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// GetModule retrieves one module by its UUID.
func (s *PlatformModuleService) GetModule(
	ctx context.Context,
	moduleID uuid.UUID,
) (*repository.ModuleCatalogItem, error) {
	module, err := s.repo.GetModuleByID(ctx, moduleID)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("module not found")
		}

		return nil, fmt.Errorf("get platform module: %w", err)
	}

	return module, nil
}
