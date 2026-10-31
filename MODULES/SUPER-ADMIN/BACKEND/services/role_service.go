package services

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

var (
	roleCodeRegex = regexp.MustCompile(`^[A-Z][A-Z0-9_]{1,99}$`)
	permCacheMutex sync.RWMutex
	permCacheData  = make(map[string][]models.Permission)
	permCacheTime  = make(map[string]time.Time)
)

// RoleService handles business logic for authorization roles and permission mapping.
type RoleService struct {
	db   *database.Database
	repo *repository.Repository
}

// NewRoleService creates a new RoleService instance.
func NewRoleService(db *database.Database, repo *repository.Repository) *RoleService {
	return &RoleService{
		db:   db,
		repo: repo,
	}
}

// ListRoles retrieves a filtered, paginated list of roles with summary counts.
func (s *RoleService) ListRoles(
	ctx context.Context,
	params models.ListRolesParams,
) (*models.ListRolesResponse, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Role service is not configured")
	}

	limit := params.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := params.Offset
	if offset < 0 {
		offset = 0
	}

	roles, total, err := s.repo.ListRoles(ctx, params)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to list roles: %v", err))
	}

	return &models.ListRolesResponse{
		Roles:  roles,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}, nil
}

// GetRole retrieves full role details including all mapped atomic permissions.
func (s *RoleService) GetRole(ctx context.Context, roleID uuid.UUID) (*models.RoleDetail, error) {
	if roleID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "Role ID is required")
	}
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Role service is not configured")
	}

	role, err := s.repo.GetRoleByID(ctx, roleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "Role not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to get role: %v", err))
	}

	permissions, err := s.repo.GetRolePermissions(ctx, roleID)
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to get role permissions: %v", err))
	}

	return &models.RoleDetail{
		Role:        *role,
		Permissions: permissions,
	}, nil
}

// ListPermissions returns the complete atomic permission catalog with in-memory caching.
func (s *RoleService) ListPermissions(ctx context.Context, scopeType string) ([]models.Permission, error) {
	if s == nil || s.repo == nil {
		return nil, apierrors.New(apierrors.InternalError, "Role service is not configured")
	}

	cleanScope := strings.ToUpper(strings.TrimSpace(scopeType))

	// Check cache
	permCacheMutex.RLock()
	cached, ok := permCacheData[cleanScope]
	cachedAt := permCacheTime[cleanScope]
	permCacheMutex.RUnlock()

	if ok && time.Since(cachedAt) < 5*time.Minute {
		return cached, nil
	}

	perms, err := s.repo.ListAllPermissions(ctx, cleanScope)
	if err != nil {
		return nil, err
	}

	// Store in cache
	permCacheMutex.Lock()
	permCacheData[cleanScope] = perms
	permCacheTime[cleanScope] = time.Now()
	permCacheMutex.Unlock()

	return perms, nil
}

