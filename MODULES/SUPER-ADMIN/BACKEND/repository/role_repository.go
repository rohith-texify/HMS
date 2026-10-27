package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

// ListRoles retrieves a paginated and filtered list of roles.
func (r *Repository) ListRoles(
	ctx context.Context,
	params models.ListRolesParams,
) ([]models.Role, int, error) {
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

	var countQuery strings.Builder
	countQuery.WriteString(`
		SELECT COUNT(DISTINCT r.role_id)
		FROM platform.roles r
		WHERE 1=1
	`)
	countArgs := []interface{}{}
	cIdx := 1

	if params.Scope != "" && params.Scope != "ALL" {
		countQuery.WriteString(fmt.Sprintf(" AND r.scope = $%d", cIdx))
		countArgs = append(countArgs, params.Scope)
		cIdx++
	}

	if params.IsSystemRole != nil {
		countQuery.WriteString(fmt.Sprintf(" AND r.is_system_role = $%d", cIdx))
		countArgs = append(countArgs, *params.IsSystemRole)
		cIdx++
	}

	if strings.TrimSpace(params.Search) != "" {
		searchPattern := "%" + strings.ToLower(strings.TrimSpace(params.Search)) + "%"
		countQuery.WriteString(fmt.Sprintf(" AND (LOWER(r.role_code) LIKE $%d OR LOWER(r.role_name) LIKE $%d)", cIdx, cIdx))
		countArgs = append(countArgs, searchPattern)
		cIdx++
	}

	var total int
	err := r.Executor(ctx).QueryRow(ctx, countQuery.String(), countArgs...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count roles: %w", err)
	}

	var query strings.Builder
	query.WriteString(`
		SELECT
			r.role_id,
			r.role_code,
			r.role_name,
			r.scope,
			r.is_system_role,
			r.created_at,
			r.updated_at,
			COUNT(DISTINCT rp.permission_id) AS permission_count,
			COUNT(DISTINCT ur.user_role_id) AS user_count
		FROM platform.roles r
		LEFT JOIN platform.role_permissions rp ON rp.role_id = r.role_id
		LEFT JOIN platform.user_roles ur ON ur.role_id = r.role_id
		WHERE 1=1
	`)
	qArgs := []interface{}{}
	qIdx := 1

	if params.Scope != "" && params.Scope != "ALL" {
		query.WriteString(fmt.Sprintf(" AND r.scope = $%d", qIdx))
		qArgs = append(qArgs, params.Scope)
		qIdx++
	}

	if params.IsSystemRole != nil {
		query.WriteString(fmt.Sprintf(" AND r.is_system_role = $%d", qIdx))
		qArgs = append(qArgs, *params.IsSystemRole)
		qIdx++
	}

	if strings.TrimSpace(params.Search) != "" {
		searchPattern := "%" + strings.ToLower(strings.TrimSpace(params.Search)) + "%"
		query.WriteString(fmt.Sprintf(" AND (LOWER(r.role_code) LIKE $%d OR LOWER(r.role_name) LIKE $%d)", qIdx, qIdx))
		qArgs = append(qArgs, searchPattern)
		qIdx++
	}

	query.WriteString(fmt.Sprintf(`
		GROUP BY r.role_id, r.role_code, r.role_name, r.scope, r.is_system_role, r.created_at, r.updated_at
		ORDER BY r.is_system_role DESC, r.role_code ASC
		LIMIT $%d OFFSET $%d
	`, qIdx, qIdx+1))
	qArgs = append(qArgs, limit, offset)

	rows, err := r.Executor(ctx).Query(ctx, query.String(), qArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list roles: %w", err)
	}
	defer rows.Close()

	var roleList []models.Role
	for rows.Next() {
		var role models.Role
		if err := rows.Scan(
			&role.RoleID,
			&role.RoleCode,
			&role.RoleName,
			&role.Scope,
			&role.IsSystemRole,
			&role.CreatedAt,
			&role.UpdatedAt,
			&role.PermissionCount,
			&role.UserCount,
		); err != nil {
			return nil, 0, fmt.Errorf("scan role: %w", err)
		}
		roleList = append(roleList, role)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate roles: %w", err)
	}

	return roleList, total, nil
}

