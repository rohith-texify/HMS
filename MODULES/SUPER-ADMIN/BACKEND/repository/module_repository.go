package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// ListModules retrieves a list of platform modules with optional filtering and pagination.
func (r *Repository) ListModules(
	ctx context.Context,
	kind *string,
	isActive *bool,
	limit, offset int,
) ([]models.Module, int, error) {
	// Build the WHERE clause based on optional filters
	whereClause := ""
	args := []interface{}{}
	argPos := 1

	conditions := []string{}

	if kind != nil && *kind != "" {
		conditions = append(conditions, fmt.Sprintf("kind = $%d", argPos))
		args = append(args, *kind)
		argPos++
	}

	if isActive != nil {
		conditions = append(conditions, fmt.Sprintf("is_active = $%d", argPos))
		args = append(args, *isActive)
		argPos++
	}

	if len(conditions) > 0 {
		whereClause = "WHERE " + conditions[0]
		for i := 1; i < len(conditions); i++ {
			whereClause += " AND " + conditions[i]
		}
	}

	// Count total records
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM platform.modules
		%s
	`, whereClause)

	var total int
	err := r.Executor(ctx).QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count modules: %w", err)
	}

	// Query for paginated results
	query := fmt.Sprintf(`
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
		%s
		ORDER BY module_name ASC, module_code ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPos, argPos+1)

	args = append(args, limit, offset)

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list modules: %w", err)
	}
	defer rows.Close()

	modules := make([]models.Module, 0)
	for rows.Next() {
		var module models.Module
		if err := rows.Scan(
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
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan module: %w", err)
		}
		modules = append(modules, module)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed while reading modules: %w", err)
	}

	return modules, total, nil
}