// CreateCustomRole creates a new custom role with validated scope and permissions.
func (s *RoleService) CreateCustomRole(
	ctx context.Context,
	req models.CreateRoleRequest,
) (*models.RoleDetail, error) {
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Role service is not configured")
	}

	cleanCode := strings.ToUpper(strings.TrimSpace(req.RoleCode))
	cleanName := strings.TrimSpace(req.RoleName)
	cleanScope := strings.ToUpper(strings.TrimSpace(req.Scope))

	if !roleCodeRegex.MatchString(cleanCode) {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"Role code must start with a letter and contain only uppercase alphanumeric characters and underscores (2-100 characters)",
		)
	}
	if len(cleanName) < 2 || len(cleanName) > 150 {
		return nil, apierrors.New(apierrors.ValidationError, "Role name must be between 2 and 150 characters")
	}
	if cleanScope != "COLLEGE" && cleanScope != "PLATFORM" {
		return nil, apierrors.New(apierrors.ValidationError, "Role scope must be either COLLEGE or PLATFORM")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Check unique code
	existing, err := s.repo.GetRoleByCode(ctx, cleanCode)
	if err == nil && existing != nil {
		return nil, apierrors.New(apierrors.Conflict, fmt.Sprintf("A role with code '%s' already exists", cleanCode))
	}

	// Validate permission IDs and scope compatibility
	var validatedPermissions []models.Permission
	if len(req.PermissionIDs) > 0 {
		allPerms, err := s.repo.ListAllPermissions(ctx, "ALL")
		if err != nil {
			return nil, apierrors.New(apierrors.InternalError, "Failed to retrieve permission catalog")
		}

		permMap := make(map[uuid.UUID]models.Permission, len(allPerms))
		for _, p := range allPerms {
			permMap[p.PermissionID] = p
		}

		dedupMap := make(map[uuid.UUID]bool)
		for _, pid := range req.PermissionIDs {
			if dedupMap[pid] {
				continue
			}
			dedupMap[pid] = true

			perm, exists := permMap[pid]
			if !exists {
				return nil, apierrors.New(apierrors.ValidationError, fmt.Sprintf("Permission '%s' does not exist in catalog", pid))
			}

			// Scope compatibility validation
			if cleanScope == "COLLEGE" && perm.ScopeType == "PLATFORM" {
				return nil, apierrors.New(
					apierrors.ValidationError,
					fmt.Sprintf("Cannot assign PLATFORM-scoped permission '%s' to a COLLEGE-scoped role", perm.PermissionCode),
				)
			}

			validatedPermissions = append(validatedPermissions, perm)
		}
	}

	validatedIDs := make([]uuid.UUID, 0, len(validatedPermissions))
	for _, p := range validatedPermissions {
		validatedIDs = append(validatedIDs, p.PermissionID)
	}

	var createdRole *models.Role
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		createReq := req
		createReq.RoleCode = cleanCode
		createReq.RoleName = cleanName
		createReq.Scope = cleanScope

		createdRole, txErr = s.repo.CreateCustomRole(txCtx, createReq, validatedIDs)
		if txErr != nil {
			return txErr
		}

		permCodes := make([]string, len(validatedPermissions))
		for i, p := range validatedPermissions {
			permCodes[i] = p.PermissionCode
		}

		return s.repo.RecordRoleAudit(txCtx, models.RoleAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			RoleID:      createdRole.RoleID,
			Action:      "ROLE_CREATED",
			Reason:      "Custom role creation via Super Admin",
			Details: map[string]interface{}{
				"role_code":   cleanCode,
				"role_name":   cleanName,
				"scope":       cleanScope,
				"permissions": permCodes,
			},
		})
	})

	if err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			return nil, apierrors.New(apierrors.Conflict, fmt.Sprintf("A role with code '%s' already exists", cleanCode))
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to create custom role: %v", err))
	}

	return &models.RoleDetail{
		Role:        *createdRole,
		Permissions: validatedPermissions,
	}, nil
}

// CloneRole duplicates an existing role's definition and permission mappings into a new custom role.
func (s *RoleService) CloneRole(
	ctx context.Context,
	sourceRoleID uuid.UUID,
	req models.CloneRoleRequest,
) (*models.RoleDetail, error) {
	if sourceRoleID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "Source role ID is required")
	}
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Role service is not configured")
	}

	cleanCode := strings.ToUpper(strings.TrimSpace(req.NewRoleCode))
	cleanName := strings.TrimSpace(req.NewRoleName)

	if !roleCodeRegex.MatchString(cleanCode) {
		return nil, apierrors.New(
			apierrors.ValidationError,
			"New role code must start with a letter and contain only uppercase alphanumeric characters and underscores (2-100 characters)",
		)
	}
	if len(cleanName) < 2 || len(cleanName) > 150 {
		return nil, apierrors.New(apierrors.ValidationError, "New role name must be between 2 and 150 characters")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Verify source role exists
	sourceRole, err := s.repo.GetRoleByID(ctx, sourceRoleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "Source role not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to verify source role: %v", err))
	}

	// Check new code uniqueness
	existing, err := s.repo.GetRoleByCode(ctx, cleanCode)
	if err == nil && existing != nil {
		return nil, apierrors.New(apierrors.Conflict, fmt.Sprintf("A role with code '%s' already exists", cleanCode))
	}

	var clonedRole *models.Role
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		clonedRole, txErr = s.repo.CloneRole(txCtx, sourceRoleID, cleanCode, cleanName, req.IncludePermissions)
		if txErr != nil {
			return txErr
		}

		return s.repo.RecordRoleAudit(txCtx, models.RoleAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			RoleID:      clonedRole.RoleID,
			Action:      "ROLE_CLONED",
			Reason:      fmt.Sprintf("Cloned from role %s (%s)", sourceRole.RoleCode, sourceRoleID),
			Details: map[string]interface{}{
				"source_role_id":      sourceRoleID.String(),
				"source_role_code":    sourceRole.RoleCode,
				"new_role_code":       cleanCode,
				"new_role_name":       cleanName,
				"include_permissions": req.IncludePermissions,
			},
		})
	})

	if err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			return nil, apierrors.New(apierrors.Conflict, fmt.Sprintf("A role with code '%s' already exists", cleanCode))
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to clone role: %v", err))
	}

	// Fetch cloned role permissions
	permissions, _ := s.repo.GetRolePermissions(ctx, clonedRole.RoleID)
	return &models.RoleDetail{
		Role:        *clonedRole,
		Permissions: permissions,
	}, nil
}