// GetRoleByID retrieves a single role by its UUID with permission and user counts.
func (r *Repository) GetRoleByID(ctx context.Context, roleID uuid.UUID) (*models.Role, error) {
	if roleID == uuid.Nil {
		return nil, fmt.Errorf("role ID is required")
	}

	const query = `
		SELECT
			r.role_id,
			r.role_code,
			r.role_name,
			r.scope,
			r.is_system_role,
			r.created_at,
			r.updated_at,
			COUNT(DISTINCT rp.permission_id) AS permission_count,
			COUNT(DISTINCT ur.user_role_id) AS user_count
		FROM platform.roles r
		LEFT JOIN platform.role_permissions rp ON rp.role_id = r.role_id
		LEFT JOIN platform.user_roles ur ON ur.role_id = r.role_id
		WHERE r.role_id = $1
		GROUP BY r.role_id, r.role_code, r.role_name, r.scope, r.is_system_role, r.created_at, r.updated_at
	`
	var role models.Role
	err := r.Executor(ctx).QueryRow(ctx, query, roleID).Scan(
		&role.RoleID,
		&role.RoleCode,
		&role.RoleName,
		&role.Scope,
		&role.IsSystemRole,
		&role.CreatedAt,
		&role.UpdatedAt,
		&role.PermissionCount,
		&role.UserCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("get role by id: %w", err)
	}

	return &role, nil
}

// GetRoleByCode retrieves a single role by its unique code.
func (r *Repository) GetRoleByCode(ctx context.Context, roleCode string) (*models.Role, error) {
	const query = `
		SELECT
			r.role_id,
			r.role_code,
			r.role_name,
			r.scope,
			r.is_system_role,
			r.created_at,
			r.updated_at,
			COUNT(DISTINCT rp.permission_id) AS permission_count,
			COUNT(DISTINCT ur.user_role_id) AS user_count
		FROM platform.roles r
		LEFT JOIN platform.role_permissions rp ON rp.role_id = r.role_id
		LEFT JOIN platform.user_roles ur ON ur.role_id = r.role_id
		WHERE r.role_code = $1
		GROUP BY r.role_id, r.role_code, r.role_name, r.scope, r.is_system_role, r.created_at, r.updated_at
	`
	var role models.Role
	err := r.Executor(ctx).QueryRow(ctx, query, roleCode).Scan(
		&role.RoleID,
		&role.RoleCode,
		&role.RoleName,
		&role.Scope,
		&role.IsSystemRole,
		&role.CreatedAt,
		&role.UpdatedAt,
		&role.PermissionCount,
		&role.UserCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, pgx.ErrNoRows
		}
		return nil, fmt.Errorf("get role by code: %w", err)
	}

	return &role, nil
}