// GetModuleByID retrieves a single module by its ID.
func (r *Repository) GetModuleByID(
	ctx context.Context,
	moduleID uuid.UUID,
) (*models.Module, error) {
	query := `
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
	`

	var module models.Module
	err := r.Executor(ctx).QueryRow(ctx, query, moduleID).Scan(
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

// GetModuleByCode retrieves a single module by its unique code.
func (r *Repository) GetModuleByCode(
	ctx context.Context,
	moduleCode string,
) (*models.Module, error) {
	query := `
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
		WHERE module_code = $1
	`

	var module models.Module
	err := r.Executor(ctx).QueryRow(ctx, query, moduleCode).Scan(
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

// CreateModule creates a new module record in platform.modules.
func (r *Repository) CreateModule(
	ctx context.Context,
	req models.CreateModuleRequest,
) (*models.Module, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	priority := "M"
	if req.Priority != "" {
		priority = req.Priority
	}

	query := `
		INSERT INTO platform.modules (
			module_code,
			module_name,
			parent_id,
			kind,
			priority,
			is_core,
			is_active,
			created_at,
			updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
		RETURNING
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
	`

	var m models.Module
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		req.ModuleCode,
		req.ModuleName,
		req.ParentID,
		req.Kind,
		priority,
		req.IsCore,
		isActive,
	).Scan(
		&m.ModuleID,
		&m.ModuleCode,
		&m.ModuleName,
		&m.ParentID,
		&m.Kind,
		&m.Priority,
		&m.IsCore,
		&m.IsActive,
		&m.CreatedAt,
		&m.UpdatedAt,
	)
	if err != nil {
		var pgErr interface{ SQLState() string }
		if errors.As(err, &pgErr) && pgErr.SQLState() == "23505" {
			return nil, fmt.Errorf("module with code '%s' already exists", req.ModuleCode)
		}
		return nil, fmt.Errorf("failed to create module: %w", err)
	}

	return &m, nil
}

// UpdateModule updates an existing module record in platform.modules.
func (r *Repository) UpdateModule(
	ctx context.Context,
	moduleID uuid.UUID,
	req models.UpdateModuleRequest,
) (*models.Module, error) {
	query := `
		UPDATE platform.modules
		SET
			module_name = COALESCE($1, module_name),
			parent_id = CASE WHEN $2::boolean THEN $3::uuid ELSE parent_id END,
			kind = COALESCE($4, kind),
			priority = COALESCE($5, priority),
			is_core = COALESCE($6, is_core),
			is_active = COALESCE($7, is_active),
			updated_at = NOW()
		WHERE module_id = $8
		RETURNING
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
	`

	hasParentID := req.ParentID != nil
	var parentIDVal interface{}
	if hasParentID {
		parentIDVal = *req.ParentID
	}

	var m models.Module
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		req.ModuleName,
		hasParentID,
		parentIDVal,
		req.Kind,
		req.Priority,
		req.IsCore,
		req.IsActive,
		moduleID,
	).Scan(
		&m.ModuleID,
		&m.ModuleCode,
		&m.ModuleName,
		&m.ParentID,
		&m.Kind,
		&m.Priority,
		&m.IsCore,
		&m.IsActive,
		&m.CreatedAt,
		&m.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update module: %w", err)
	}

	return &m, nil
}

// ToggleModuleStatus activates or deactivates a module.
func (r *Repository) ToggleModuleStatus(
	ctx context.Context,
	moduleID uuid.UUID,
	isActive bool,
) (*models.Module, error) {
	query := `
		UPDATE platform.modules
		SET
			is_active = $1,
			updated_at = NOW()
		WHERE module_id = $2
		RETURNING
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
	`

	var m models.Module
	err := r.Executor(ctx).QueryRow(ctx, query, isActive, moduleID).Scan(
		&m.ModuleID,
		&m.ModuleCode,
		&m.ModuleName,
		&m.ParentID,
		&m.Kind,
		&m.Priority,
		&m.IsCore,
		&m.IsActive,
		&m.CreatedAt,
		&m.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to toggle module status: %w", err)
	}

	return &m, nil
}

// DeleteModule removes a module record if no references exist.
func (r *Repository) DeleteModule(
	ctx context.Context,
	moduleID uuid.UUID,
) error {
	// Check if any child modules reference this module
	var childCount int
	err := r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*) FROM platform.modules WHERE parent_id = $1
	`, moduleID).Scan(&childCount)
	if err != nil {
		return fmt.Errorf("failed to check child modules: %w", err)
	}
	if childCount > 0 {
		return fmt.Errorf("cannot delete module with %d child module(s)", childCount)
	}

	// Check if any college module assignments reference this module
	var assignmentCount int
	err = r.Executor(ctx).QueryRow(ctx, `
		SELECT COUNT(*) FROM platform.college_modules WHERE module_id = $1
	`, moduleID).Scan(&assignmentCount)
	if err != nil {
		return fmt.Errorf("failed to check college module assignments: %w", err)
	}
	if assignmentCount > 0 {
		return fmt.Errorf("cannot delete module with %d college module assignment(s)", assignmentCount)
	}

	tag, err := r.Executor(ctx).Exec(ctx, `
		DELETE FROM platform.modules WHERE module_id = $1
	`, moduleID)
	if err != nil {
		return fmt.Errorf("failed to delete module: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	return nil
}

// ListCollegeModules retrieves college-specific module enablement with module details.
func (r *Repository) ListCollegeModules(
	ctx context.Context,
	collegeID uuid.UUID,
	status *string,
	limit, offset int,
) ([]models.CollegeModuleWithDetails, int, error) {
	// Build the WHERE clause
	whereClause := "WHERE cm.college_id = $1"
	args := []interface{}{collegeID}
	argPos := 2

	if status != nil && *status != "" {
		whereClause += fmt.Sprintf(" AND cm.status = $%d", argPos)
		args = append(args, *status)
		argPos++
	}

	// Count total records
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM platform.college_modules cm
		%s
	`, whereClause)

	var total int
	err := r.Executor(ctx).QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count college modules: %w", err)
	}

	// Query for paginated results with module details
	query := fmt.Sprintf(`
		SELECT
			cm.college_module_id,
			cm.college_id,
			cm.module_id,
			m.module_code,
			m.module_name,
			m.kind,
			m.parent_id,
			m.priority,
			m.is_core,
			cm.status,
			cm.mode,
			cm.effective_from,
			cm.effective_to,
			COALESCE(cm.change_reason, cm.reason) as reason,
			cm.changed_by,
			cm.created_at,
			cm.updated_at
		FROM platform.college_modules cm
		JOIN platform.modules m ON cm.module_id = m.module_id
		%s
		ORDER BY m.module_name ASC, m.module_code ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, argPos, argPos+1)

	args = append(args, limit, offset)

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list college modules: %w", err)
	}
	defer rows.Close()

	collegeModules := make([]models.CollegeModuleWithDetails, 0)
	for rows.Next() {
		var cm models.CollegeModuleWithDetails
		if err := rows.Scan(
			&cm.CollegeModuleID,
			&cm.CollegeID,
			&cm.ModuleID,
			&cm.ModuleCode,
			&cm.ModuleName,
			&cm.Kind,
			&cm.ParentID,
			&cm.Priority,
			&cm.IsCore,
			&cm.Status,
			&cm.Mode,
			&cm.EffectiveFrom,
			&cm.EffectiveTo,
			&cm.Reason,
			&cm.ChangedBy,
			&cm.CreatedAt,
			&cm.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan college module: %w", err)
		}
		collegeModules = append(collegeModules, cm)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed while reading college modules: %w", err)
	}

	return collegeModules, total, nil
}

// GetCollegeModuleByID retrieves a specific college module assignment by college_module_id.
func (r *Repository) GetCollegeModuleByID(
	ctx context.Context,
	collegeModuleID uuid.UUID,
) (*models.CollegeModule, error) {
	query := `
		SELECT
			college_module_id,
			college_id,
			module_id,
			status,
			mode,
			effective_from,
			effective_to,
			COALESCE(change_reason, reason) as reason,
			changed_by,
			created_at,
			updated_at
		FROM platform.college_modules
		WHERE college_module_id = $1
	`

	var cm models.CollegeModule
	err := r.Executor(ctx).QueryRow(ctx, query, collegeModuleID).Scan(
		&cm.CollegeModuleID,
		&cm.CollegeID,
		&cm.ModuleID,
		&cm.Status,
		&cm.Mode,
		&cm.EffectiveFrom,
		&cm.EffectiveTo,
		&cm.Reason,
		&cm.ChangedBy,
		&cm.CreatedAt,
		&cm.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &cm, nil
}

// GetCollegeModuleByCollegeAndModuleID retrieves college module details by collegeID and moduleID.
func (r *Repository) GetCollegeModuleByCollegeAndModuleID(
	ctx context.Context,
	collegeID, moduleID uuid.UUID,
) (*models.CollegeModuleWithDetails, error) {
	query := `
		SELECT
			cm.college_module_id,
			cm.college_id,
			cm.module_id,
			m.module_code,
			m.module_name,
			m.kind,
			m.parent_id,
			m.priority,
			m.is_core,
			cm.status,
			cm.mode,
			cm.effective_from,
			cm.effective_to,
			COALESCE(cm.change_reason, cm.reason) as reason,
			cm.changed_by,
			cm.created_at,
			cm.updated_at
		FROM platform.college_modules cm
		JOIN platform.modules m ON cm.module_id = m.module_id
		WHERE cm.college_id = $1 AND cm.module_id = $2
	`

	var cm models.CollegeModuleWithDetails
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, moduleID).Scan(
		&cm.CollegeModuleID,
		&cm.CollegeID,
		&cm.ModuleID,
		&cm.ModuleCode,
		&cm.ModuleName,
		&cm.Kind,
		&cm.ParentID,
		&cm.Priority,
		&cm.IsCore,
		&cm.Status,
		&cm.Mode,
		&cm.EffectiveFrom,
		&cm.EffectiveTo,
		&cm.Reason,
		&cm.ChangedBy,
		&cm.CreatedAt,
		&cm.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &cm, nil
}

// AssignCollegeModule creates a new college module assignment.
func (r *Repository) AssignCollegeModule(
	ctx context.Context,
	collegeID uuid.UUID,
	req models.AssignCollegeModuleRequest,
	changedBy uuid.UUID,
) (*models.CollegeModuleWithDetails, error) {
	reasonText := req.Reason
	if reasonText == nil || strings.TrimSpace(*reasonText) == "" {
		reasonText = req.ChangeReason
	}

	query := `
		INSERT INTO platform.college_modules (
			college_id,
			module_id,
			status,
			mode,
			effective_from,
			effective_to,
			reason,
			change_reason,
			changed_by,
			created_at,
			updated_at
		)
		VALUES (
			$1,
			$2,
			$3,
			$4,
			COALESCE($5, NOW()),
			$6,
			$7,
			$7,
			$8,
			NOW(),
			NOW()
		)
		RETURNING college_module_id
	`

	var collegeModuleID uuid.UUID
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		collegeID,
		req.ModuleID,
		req.Status,
		req.Mode,
		req.EffectiveFrom,
		req.EffectiveTo,
		reasonText,
		changedBy,
	).Scan(&collegeModuleID)
	if err != nil {
		var pgErr interface{ SQLState() string }
		if errors.As(err, &pgErr) && pgErr.SQLState() == "23505" {
			return nil, fmt.Errorf("module is already assigned to this college")
		}
		return nil, fmt.Errorf("failed to assign college module: %w", err)
	}

	return r.GetCollegeModuleByCollegeAndModuleID(ctx, collegeID, req.ModuleID)
}

// UpdateCollegeModule updates a college module assignment by college_module_id.
func (r *Repository) UpdateCollegeModule(
	ctx context.Context,
	collegeModuleID uuid.UUID,
	req models.UpdateCollegeModuleRequest,
	changedBy uuid.UUID,
) (*models.CollegeModule, error) {
	now := time.Now()
	reasonText := req.Reason
	if reasonText == nil || strings.TrimSpace(*reasonText) == "" {
		reasonText = req.ChangeReason
	}

	query := `
		UPDATE platform.college_modules
		SET
			status = $1,
			mode = $2,
			effective_from = COALESCE($3, effective_from),
			effective_to = $4,
			reason = $5,
			change_reason = $5,
			changed_by = $6,
			updated_at = $7
		WHERE college_module_id = $8
		RETURNING
			college_module_id,
			college_id,
			module_id,
			status,
			mode,
			effective_from,
			effective_to,
			COALESCE(change_reason, reason) as reason,
			changed_by,
			created_at,
			updated_at
	`

	var cm models.CollegeModule
	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		req.Status,
		req.Mode,
		req.EffectiveFrom,
		req.EffectiveTo,
		reasonText,
		changedBy,
		now,
		collegeModuleID,
	).Scan(
		&cm.CollegeModuleID,
		&cm.CollegeID,
		&cm.ModuleID,
		&cm.Status,
		&cm.Mode,
		&cm.EffectiveFrom,
		&cm.EffectiveTo,
		&cm.Reason,
		&cm.ChangedBy,
		&cm.CreatedAt,
		&cm.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update college module: %w", err)
	}

	return &cm, nil
}

// UpdateCollegeModuleByCollegeAndModule updates a college module assignment by college_id and module_id.
func (r *Repository) UpdateCollegeModuleByCollegeAndModule(
	ctx context.Context,
	collegeID, moduleID uuid.UUID,
	req models.UpdateCollegeModuleRequest,
	changedBy uuid.UUID,
) (*models.CollegeModuleWithDetails, error) {
	now := time.Now()
	reasonText := req.Reason
	if reasonText == nil || strings.TrimSpace(*reasonText) == "" {
		reasonText = req.ChangeReason
	}

	query := `
		UPDATE platform.college_modules
		SET
			status = $1,
			mode = $2,
			effective_from = COALESCE($3, effective_from),
			effective_to = $4,
			reason = $5,
			change_reason = $5,
			changed_by = $6,
			updated_at = $7
		WHERE college_id = $8 AND module_id = $9
	`

	tag, err := r.Executor(ctx).Exec(
		ctx,
		query,
		req.Status,
		req.Mode,
		req.EffectiveFrom,
		req.EffectiveTo,
		reasonText,
		changedBy,
		now,
		collegeID,
		moduleID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update college module: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, pgx.ErrNoRows
	}

	return r.GetCollegeModuleByCollegeAndModuleID(ctx, collegeID, moduleID)
}

// CascadeDeactivateChildCollegeModules deactivates active child/descendant college module assignments when a parent module is deactivated.
func (r *Repository) CascadeDeactivateChildCollegeModules(
	ctx context.Context,
	collegeID, parentModuleID, changedBy uuid.UUID,
	reason string,
) ([]models.CollegeModule, error) {
	now := time.Now()
	query := `
		WITH RECURSIVE module_tree AS (
			SELECT module_id FROM platform.modules WHERE parent_id = $1
			UNION ALL
			SELECT m.module_id FROM platform.modules m
			JOIN module_tree mt ON m.parent_id = mt.module_id
		)
		UPDATE platform.college_modules
		SET
			status = 'DISABLED',
			updated_at = $2,
			changed_by = $3,
			reason = $4,
			change_reason = $4
		WHERE college_id = $5
		  AND module_id IN (SELECT module_id FROM module_tree)
		  AND status = 'ACTIVE'
		RETURNING
			college_module_id,
			college_id,
			module_id,
			status,
			mode,
			effective_from,
			effective_to,
			reason,
			changed_by,
			created_at,
			updated_at
	`

	rows, err := r.Executor(ctx).Query(
		ctx,
		query,
		parentModuleID,
		now,
		changedBy,
		reason,
		collegeID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to cascade deactivate child college modules: %w", err)
	}
	defer rows.Close()

	var deactivated []models.CollegeModule
	for rows.Next() {
		var cm models.CollegeModule
		if err := rows.Scan(
			&cm.CollegeModuleID,
			&cm.CollegeID,
			&cm.ModuleID,
			&cm.Status,
			&cm.Mode,
			&cm.EffectiveFrom,
			&cm.EffectiveTo,
			&cm.Reason,
			&cm.ChangedBy,
			&cm.CreatedAt,
			&cm.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan deactivated college module: %w", err)
		}
		deactivated = append(deactivated, cm)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error reading deactivated college modules: %w", err)
	}

	return deactivated, nil
}

// RecordModuleAudit writes an immutable audit record to platform.audit_logs.
func (r *Repository) RecordModuleAudit(
	ctx context.Context,
	params models.ModuleAuditParams,
) error {
	if params.ActorUserID == uuid.Nil {
		return fmt.Errorf("actor user ID is required for audit")
	}

	oldDataJSON := []byte("{}")
	if params.OldData != nil {
		if b, err := json.Marshal(params.OldData); err == nil {
			oldDataJSON = b
		}
	}

	newDataJSON := []byte("{}")
	if params.NewData != nil {
		if b, err := json.Marshal(params.NewData); err == nil {
			newDataJSON = b
		}
	}

	module := params.Module
	if module == "" {
		module = "platform_modules"
	}

	severity := params.Severity
	if severity == "" {
		severity = "INFO"
	}

	_, err := r.Executor(ctx).Exec(ctx, `
		INSERT INTO platform.audit_logs (
			audit_id,
			college_id,
			actor_user_id,
			actor_role,
			module,
			action,
			entity_type,
			entity_id,
			old_data,
			new_data,
			reason,
			created_at,
			severity
		)
		VALUES (
			$1, $2, $3, $4,
			$5, $6, $7, $8,
			$9::jsonb, $10::jsonb,
			$11, NOW(), $12
		)
	`,
		uuid.New(),
		params.CollegeID,
		params.ActorUserID,
		params.ActorRole,
		module,
		params.Action,
		params.EntityType,
		params.EntityID,
		string(oldDataJSON),
		string(newDataJSON),
		params.Reason,
		severity,
	)
	if err != nil {
		return fmt.Errorf("record module audit: %w", err)
	}

	return nil
}

// ListModuleHistory retrieves immutable audit log entries related to module and entitlement management.
func (r *Repository) ListModuleHistory(
	ctx context.Context,
	collegeID *uuid.UUID,
	moduleID *uuid.UUID,
	limit, offset int,
) ([]models.ModuleHistoryItem, int, error) {
	whereClauses := []string{
		"(module IN ('platform_modules', 'platform_college_modules') OR entity_type IN ('MODULE', 'COLLEGE_MODULE'))",
	}
	args := []interface{}{}
	argPos := 1

	if collegeID != nil && *collegeID != uuid.Nil {
		whereClauses = append(whereClauses, fmt.Sprintf("college_id = $%d", argPos))
		args = append(args, *collegeID)
		argPos++
	}

	if moduleID != nil && *moduleID != uuid.Nil {
		whereClauses = append(whereClauses, fmt.Sprintf("(entity_id = $%d OR new_data->>'module_id' = $%d OR old_data->>'module_id' = $%d)", argPos, argPos, argPos))
		args = append(args, *moduleID)
		argPos++
	}

	whereSQL := "WHERE " + strings.Join(whereClauses, " AND ")

	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM platform.audit_logs %s`, whereSQL)
	var total int
	err := r.Executor(ctx).QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count module history: %w", err)
	}

	query := fmt.Sprintf(`
		SELECT
			audit_id,
			college_id,
			actor_user_id,
			COALESCE(actor_role, 'SUPER_ADMIN') as actor_role,
			action,
			entity_type,
			entity_id,
			old_data,
			new_data,
			reason,
			COALESCE(severity, 'INFO') as severity,
			created_at
		FROM platform.audit_logs
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argPos, argPos+1)

	args = append(args, limit, offset)

	rows, err := r.Executor(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list module history: %w", err)
	}
	defer rows.Close()

	items := make([]models.ModuleHistoryItem, 0)
	for rows.Next() {
		var item models.ModuleHistoryItem
		var oldDataRaw, newDataRaw []byte
		if err := rows.Scan(
			&item.AuditID,
			&item.CollegeID,
			&item.ActorUserID,
			&item.ActorRole,
			&item.Action,
			&item.EntityType,
			&item.EntityID,
			&oldDataRaw,
			&newDataRaw,
			&item.Reason,
			&item.Severity,
			&item.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan module history item: %w", err)
		}

		if len(oldDataRaw) > 0 {
			var parsed interface{}
			if err := json.Unmarshal(oldDataRaw, &parsed); err == nil {
				item.OldData = parsed
			}
		}
		if len(newDataRaw) > 0 {
			var parsed interface{}
			if err := json.Unmarshal(newDataRaw, &parsed); err == nil {
				item.NewData = parsed
			}
		}

		items = append(items, item)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed reading module history rows: %w", err)
	}

	return items, total, nil
}

// GetPendingWorkflowCounts calculates active/pending workflow records affected for a module under a college.
func (r *Repository) GetPendingWorkflowCounts(
	ctx context.Context,
	collegeID uuid.UUID,
	moduleCode string,
) (int, []string, error) {
	totalPending := 0
	summaries := make([]string, 0)

	normCode := strings.ToUpper(strings.TrimSpace(moduleCode))

	switch normCode {
	case "REQUESTS":
		// Pending leave requests
		var leaveCount int
		err := r.Executor(ctx).QueryRow(ctx, `
			SELECT COUNT(*) FROM app.leave_requests
			WHERE college_id = $1 AND status IN ('PENDING', 'SUBMITTED', 'IN_REVIEW', 'UNDER_REVIEW')
		`, collegeID).Scan(&leaveCount)
		if err == nil && leaveCount > 0 {
			totalPending += leaveCount
			summaries = append(summaries, fmt.Sprintf("%d pending leave request(s)", leaveCount))
		}

	case "SUPPORT":
		// Open/In progress complaints
		var complaintCount int
		err := r.Executor(ctx).QueryRow(ctx, `
			SELECT COUNT(*) FROM app.complaints
			WHERE college_id = $1 AND status IN ('OPEN', 'IN_PROGRESS', 'PENDING', 'ESCALATED')
		`, collegeID).Scan(&complaintCount)
		if err == nil && complaintCount > 0 {
			totalPending += complaintCount
			summaries = append(summaries, fmt.Sprintf("%d unresolved complaint(s)", complaintCount))
		}

	case "HOSTEL":
		// Allocated beds currently occupied
		var allocCount int
		err := r.Executor(ctx).QueryRow(ctx, `
			SELECT COUNT(*) FROM app.bed_allocations
			WHERE college_id = $1 AND status = 'ACTIVE'
		`, collegeID).Scan(&allocCount)
		if err == nil && allocCount > 0 {
			totalPending += allocCount
			summaries = append(summaries, fmt.Sprintf("%d active student bed allocation(s)", allocCount))
		}

	case "MOVEMENT":
		// Pending attendance corrections
		var corrCount int
		err := r.Executor(ctx).QueryRow(ctx, `
			SELECT COUNT(*) FROM app.attendance_corrections
			WHERE college_id = $1 AND status IN ('PENDING', 'SUBMITTED')
		`, collegeID).Scan(&corrCount)
		if err == nil && corrCount > 0 {
			totalPending += corrCount
			summaries = append(summaries, fmt.Sprintf("%d pending attendance correction(s)", corrCount))
		}
	}

	return totalPending, summaries, nil
}

// GetPendingModuleApproval checks if there is any pending maker-checker approval for this college and module.
func (r *Repository) GetPendingModuleApproval(
	ctx context.Context,
	collegeID, moduleID uuid.UUID,
) (*models.ApprovalRequest, error) {
	query := `
		SELECT
			request_id,
			operation_type,
			college_id,
			payload,
			requested_by,
			status,
			reason,
			snapshot,
			expires_at,
			executed_at,
			created_at,
			updated_at
		FROM platform.approval_requests
		WHERE college_id = $1
		  AND operation_type = 'COLLEGE_MODULE_UPDATE'
		  AND status = 'PENDING'
		  AND (payload->>'module_id' = $2 OR payload->>'college_module_id' IN (
				SELECT college_module_id::text FROM platform.college_modules WHERE college_id = $1 AND module_id = $2
		  ))
		ORDER BY created_at DESC
		LIMIT 1
	`

	var req models.ApprovalRequest
	err := r.Executor(ctx).QueryRow(ctx, query, collegeID, moduleID.String()).Scan(
		&req.RequestID,
		&req.OperationType,
		&req.CollegeID,
		&req.Payload,
		&req.RequestedBy,
		&req.Status,
		&req.Reason,
		&req.Snapshot,
		&req.ExpiresAt,
		&req.ExecutedAt,
		&req.CreatedAt,
		&req.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return &req, nil
}