// UpdateCustomRole updates permitted metadata of a custom role. System roles are immutable.
func (s *RoleService) UpdateCustomRole(
	ctx context.Context,
	roleID uuid.UUID,
	req models.UpdateRoleRequest,
) (*models.Role, error) {
	if roleID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "Role ID is required")
	}
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Role service is not configured")
	}

	cleanName := strings.TrimSpace(req.RoleName)
	if len(cleanName) < 2 || len(cleanName) > 150 {
		return nil, apierrors.New(apierrors.ValidationError, "Role name must be between 2 and 150 characters")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Verify role exists and is NOT a system role
	role, err := s.repo.GetRoleByID(ctx, roleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "Role not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to retrieve role: %v", err))
	}

	if role.IsSystemRole {
		return nil, apierrors.New(
			apierrors.Forbidden,
			"Protected system roles are immutable and cannot be modified",
		)
	}

	var updated *models.Role
	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		var txErr error
		updated, txErr = s.repo.UpdateCustomRole(txCtx, roleID, cleanName)
		if txErr != nil {
			return txErr
		}

		return s.repo.RecordRoleAudit(txCtx, models.RoleAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			RoleID:      roleID,
			Action:      "ROLE_UPDATED",
			Reason:      "Custom role metadata updated",
			Details: map[string]interface{}{
				"old_name": role.RoleName,
				"new_name": cleanName,
			},
		})
	})

	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update role: %v", err))
	}

	return updated, nil
}

// UpdateRolePermissions synchronizes mapped permissions for a custom role.
func (s *RoleService) UpdateRolePermissions(
	ctx context.Context,
	roleID uuid.UUID,
	req models.UpdateRolePermissionsRequest,
) (*models.RoleDetail, error) {
	if roleID == uuid.Nil {
		return nil, apierrors.New(apierrors.ValidationError, "Role ID is required")
	}
	if strings.TrimSpace(req.Reason) == "" {
		return nil, apierrors.New(apierrors.ValidationError, "Reason for permission change is required")
	}
	if s == nil || s.repo == nil || s.db == nil {
		return nil, apierrors.New(apierrors.InternalError, "Role service is not configured")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return nil, apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	// Verify target role exists
	role, err := s.repo.GetRoleByID(ctx, roleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apierrors.New(apierrors.NotFound, "Role not found")
		}
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to retrieve role: %v", err))
	}

	if role.IsSystemRole {
		return nil, apierrors.New(
			apierrors.Forbidden,
			"Protected system roles are immutable; core permission mappings cannot be altered",
		)
	}

	// Validate requested permissions against catalog and scope
	allPerms, err := s.repo.ListAllPermissions(ctx, "ALL")
	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, "Failed to retrieve permission catalog")
	}

	permMap := make(map[uuid.UUID]models.Permission, len(allPerms))
	for _, p := range allPerms {
		permMap[p.PermissionID] = p
	}

	var validatedPermissions []models.Permission
	dedupMap := make(map[uuid.UUID]bool)
	for _, pid := range req.PermissionIDs {
		if dedupMap[pid] {
			continue
		}
		dedupMap[pid] = true

		perm, exists := permMap[pid]
		if !exists {
			return nil, apierrors.New(apierrors.ValidationError, fmt.Sprintf("Permission '%s' does not exist in catalog", pid))
		}

		// Scope compatibility validation
		if role.Scope == "COLLEGE" && perm.ScopeType == "PLATFORM" {
			return nil, apierrors.New(
				apierrors.ValidationError,
				fmt.Sprintf("Cannot assign PLATFORM-scoped permission '%s' to a COLLEGE-scoped role", perm.PermissionCode),
			)
		}

		validatedPermissions = append(validatedPermissions, perm)
	}

	validatedIDs := make([]uuid.UUID, 0, len(validatedPermissions))
	for _, p := range validatedPermissions {
		validatedIDs = append(validatedIDs, p.PermissionID)
	}

	// Fetch previous permissions for before-and-after audit diff
	oldPerms, _ := s.repo.GetRolePermissions(ctx, roleID)
	oldPermCodes := make([]string, len(oldPerms))
	for i, p := range oldPerms {
		oldPermCodes[i] = p.PermissionCode
	}

	newPermCodes := make([]string, len(validatedPermissions))
	for i, p := range validatedPermissions {
		newPermCodes[i] = p.PermissionCode
	}

	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		if txErr := s.repo.UpdateRolePermissions(txCtx, roleID, validatedIDs); txErr != nil {
			return txErr
		}

		return s.repo.RecordRoleAudit(txCtx, models.RoleAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			RoleID:      roleID,
			Action:      "ROLE_PERMISSIONS_UPDATED",
			Reason:      req.Reason,
			Details: map[string]interface{}{
				"role_code":        role.RoleCode,
				"previous_perms":   oldPermCodes,
				"updated_perms":    newPermCodes,
				"permission_count": len(validatedIDs),
			},
		})
	})

	if err != nil {
		return nil, apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to update role permissions: %v", err))
	}

	updatedRole, _ := s.repo.GetRoleByID(ctx, roleID)
	return &models.RoleDetail{
		Role:        *updatedRole,
		Permissions: validatedPermissions,
	}, nil
}