// GetRolePermissions retrieves mapped permissions for a specific role.
func (r *Repository) GetRolePermissions(ctx context.Context, roleID uuid.UUID) ([]models.Permission, error) {
	if roleID == uuid.Nil {
		return nil, fmt.Errorf("role ID is required")
	}

	const query = `
		SELECT
			p.permission_id,
			p.module_id,
			m.module_code,
			m.module_name,
			p.permission_code,
			p.scope_type,
			p.description
		FROM platform.role_permissions rp
		JOIN platform.permissions p ON p.permission_id = rp.permission_id
		JOIN platform.modules m ON m.module_id = p.module_id
		WHERE rp.role_id = $1
		ORDER BY m.module_code ASC, p.permission_code ASC
	`
	rows, err := r.Executor(ctx).Query(ctx, query, roleID)
	if err != nil {
		return nil, fmt.Errorf("get role permissions: %w", err)
	}
	defer rows.Close()

	var permissions []models.Permission
	for rows.Next() {
		var p models.Permission
		if err := rows.Scan(
			&p.PermissionID,
			&p.ModuleID,
			&p.ModuleCode,
			&p.ModuleName,
			&p.PermissionCode,
			&p.ScopeType,
			&p.Description,
		); err != nil {
			return nil, fmt.Errorf("scan role permission: %w", err)
		}
		permissions = append(permissions, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate role permissions: %w", err)
	}

	return permissions, nil
}

// ListAllPermissions retrieves the complete permission catalog grouped by module.
func (r *Repository) ListAllPermissions(ctx context.Context, scopeType string) ([]models.Permission, error) {
	var query strings.Builder
	query.WriteString(`
		SELECT
			p.permission_id,
			p.module_id,
			m.module_code,
			m.module_name,
			p.permission_code,
			p.scope_type,
			p.description
		FROM platform.permissions p
		JOIN platform.modules m ON m.module_id = p.module_id
		WHERE 1=1
	`)
	args := []interface{}{}
	if scopeType != "" && scopeType != "ALL" {
		query.WriteString(" AND p.scope_type = $1")
		args = append(args, scopeType)
	}
	query.WriteString(" ORDER BY m.module_code ASC, p.permission_code ASC")

	rows, err := r.Executor(ctx).Query(ctx, query.String(), args...)
	if err != nil {
		return nil, fmt.Errorf("list all permissions: %w", err)
	}
	defer rows.Close()

	var permissions []models.Permission
	for rows.Next() {
		var p models.Permission
		if err := rows.Scan(
			&p.PermissionID,
			&p.ModuleID,
			&p.ModuleCode,
			&p.ModuleName,
			&p.PermissionCode,
			&p.ScopeType,
			&p.Description,
		); err != nil {
			return nil, fmt.Errorf("scan permission: %w", err)
		}
		permissions = append(permissions, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate all permissions: %w", err)
	}

	return permissions, nil
}

// CreateCustomRole creates a custom role and attaches initial permissions in a transaction.
func (r *Repository) CreateCustomRole(
	ctx context.Context,
	req models.CreateRoleRequest,
	validatedPermissionIDs []uuid.UUID,
) (*models.Role, error) {
	roleID := uuid.New()

	const insertRole = `
		INSERT INTO platform.roles (
			role_id,
			role_code,
			role_name,
			scope,
			is_system_role,
			created_at,
			updated_at
		) VALUES (
			$1, $2, $3, $4, FALSE, NOW(), NOW()
		)
		RETURNING role_id, role_code, role_name, scope, is_system_role, created_at, updated_at
	`
	var role models.Role
	err := r.Executor(ctx).QueryRow(
		ctx,
		insertRole,
		roleID,
		strings.TrimSpace(req.RoleCode),
		strings.TrimSpace(req.RoleName),
		req.Scope,
	).Scan(
		&role.RoleID,
		&role.RoleCode,
		&role.RoleName,
		&role.Scope,
		&role.IsSystemRole,
		&role.CreatedAt,
		&role.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert custom role: %w", err)
	}

	// Insert mapped permissions
	for _, permID := range validatedPermissionIDs {
		_, err := r.Executor(ctx).Exec(ctx, `
			INSERT INTO platform.role_permissions (role_id, permission_id, created_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT DO NOTHING
		`, roleID, permID)
		if err != nil {
			return nil, fmt.Errorf("insert role permission %s: %w", permID, err)
		}
	}

	role.PermissionCount = len(validatedPermissionIDs)
	role.UserCount = 0
	return &role, nil
}

// CloneRole duplicates an existing role's metadata and mapped permissions into a new custom role.
func (r *Repository) CloneRole(
	ctx context.Context,
	sourceRoleID uuid.UUID,
	newRoleCode string,
	newRoleName string,
	includePermissions bool,
) (*models.Role, error) {
	sourceRole, err := r.GetRoleByID(ctx, sourceRoleID)
	if err != nil {
		return nil, fmt.Errorf("get source role: %w", err)
	}

	newRoleID := uuid.New()
	const insertRole = `
		INSERT INTO platform.roles (
			role_id,
			role_code,
			role_name,
			scope,
			is_system_role,
			created_at,
			updated_at
		) VALUES (
			$1, $2, $3, $4, FALSE, NOW(), NOW()
		)
		RETURNING role_id, role_code, role_name, scope, is_system_role, created_at, updated_at
	`
	var cloned models.Role
	err = r.Executor(ctx).QueryRow(
		ctx,
		insertRole,
		newRoleID,
		strings.TrimSpace(newRoleCode),
		strings.TrimSpace(newRoleName),
		sourceRole.Scope,
	).Scan(
		&cloned.RoleID,
		&cloned.RoleCode,
		&cloned.RoleName,
		&cloned.Scope,
		&cloned.IsSystemRole,
		&cloned.CreatedAt,
		&cloned.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert cloned role: %w", err)
	}

	permCount := 0
	if includePermissions {
		res, err := r.Executor(ctx).Exec(ctx, `
			INSERT INTO platform.role_permissions (role_id, permission_id, created_at)
			SELECT $1, permission_id, NOW()
			FROM platform.role_permissions
			WHERE role_id = $2
			ON CONFLICT DO NOTHING
		`, newRoleID, sourceRoleID)
		if err != nil {
			return nil, fmt.Errorf("copy role permissions: %w", err)
		}
		permCount = int(res.RowsAffected())
	}

	cloned.PermissionCount = permCount
	cloned.UserCount = 0
	return &cloned, nil
}

// UpdateCustomRole updates permitted fields of a custom role.
func (r *Repository) UpdateCustomRole(
	ctx context.Context,
	roleID uuid.UUID,
	roleName string,
) (*models.Role, error) {
	const query = `
		UPDATE platform.roles
		SET role_name = $1,
		    updated_at = NOW()
		WHERE role_id = $2 AND is_system_role = FALSE
	`
	tag, err := r.Executor(ctx).Exec(ctx, query, strings.TrimSpace(roleName), roleID)
	if err != nil {
		return nil, fmt.Errorf("update custom role: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return nil, fmt.Errorf("role not found or is a protected system role")
	}

	return r.GetRoleByID(ctx, roleID)
}

// UpdateRolePermissions replaces permission mappings for a custom role.
func (r *Repository) UpdateRolePermissions(
	ctx context.Context,
	roleID uuid.UUID,
	permissionIDs []uuid.UUID,
) error {
	// Delete existing mappings
	_, err := r.Executor(ctx).Exec(ctx, `
		DELETE FROM platform.role_permissions
		WHERE role_id = $1
	`, roleID)
	if err != nil {
		return fmt.Errorf("delete old role permissions: %w", err)
	}

	// Insert new mappings
	for _, pid := range permissionIDs {
		_, err := r.Executor(ctx).Exec(ctx, `
			INSERT INTO platform.role_permissions (role_id, permission_id, created_at)
			VALUES ($1, $2, NOW())
			ON CONFLICT DO NOTHING
		`, roleID, pid)
		if err != nil {
			return fmt.Errorf("insert new role permission %s: %w", pid, err)
		}
	}

	// Update role updated_at
	_, _ = r.Executor(ctx).Exec(ctx, `
		UPDATE platform.roles SET updated_at = NOW() WHERE role_id = $1
	`, roleID)

	return nil
}

// CountRoleUsers returns the number of user assignments referencing this role.
func (r *Repository) CountRoleUsers(ctx context.Context, roleID uuid.UUID) (int, error) {
	const query = `
		SELECT COUNT(DISTINCT user_id)
		FROM platform.user_roles
		WHERE role_id = $1
	`
	var count int
	err := r.Executor(ctx).QueryRow(ctx, query, roleID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count role users: %w", err)
	}
	return count, nil
}

// DeleteCustomRole deletes an unused custom role and its permission mappings.
func (r *Repository) DeleteCustomRole(ctx context.Context, roleID uuid.UUID) error {
	// First delete permission mappings
	_, err := r.Executor(ctx).Exec(ctx, `
		DELETE FROM platform.role_permissions
		WHERE role_id = $1
	`, roleID)
	if err != nil {
		return fmt.Errorf("delete role permissions: %w", err)
	}

	// Delete the custom role
	tag, err := r.Executor(ctx).Exec(ctx, `
		DELETE FROM platform.roles
		WHERE role_id = $1 AND is_system_role = FALSE
	`, roleID)
	if err != nil {
		return fmt.Errorf("delete role record: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("role not found or is a protected system role")
	}

	return nil
}

// RecordRoleAudit writes an immutable audit record into platform.audit_logs.
func (r *Repository) RecordRoleAudit(
	ctx context.Context,
	params models.RoleAuditParams,
) error {
	newData, err := json.Marshal(params.Details)
	if err != nil {
		newData = []byte("{}")
	}

	var actorUserArg interface{}
	if params.ActorUserID != uuid.Nil {
		actorUserArg = params.ActorUserID
	}

	var actorRoleArg interface{}
	if strings.TrimSpace(params.ActorRole) != "" {
		actorRoleArg = strings.TrimSpace(params.ActorRole)
	}

	const query = `
		INSERT INTO platform.audit_logs (
			audit_id,
			college_id,
			actor_user_id,
			actor_role,
			module,
			action,
			entity_type,
			entity_id,
			new_data,
			reason,
			severity,
			created_at
		) VALUES (
			gen_random_uuid(),
			NULL,
			$1,
			$2,
			'super_admin_roles',
			$3,
			'platform.roles',
			$4,
			$5,
			$6,
			'INFO',
			NOW()
		)
	`
	_, err = r.Executor(ctx).Exec(
		ctx,
		query,
		actorUserArg,
		actorRoleArg,
		params.Action,
		params.RoleID,
		newData,
		params.Reason,
	)
	if err != nil {
		return fmt.Errorf("record role audit: %w", err)
	}
	return nil
}
