package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
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
	IsSystemRole   bool       `json:"is_system_role"`
	CollegeCode    *string    `json:"college_code,omitempty"`
	CollegeName    *string    `json:"college_name,omitempty"`
	CollegeLogoURL *string    `json:"college_logo_url,omitempty"`
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
			r.is_system_role,

			c.college_code,
			c.name,
			NULL::text AS logo_url

		FROM platform.user_roles ur

		INNER JOIN platform.roles r
			ON r.role_id = ur.role_id

		LEFT JOIN platform.colleges c
			ON c.college_id = ur.college_id

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
			&membership.CollegeCode,
			&membership.CollegeName,
			&membership.CollegeLogoURL,
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


// PublicCollegeBranding contains basic public branding for login and institutional identification.
type PublicCollegeBranding struct {
	CollegeID   uuid.UUID `json:"college_id"`
	CollegeCode string    `json:"college_code"`
	Name        string    `json:"name"`
	LogoURL     *string   `json:"logo_url,omitempty"`
	Status      string    `json:"status"`
}

// ListPublicColleges returns public branding information for all active/onboarding colleges.
func (r *Repository) ListPublicColleges(ctx context.Context) ([]PublicCollegeBranding, error) {
	executor := r.Executor(ctx)
	if r.PlatformPool != nil {
		executor = r.PlatformPool
	}

	rows, err := executor.Query(ctx, `
		SELECT college_id, college_code, name, NULL::text AS logo_url, status
		FROM platform.colleges
		WHERE status IN ('ACTIVE', 'ONBOARDING')
		ORDER BY name ASC
	`)
	if err != nil {
		if r.PlatformPool != nil && r.Pool != nil && r.PlatformPool != r.Pool {
			rows, err = r.Pool.Query(ctx, `
				SELECT college_id, college_code, name, NULL::text AS logo_url, status
				FROM platform.colleges
				WHERE status IN ('ACTIVE', 'ONBOARDING')
				ORDER BY name ASC
			`)
			if err != nil {
				return nil, fmt.Errorf("failed to list public colleges: %w", err)
			}
		} else {
			return nil, fmt.Errorf("failed to list public colleges: %w", err)
		}
	}
	defer rows.Close()

	var list []PublicCollegeBranding
	for rows.Next() {
		var b PublicCollegeBranding
		if err := rows.Scan(&b.CollegeID, &b.CollegeCode, &b.Name, &b.LogoURL, &b.Status); err != nil {
			return nil, fmt.Errorf("failed to scan public college: %w", err)
		}
		list = append(list, b)
	}
	return list, nil
}

// GetPublicCollegeBranding finds a college's branding by code, id, name, or admin email prefix.
func (r *Repository) GetPublicCollegeBranding(ctx context.Context, identifier string) (*PublicCollegeBranding, error) {
	idLower := strings.TrimSpace(strings.ToLower(identifier))
	if idLower == "" {
		return nil, ErrNotFound
	}
	prefix := idLower
	if atIdx := strings.Index(prefix, "@"); atIdx != -1 {
		prefix = prefix[:atIdx]
	}
	if dotAdminIdx := strings.Index(prefix, ".admin"); dotAdminIdx != -1 {
		prefix = prefix[:dotAdminIdx]
	}

	executor := r.Executor(ctx)
	if r.PlatformPool != nil {
		executor = r.PlatformPool
	}

	var b PublicCollegeBranding
	query := `
		SELECT college_id, college_code, name, NULL::text AS logo_url, status
		FROM platform.colleges
		WHERE LOWER(college_code) = $1
		   OR LOWER(college_code) = $2
		   OR college_id::text = $1
		   OR LOWER(name) ILIKE $1
		LIMIT 1
	`
	err := executor.QueryRow(ctx, query, idLower, prefix).Scan(&b.CollegeID, &b.CollegeCode, &b.Name, &b.LogoURL, &b.Status)
	if err != nil {
		if r.PlatformPool != nil && r.Pool != nil && r.PlatformPool != r.Pool {
			err = r.Pool.QueryRow(ctx, query, idLower, prefix).Scan(&b.CollegeID, &b.CollegeCode, &b.Name, &b.LogoURL, &b.Status)
		}
	}
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get college branding: %w", err)
	}
	return &b, nil
}