// DeleteCustomRole removes an unused custom role.
func (s *RoleService) DeleteCustomRole(ctx context.Context, roleID uuid.UUID) error {
	if roleID == uuid.Nil {
		return apierrors.New(apierrors.ValidationError, "Role ID is required")
	}
	if s == nil || s.repo == nil || s.db == nil {
		return apierrors.New(apierrors.InternalError, "Role service is not configured")
	}

	actorID, _ := database.PlatformUserIDFromContext(ctx)
	if actorID == uuid.Nil {
		return apierrors.New(apierrors.Unauthorized, "Authenticated actor user ID is required")
	}
	actorRole, _ := ctx.Value(ActorRoleContextKey).(string)
	if strings.TrimSpace(actorRole) == "" {
		actorRole = "SUPER_ADMIN"
	}

	role, err := s.repo.GetRoleByID(ctx, roleID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apierrors.New(apierrors.NotFound, "Role not found")
		}
		return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to retrieve role: %v", err))
	}

	if role.IsSystemRole {
		return apierrors.New(
			apierrors.Forbidden,
			"Protected system roles are immutable and cannot be deleted",
		)
	}

	// Check if actively assigned to any user
	userCount, err := s.repo.CountRoleUsers(ctx, roleID)
	if err != nil {
		return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to check role assignments: %v", err))
	}
	if userCount > 0 {
		return apierrors.New(
			apierrors.Conflict,
			fmt.Sprintf("Cannot delete role '%s': it is actively assigned to %d user(s). Reassign or revoke all users before deletion.", role.RoleCode, userCount),
		)
	}

	err = s.db.WithPlatformTransaction(ctx, func(txCtx context.Context, _ pgx.Tx) error {
		if txErr := s.repo.DeleteCustomRole(txCtx, roleID); txErr != nil {
			return txErr
		}

		return s.repo.RecordRoleAudit(txCtx, models.RoleAuditParams{
			ActorUserID: actorID,
			ActorRole:   actorRole,
			RoleID:      roleID,
			Action:      "ROLE_DELETED",
			Reason:      "Unused custom role deleted",
			Details: map[string]interface{}{
				"role_code": role.RoleCode,
				"role_name": role.RoleName,
				"scope":     role.Scope,
			},
		})
	})

	if err != nil {
		return apierrors.New(apierrors.InternalError, fmt.Sprintf("Failed to delete role: %v", err))
	}

	return nil
}

// ListRoleTemplates returns the architectural status of role templates.
func (s *RoleService) ListRoleTemplates(ctx context.Context) (map[string]interface{}, error) {
	return map[string]interface{}{
		"status": "BLOCKED_SCHEMA_MIGRATION_REQUIRED",
		"message": "Role templates (e.g. College Admin, Hostel Incharge) are architectural concepts that require a dedicated platform.role_templates database table. Entitlement templates only manage module access matrices. Role template persistence is currently withheld pending schema approval.",
		"templates": []map[string]interface{}{
			{
				"template_code": "COLLEGE_ADMIN_TEMPLATE",
				"name":          "College Administrator Default Template",
				"scope":         "COLLEGE",
				"is_published":  false,
				"status":        "PENDING_SCHEMA_APPROVAL",
			},
			{
				"template_code": "HOSTEL_INCHARGE_TEMPLATE",
				"name":          "Hostel Incharge Default Template",
				"scope":         "COLLEGE",
				"is_published":  false,
				"status":        "PENDING_SCHEMA_APPROVAL",
			},
		},
	}, nil
}
