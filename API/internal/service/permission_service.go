package service

import (
	"context"
	"errors"
	"strings"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

var (
	ErrInvalidPermissionCode = errors.New("invalid permission code")
	ErrInvalidUserID         = errors.New("invalid user id")
	ErrPermissionDenied      = errors.New("permission denied")
)

// PermissionService provides application-level authorization operations.
//
// Responsibilities:
//   - Validate and normalize permission inputs.
//   - Delegate persistence operations to the repository layer.
//   - Provide consistent authorization behavior.
//   - Keep SQL and database-specific logic outside the service.
//
// The service does NOT:
//   - Execute SQL directly.
//   - Decide tenant/module entitlement.
//   - Inspect HTTP requests.
//   - Read permissions from request headers.
//   - Trust permission values supplied by clients.
type PermissionService struct {
	repository *repository.Repository
}

// NewPermissionService creates a new permission service.
func NewPermissionService(
	repository *repository.Repository,
) *PermissionService {
	return &PermissionService{
		repository: repository,
	}
}

// GetPermissionByCode returns a permission from the database by its
// canonical permission code.
//
// Example:
//
//	"hostel.manage"
//	"people.view"
//	"platform.manage"
func (s *PermissionService) GetPermissionByCode(
	ctx context.Context,
	permissionCode string,
) (repository.Permission, error) {

	code := normalizePermissionCode(permissionCode)

	if code == "" {
		return repository.Permission{}, ErrInvalidPermissionCode
	}

	permission, err := s.repository.GetPermissionByCode(ctx, code)
	if err != nil {
		return repository.Permission{}, err
	}

	return permission, nil
}

// HasPermission determines whether a user currently has the requested
// permission.
//
// This is the primary method that authorization middleware will use.
//
// Important:
//   - The user ID must come from authenticated JWT/session context.
//   - The permission code must come from server-side route configuration.
//   - The client must never be allowed to choose either value.
//
// This method returns false for a missing permission instead of converting
// "permission does not exist" into an authorization grant.
func (s *PermissionService) HasPermission(
	ctx context.Context,
	userID uuid.UUID,
	permissionCode string,
) (bool, error) {

	if userID == uuid.Nil {
		return false, ErrInvalidUserID
	}

	code := normalizePermissionCode(permissionCode)

	if code == "" {
		return false, ErrInvalidPermissionCode
	}

	hasPermission, err := s.repository.HasUserPermission(
		ctx,
		userID,
		code,
	)
	if err != nil {
		return false, err
	}

	return hasPermission, nil
}

// RequirePermission verifies that a user has a specific permission.
//
// This method is useful for service-level authorization checks where the
// caller wants an explicit authorization error instead of a boolean.
//
// Returns:
//   - nil when the permission exists.
//   - ErrPermissionDenied when it does not.
func (s *PermissionService) RequirePermission(
	ctx context.Context,
	userID uuid.UUID,
	permissionCode string,
) error {

	hasPermission, err := s.HasPermission(
		ctx,
		userID,
		permissionCode,
	)
	if err != nil {
		return err
	}

	if !hasPermission {
		return ErrPermissionDenied
	}

	return nil
}

// ListUserPermissions returns all permissions currently assigned to a user.
//
// This is primarily useful for:
//   - /auth/me
//   - authorization debugging
//   - future permission caching
//   - administrative access inspection
func (s *PermissionService) ListUserPermissions(
	ctx context.Context,
	userID uuid.UUID,
) ([]repository.UserPermission, error) {

	if userID == uuid.Nil {
		return nil, ErrInvalidUserID
	}

	permissions, err := s.repository.ListUserPermissions(
		ctx,
		userID,
	)
	if err != nil {
		return nil, err
	}

	if permissions == nil {
		return []repository.UserPermission{}, nil
	}

	return permissions, nil
}

// ListRolePermissions returns all permissions assigned to a role.
//
// roleCode is normalized before reaching the repository.
func (s *PermissionService) ListRolePermissions(
	ctx context.Context,
	roleCode string,
) ([]repository.Permission, error) {

	code := normalizeRoleCode(roleCode)

	if code == "" {
		return nil, errors.New("invalid role code")
	}

	permissions, err := s.repository.ListRolePermissions(
		ctx,
		code,
	)
	if err != nil {
		return nil, err
	}

	if permissions == nil {
		return []repository.Permission{}, nil
	}

	return permissions, nil
}

// normalizePermissionCode normalizes a permission code without changing
// its semantic value.
//
// Permission codes are treated as canonical lowercase identifiers.
//
// Example:
//
//	" HOSTEL.MANAGE " -> "hostel.manage"
func normalizePermissionCode(permissionCode string) string {
	return strings.ToLower(strings.TrimSpace(permissionCode))
}

// normalizeRoleCode normalizes a role code.
//
// Example:
//
//	" COLLEGE_ADMIN " -> "COLLEGE_ADMIN"
func normalizeRoleCode(roleCode string) string {
	return strings.ToUpper(strings.TrimSpace(roleCode))
}
