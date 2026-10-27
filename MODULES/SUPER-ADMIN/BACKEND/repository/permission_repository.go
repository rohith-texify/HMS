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

// ListPermissionsWithStats retrieves permissions with module data, mapped role count, and orphan status.
func (r *Repository) ListPermissionsWithStats(
	ctx context.Context,
	filter models.ListPermissionsFilter,
) ([]models.PermissionDetail, int, error) {
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

	whereConditions := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if strings.TrimSpace(filter.ScopeType) != "" && strings.ToUpper(strings.TrimSpace(filter.ScopeType)) != "ALL" {
		whereConditions = append(whereConditions, fmt.Sprintf("p.scope_type = $%d", argIdx))
		args = append(args, strings.ToUpper(strings.TrimSpace(filter.ScopeType)))
		argIdx++
	}

	if strings.TrimSpace(filter.ModuleCode) != "" && strings.ToUpper(strings.TrimSpace(filter.ModuleCode)) != "ALL" {
		whereConditions = append(whereConditions, fmt.Sprintf("UPPER(m.module_code) = $%d", argIdx))
		args = append(args, strings.ToUpper(strings.TrimSpace(filter.ModuleCode)))
		argIdx++
	}

	if strings.TrimSpace(filter.Search) != "" {
		searchPattern := "%" + strings.ToLower(strings.TrimSpace(filter.Search)) + "%"
		whereConditions = append(whereConditions, fmt.Sprintf(
			"(LOWER(p.permission_code) LIKE $%d OR LOWER(COALESCE(p.description, '')) LIKE $%d OR LOWER(m.module_code) LIKE $%d OR LOWER(m.module_name) LIKE $%d)",
			argIdx, argIdx, argIdx, argIdx,
		))
		args = append(args, searchPattern)
		argIdx++
	}

	whereClause := strings.Join(whereConditions, " AND ")

	havingClause := ""
	if filter.IsOrphan != nil {
		if *filter.IsOrphan {
			havingClause = "HAVING COUNT(DISTINCT rp.role_id) = 0"
		} else {
			havingClause = "HAVING COUNT(DISTINCT rp.role_id) > 0"
		}
	}

	// Count query
	countSQL := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM (
			SELECT p.permission_id
			FROM platform.permissions p
			JOIN platform.modules m ON m.module_id = p.module_id
			LEFT JOIN platform.role_permissions rp ON rp.permission_id = p.permission_id
			WHERE %s
			GROUP BY p.permission_id
			%s
		) sub
	`, whereClause, havingClause)

	var total int
	err := r.Executor(ctx).QueryRow(ctx, countSQL, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("count permissions with stats: %w", err)
	}

	// Data query
	dataSQL := fmt.Sprintf(`
		SELECT
			p.permission_id,
			p.module_id,
			m.module_code,
			m.module_name,
			p.permission_code,
			p.scope_type,
			p.description,
			p.created_at,
			p.updated_at,
			COUNT(DISTINCT rp.role_id) AS mapped_roles_count
		FROM platform.permissions p
		JOIN platform.modules m ON m.module_id = p.module_id
		LEFT JOIN platform.role_permissions rp ON rp.permission_id = p.permission_id
		WHERE %s
		GROUP BY p.permission_id, p.module_id, m.module_code, m.module_name, p.permission_code, p.scope_type, p.description, p.created_at, p.updated_at
		%s
		ORDER BY m.module_code ASC, p.permission_code ASC
		LIMIT $%d OFFSET $%d
	`, whereClause, havingClause, argIdx, argIdx+1)

	queryArgs := append(args, limit, offset)

	rows, err := r.Executor(ctx).Query(ctx, dataSQL, queryArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("query permissions with stats: %w", err)
	}
	defer rows.Close()

	var permissions []models.PermissionDetail
	for rows.Next() {
		var pd models.PermissionDetail
		if err := rows.Scan(
			&pd.PermissionID,
			&pd.ModuleID,
			&pd.ModuleCode,
			&pd.ModuleName,
			&pd.PermissionCode,
			&pd.ScopeType,
			&pd.Description,
			&pd.CreatedAt,
			&pd.UpdatedAt,
			&pd.MappedRolesCount,
		); err != nil {
			return nil, 0, fmt.Errorf("scan permission with stats: %w", err)
		}
		pd.IsOrphan = (pd.MappedRolesCount == 0)
		permissions = append(permissions, pd)
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate permissions with stats: %w", err)
	}

	return permissions, total, nil
}

// GetPermissionDetailByID retrieves a single permission and its list of mapped roles.
func (r *Repository) GetPermissionDetailByID(ctx context.Context, permissionID uuid.UUID) (*models.PermissionDetail, error) {
	const queryPerm = `
		SELECT
			p.permission_id,
			p.module_id,
			m.module_code,
			m.module_name,
			p.permission_code,
			p.scope_type,
			p.description,
			p.created_at,
			p.updated_at,
			COUNT(DISTINCT rp.role_id) AS mapped_roles_count
		FROM platform.permissions p
		JOIN platform.modules m ON m.module_id = p.module_id
		LEFT JOIN platform.role_permissions rp ON rp.permission_id = p.permission_id
		WHERE p.permission_id = $1
		GROUP BY p.permission_id, p.module_id, m.module_code, m.module_name, p.permission_code, p.scope_type, p.description, p.created_at, p.updated_at
	`
	var pd models.PermissionDetail
	err := r.Executor(ctx).QueryRow(ctx, queryPerm, permissionID).Scan(
		&pd.PermissionID,
		&pd.ModuleID,
		&pd.ModuleCode,
		&pd.ModuleName,
		&pd.PermissionCode,
		&pd.ScopeType,
		&pd.Description,
		&pd.CreatedAt,
		&pd.UpdatedAt,
		&pd.MappedRolesCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("query permission detail: %w", err)
	}

	pd.IsOrphan = (pd.MappedRolesCount == 0)

	// Fetch mapped roles
	const queryRoles = `
		SELECT
			r.role_id,
			r.role_code,
			r.role_name,
			r.scope,
			r.is_system_role
		FROM platform.role_permissions rp
		JOIN platform.roles r ON r.role_id = rp.role_id
		WHERE rp.permission_id = $1
		ORDER BY r.is_system_role DESC, r.role_code ASC
	`
	roleRows, err := r.Executor(ctx).Query(ctx, queryRoles, permissionID)
	if err != nil {
		return nil, fmt.Errorf("query mapped roles: %w", err)
	}
	defer roleRows.Close()

	pd.MappedRoles = make([]models.RoleRef, 0)
	for roleRows.Next() {
		var role models.RoleRef
		if err := roleRows.Scan(
			&role.RoleID,
			&role.RoleCode,
			&role.RoleName,
			&role.Scope,
			&role.IsSystemRole,
		); err != nil {
			return nil, fmt.Errorf("scan mapped role: %w", err)
		}
		pd.MappedRoles = append(pd.MappedRoles, role)
	}
	pd.MappedRolesCount = len(pd.MappedRoles)

	return &pd, nil
}

// GetPermissionWhoHasWhat retrieves mapped roles and all users assigned those roles for a given permission.
func (r *Repository) GetPermissionWhoHasWhat(ctx context.Context, permissionID uuid.UUID) (*models.WhoHasWhatResponse, error) {
	detail, err := r.GetPermissionDetailByID(ctx, permissionID)
	if err != nil {
		return nil, err
	}
	if detail == nil {
		return nil, nil
	}

	resp := &models.WhoHasWhatResponse{
		Permission:      *detail,
		MappedRoles:     detail.MappedRoles,
		AssignedUsers:   make([]models.PermissionUserAssignment, 0),
		TotalRolesCount: len(detail.MappedRoles),
		TotalUsersCount: 0,
		ScopeNotice: "User access is governed strictly by role scope and tenant boundaries. For COLLEGE-scoped roles, permissions operate solely within the assigned college tenant. Mapped permissions do not grant cross-tenant access.",
	}

	if len(detail.MappedRoles) == 0 {
		resp.ScopeNotice = "No roles currently map this permission. No users inherit this permission in the platform."
		return resp, nil
	}

	const userSQL = `
		SELECT
			u.user_id,
			COALESCE(u.email, '') AS email,
			r.role_id,
			r.role_code,
			r.role_name,
			r.scope,
			ur.college_id,
			c.name AS college_name,
			u.status AS user_status,
			ur.status AS assignment_status,
			ur.created_at AS assigned_at,
			ur.expires_at
		FROM platform.role_permissions rp
		JOIN platform.roles r ON r.role_id = rp.role_id
		JOIN platform.user_roles ur ON ur.role_id = r.role_id
		JOIN app.users u ON u.user_id = ur.user_id
		LEFT JOIN platform.colleges c ON c.college_id = ur.college_id
		WHERE rp.permission_id = $1
		ORDER BY ur.created_at DESC
	`
	rows, err := r.Executor(ctx).Query(ctx, userSQL, permissionID)
	if err != nil {
		return nil, fmt.Errorf("query who-has-what users: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var a models.PermissionUserAssignment
		if err := rows.Scan(
			&a.UserID,
			&a.Email,
			&a.RoleID,
			&a.RoleCode,
			&a.RoleName,
			&a.Scope,
			&a.CollegeID,
			&a.CollegeName,
			&a.UserStatus,
			&a.AssignmentStatus,
			&a.AssignedAt,
			&a.ExpiresAt,
		); err != nil {
			return nil, fmt.Errorf("scan who-has-what user: %w", err)
		}
		resp.AssignedUsers = append(resp.AssignedUsers, a)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate who-has-what users: %w", err)
	}

	resp.TotalUsersCount = len(resp.AssignedUsers)
	return resp, nil
}

// ListOrphanPermissions finds permissions that have 0 role mappings.
func (r *Repository) ListOrphanPermissions(ctx context.Context) (*models.OrphanPermissionsReport, error) {
	var catalogSize int
	err := r.Executor(ctx).QueryRow(ctx, `SELECT COUNT(*) FROM platform.permissions`).Scan(&catalogSize)
	if err != nil {
		return nil, fmt.Errorf("count catalog size: %w", err)
	}

	const queryOrphans = `
		SELECT
			p.permission_id,
			p.module_id,
			m.module_code,
			m.module_name,
			p.permission_code,
			p.scope_type,
			p.description,
			p.created_at,
			p.updated_at
		FROM platform.permissions p
		JOIN platform.modules m ON m.module_id = p.module_id
		WHERE NOT EXISTS (
			SELECT 1 FROM platform.role_permissions rp WHERE rp.permission_id = p.permission_id
		)
		ORDER BY m.module_code ASC, p.permission_code ASC
	`
	rows, err := r.Executor(ctx).Query(ctx, queryOrphans)
	if err != nil {
		return nil, fmt.Errorf("query orphan permissions: %w", err)
	}
	defer rows.Close()

	orphans := make([]models.PermissionDetail, 0)
	for rows.Next() {
		var p models.PermissionDetail
		if err := rows.Scan(
			&p.PermissionID,
			&p.ModuleID,
			&p.ModuleCode,
			&p.ModuleName,
			&p.PermissionCode,
			&p.ScopeType,
			&p.Description,
			&p.CreatedAt,
			&p.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan orphan permission: %w", err)
		}
		p.MappedRolesCount = 0
		p.IsOrphan = true
		orphans = append(orphans, p)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate orphan permissions: %w", err)
	}

	return &models.OrphanPermissionsReport{
		Definition:  "An orphan permission is defined as an atomic permission in platform.permissions that is currently mapped to ZERO roles in platform.role_permissions. This is a database role-mapping relationship and does not indicate whether the permission key is checked by backend API route handlers.",
		Notice:      "Permissions identified as unmapped in database are candidates for role mapping or code deprecation analysis.",
		TotalCount:  len(orphans),
		CatalogSize: catalogSize,
		Orphans:     orphans,
	}, nil
}

// RecordPermissionAudit writes an immutable audit record into platform.audit_logs for permission operations.
func (r *Repository) RecordPermissionAudit(
	ctx context.Context,
	params models.PermissionAuditParams,
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
			'super_admin_permissions',
			$3,
			'platform.permissions',
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
		params.PermissionID,
		newData,
		params.Reason,
	)
	if err != nil {
		return fmt.Errorf("record permission audit: %w", err)
	}
	return nil
}
