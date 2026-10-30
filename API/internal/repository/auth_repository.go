package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// AuthIdentity represents the authenticated user and all
// active role memberships available to that user.
type AuthIdentity struct {
	UserID       uuid.UUID
	Email        *string
	PasswordHash *string
	UserStatus   string
	MFAEnabled   bool

	Memberships []AuthMembership
}

// AuthMembership represents one active user-role assignment.
//
// CollegeID is nil for platform-scoped roles such as SUPER_ADMIN.
// CollegeID must be present for college-scoped roles.
type AuthMembership struct {
	UserRoleID   uuid.UUID  `json:"user_role_id"`
	RoleID       uuid.UUID  `json:"role_id"`
	CollegeID    *uuid.UUID `json:"college_id"`
	Status       string     `json:"status"`
	ExpiresAt    *time.Time `json:"expires_at"`
	RoleCode     string     `json:"role_code"`
	RoleName     string     `json:"role_name"`
	RoleScope    string     `json:"role_scope"`
	IsSystemRole bool       `json:"is_system_role"`
}

// FindAuthIdentityByEmail retrieves the user account and all of
// the user's currently active role memberships.
//
// This method intentionally does not select a single membership.
// A user may belong to multiple colleges and/or have multiple roles.
func (r *Repository) FindAuthIdentityByEmail(
	ctx context.Context,
	email string,
) (*AuthIdentity, error) {
	const userQuery = `
		SELECT
			user_id,
			email,
			password_hash,
			status,
			mfa_enabled
		FROM app.users
		WHERE LOWER(email) = LOWER($1)
	`

	var identity AuthIdentity

	err := r.Executor(ctx).QueryRow(
		ctx,
		userQuery,
		email,
	).Scan(
		&identity.UserID,
		&identity.Email,
		&identity.PasswordHash,
		&identity.UserStatus,
		&identity.MFAEnabled,
	)

	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			// Also check if identifier matches a college code or college ID for COLLEGE_ADMIN
			const collegeAdminQuery = `
				SELECT
					u.user_id,
					u.email,
					u.password_hash,
					u.status,
					u.mfa_enabled
				FROM app.users u
				JOIN platform.user_roles ur ON ur.user_id = u.user_id
				JOIN platform.roles r ON r.role_id = ur.role_id
				JOIN platform.colleges c ON c.college_id = ur.college_id
				WHERE (LOWER(c.college_code) = LOWER($1) OR c.college_id::text = $1)
				  AND r.role_code = 'COLLEGE_ADMIN'
				  AND ur.status = 'ACTIVE'
				ORDER BY ur.created_at DESC
				LIMIT 1
			`
			err2 := r.Executor(ctx).QueryRow(
				ctx,
				collegeAdminQuery,
				email,
			).Scan(
				&identity.UserID,
				&identity.Email,
				&identity.PasswordHash,
				&identity.UserStatus,
				&identity.MFAEnabled,
			)
			if err2 != nil {
				if errors.Is(err2, pgx.ErrNoRows) {
					return nil, ErrNotFound
				}
				return nil, fmt.Errorf(
					"failed to find user by email or college identifier: %w",
					err2,
				)
			}
		} else {
			return nil, fmt.Errorf(
				"failed to find user by email: %w",
				err,
			)
		}
	}

	const membershipQuery = `
		SELECT
			ur.user_role_id,
			ur.role_id,
			ur.college_id,
			ur.status,
			ur.expires_at,

			r.role_code,
			r.role_name,
			r.scope,
			r.is_system_role

		FROM platform.user_roles ur

		INNER JOIN platform.roles r
			ON r.role_id = ur.role_id

		WHERE ur.user_id = $1
		  AND ur.status = 'ACTIVE'
		  AND (
				ur.expires_at IS NULL
				OR ur.expires_at > NOW()
		  )

		ORDER BY
			r.scope,
			r.role_code,
			ur.college_id
	`

	rows, err := r.Executor(ctx).Query(
		ctx,
		membershipQuery,
		identity.UserID,
	)
	if err != nil {
		return nil, fmt.Errorf(
			"failed to find user role memberships: %w",
			err,
		)
	}
	defer rows.Close()

	for rows.Next() {
		var membership AuthMembership

		err := rows.Scan(
			&membership.UserRoleID,
			&membership.RoleID,
			&membership.CollegeID,
			&membership.Status,
			&membership.ExpiresAt,
			&membership.RoleCode,
			&membership.RoleName,
			&membership.RoleScope,
			&membership.IsSystemRole,
		)
		if err != nil {
			return nil, fmt.Errorf(
				"failed to scan user role membership: %w",
				err,
			)
		}

		identity.Memberships = append(
			identity.Memberships,
			membership,
		)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf(
			"failed while reading user role memberships: %w",
			err,
		)
	}

	return &identity, nil
}
