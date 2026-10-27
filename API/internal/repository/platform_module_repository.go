package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// ModuleCatalogItem represents a module in the platform-wide catalogue.
// It does not represent a module assigned to a particular college.
type ModuleCatalogItem struct {
	ModuleID   uuid.UUID  `json:"module_id"`
	ModuleCode string     `json:"module_code"`
	ModuleName string     `json:"module_name"`
	ParentID   *uuid.UUID `json:"parent_id,omitempty"`
	Kind       string     `json:"kind"`
	Priority   string     `json:"priority"`
	IsCore     bool       `json:"is_core"`
	IsActive   bool       `json:"is_active"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// ListModules returns the platform module catalogue with optional filters
// and pagination. A nil filter means that no filtering is applied.
func (r *Repository) ListModules(
	ctx context.Context,
	kind *string,
	isActive *bool,
	limit int,
	offset int,
) ([]ModuleCatalogItem, int, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	var kindFilter interface{}
	if kind != nil {
		kindFilter = *kind
	}

	var activeFilter interface{}
	if isActive != nil {
		activeFilter = *isActive
	}

	db := r.Executor(ctx)

	var total int
	err := db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM platform.modules
		WHERE ($1::text IS NULL OR kind = $1)
		  AND ($2::boolean IS NULL OR is_active = $2)
	`, kindFilter, activeFilter).Scan(&total)

	if err != nil {
		return nil, 0, err
	}

	rows, err := db.Query(ctx, `
		SELECT
			module_id,
			module_code,
			module_name,
			parent_id,
			kind,
			priority,
			is_core,
			is_active,
			created_at,
			updated_at
		FROM platform.modules
		WHERE ($1::text IS NULL OR kind = $1)
		  AND ($2::boolean IS NULL OR is_active = $2)
		ORDER BY module_name ASC, module_code ASC
		LIMIT $3 OFFSET $4
	`, kindFilter, activeFilter, limit, offset)

	if err != nil {
		return nil, 0, err
	}

	defer rows.Close()

	modules := make([]ModuleCatalogItem, 0)
	for rows.Next() {
		var module ModuleCatalogItem
		err := rows.Scan(
			&module.ModuleID,
			&module.ModuleCode,
			&module.ModuleName,
			&module.ParentID,
			&module.Kind,
			&module.Priority,
			&module.IsCore,
			&module.IsActive,
			&module.CreatedAt,
			&module.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		modules = append(modules, module)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	return modules, total, nil
}

// GetModuleByID retrieves one module from the platform-wide catalogue.
func (r *Repository) GetModuleByID(
	ctx context.Context,
	moduleID uuid.UUID,
) (*ModuleCatalogItem, error) {
	var module ModuleCatalogItem

	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT
			module_id,
			module_code,
			module_name,
			parent_id,
			kind,
			priority,
			is_core,
			is_active,
			created_at,
			updated_at
		FROM platform.modules
		WHERE module_id = $1
	`, moduleID).Scan(
		&module.ModuleID,
		&module.ModuleCode,
		&module.ModuleName,
		&module.ParentID,
		&module.Kind,
		&module.Priority,
		&module.IsCore,
		&module.IsActive,
		&module.CreatedAt,
		&module.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &module, nil
}
