package repository

import (
	"context"

	"github.com/google/uuid"
)

// Permission represents a permission registered in the platform.
type Permission struct {
	PermissionID   uuid.UUID  `json:"permission_id"`
	ModuleID       *uuid.UUID `json:"module_id"`
	PermissionCode string     `json:"permission_code"`
	Description    *string    `json:"description"`
}

// UserPermission represents a permission available through
// the user's currently valid role memberships.
type UserPermission struct {
	PermissionID   uuid.UUID  `json:"permission_id"`
	PermissionCode string     `json:"permission_code"`
	Description    *string    `json:"description"`
	ModuleID       *uuid.UUID `json:"module_id"`
	ModuleCode     *string    `json:"module_code"`
}

// GetPermissionByCode retrieves a permission by its code.
func (r *Repository) GetPermissionByCode(
	ctx context.Context,
	permissionCode string,
) (Permission, error) {
	const query = `
		SELECT
			permission_id,
			module_id,
			permission_code,
			description
		FROM platform.permissions
		WHERE permission_code = $1
	`

	var p Permission

	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		permissionCode,
	).Scan(
		&p.PermissionID,
		&p.ModuleID,
		&p.PermissionCode,
		&p.Description,
	)

	if err != nil {
		return Permission{}, err
	}

	return p, nil
}

// HasUserPermission returns whether a user has the requested permission
// through a currently active, unexpired role assignment.
//
// Role scope must match permission scope. Platform role assignments
// must not have a college ID; college role assignments must have one.
func (r *Repository) HasUserPermission(
	ctx context.Context,
	userID uuid.UUID,
	permissionCode string,
) (bool, error) {
	const query = `
		SELECT EXISTS (
			SELECT 1
			FROM platform.user_roles ur
			INNER JOIN platform.roles ro
				ON ro.role_id = ur.role_id
			INNER JOIN platform.role_permissions rp
				ON rp.role_id = ro.role_id
			INNER JOIN platform.permissions p
				ON p.permission_id = rp.permission_id
			WHERE ur.user_id = $1
			  AND p.permission_code = $2
			  AND ur.status = 'ACTIVE'
			  AND (
				ur.expires_at IS NULL
				OR ur.expires_at > NOW()
			  )
			  AND ro.scope = p.scope_type
			  AND (
				(ro.scope = 'PLATFORM' AND ur.college_id IS NULL)
				OR
				(ro.scope = 'COLLEGE' AND ur.college_id IS NOT NULL)
			  )
		)
	`

	var hasPermission bool

	err := r.Executor(ctx).QueryRow(
		ctx,
		query,
		userID,
		permissionCode,
	).Scan(&hasPermission)

	if err != nil {
		return false, err
	}

	return hasPermission, nil
}

// ListUserPermissions lists distinct permissions granted through
// currently active, unexpired and scope-consistent role assignments.
func (r *Repository) ListUserPermissions(
	ctx context.Context,
	userID uuid.UUID,
) ([]UserPermission, error) {
	const query = `
		SELECT DISTINCT
			p.permission_id,
			p.permission_code,
			p.description,
			m.module_id,
			m.module_code
		FROM platform.user_roles ur
		INNER JOIN platform.roles ro
			ON ro.role_id = ur.role_id
		INNER JOIN platform.role_permissions rp
			ON rp.role_id = ro.role_id
		INNER JOIN platform.permissions p
			ON p.permission_id = rp.permission_id
		LEFT JOIN platform.modules m
			ON m.module_id = p.module_id
		WHERE ur.user_id = $1
		  AND ur.status = 'ACTIVE'
		  AND (
			ur.expires_at IS NULL
			OR ur.expires_at > NOW()
		  )
		  AND ro.scope = p.scope_type
		  AND (
			(ro.scope = 'PLATFORM' AND ur.college_id IS NULL)
			OR
			(ro.scope = 'COLLEGE' AND ur.college_id IS NOT NULL)
		  )
		ORDER BY p.permission_code
	`

	rows, err := r.Executor(ctx).Query(ctx, query, userID)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	perms := make([]UserPermission, 0)

	for rows.Next() {
		var up UserPermission

		if err := rows.Scan(
			&up.PermissionID,
			&up.PermissionCode,
			&up.Description,
			&up.ModuleID,
			&up.ModuleCode,
		); err != nil {
			return nil, err
		}

		perms = append(perms, up)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return perms, nil
}

// ListRolePermissions lists permissions assigned to a role code.
// This is a role-definition query, not a user authorization check.
func (r *Repository) ListRolePermissions(
	ctx context.Context,
	roleCode string,
) ([]Permission, error) {
	const query = `
		SELECT
			p.permission_id,
			p.module_id,
			p.permission_code,
			p.description
		FROM platform.roles ro
		INNER JOIN platform.role_permissions rp
			ON rp.role_id = ro.role_id
		INNER JOIN platform.permissions p
			ON p.permission_id = rp.permission_id
		WHERE ro.role_code = $1
		  AND ro.scope = p.scope_type
		ORDER BY p.permission_code
	`

	rows, err := r.Executor(ctx).Query(ctx, query, roleCode)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	perms := make([]Permission, 0)

	for rows.Next() {
		var p Permission

		if err := rows.Scan(
			&p.PermissionID,
			&p.ModuleID,
			&p.PermissionCode,
			&p.Description,
		); err != nil {
			return nil, err
		}

		perms = append(perms, p)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return perms, nil
}
