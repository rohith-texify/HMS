package handlers

import (
	"context"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// RoleHandler handles HTTP requests for roles and permissions management.
type RoleHandler struct {
	service *services.RoleService
}

// NewRoleHandler creates a new RoleHandler instance.
func NewRoleHandler(service *services.RoleService) *RoleHandler {
	return &RoleHandler{
		service: service,
	}
}

// ListRoles handles GET /super-admin/roles - list all roles with filters and pagination.
func (h *RoleHandler) ListRoles(c *gin.Context) {
	var params models.ListRolesParams
	if err := c.ShouldBindQuery(&params); err != nil {
		respondError(c, validators.NewValidationError("Invalid query parameters"))
		return
	}

	res, err := h.service.ListRoles(c.Request.Context(), params)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, res)
}

// GetRole handles GET /super-admin/roles/:id - get single role details with mapped permissions.
func (h *RoleHandler) GetRole(c *gin.Context) {
	roleIDStr := c.Param("id")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid role ID"))
		return
	}

	role, err := h.service.GetRole(c.Request.Context(), roleID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"role": role,
	})
}

// ListPermissions handles GET /super-admin/roles/permissions - list atomic permission catalog.
func (h *RoleHandler) ListPermissions(c *gin.Context) {
	scopeType := c.Query("scope_type")
	perms, err := h.service.ListPermissions(c.Request.Context(), scopeType)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"permissions": perms,
		"total":       len(perms),
	})
}

// CreateRole handles POST /super-admin/roles - create custom role.
func (h *RoleHandler) CreateRole(c *gin.Context) {
	var req models.CreateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body: role_code, role_name, and scope (COLLEGE or PLATFORM) are required"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	role, err := h.service.CreateCustomRole(ctx, req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"role":    role,
		"message": "Custom role created successfully",
	})
}

// CloneRole handles POST /super-admin/roles/:id/clone - clone role.
func (h *RoleHandler) CloneRole(c *gin.Context) {
	roleIDStr := c.Param("id")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid role ID"))
		return
	}

	var req models.CloneRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body: new_role_code and new_role_name are required"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	cloned, err := h.service.CloneRole(ctx, roleID, req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"role":    cloned,
		"message": "Role cloned successfully",
	})
}

// UpdateRole handles PUT /super-admin/roles/:id and PATCH /super-admin/roles/:id - update custom role metadata.
func (h *RoleHandler) UpdateRole(c *gin.Context) {
	roleIDStr := c.Param("id")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid role ID"))
		return
	}

	var req models.UpdateRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body: role_name is required"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	updated, err := h.service.UpdateCustomRole(ctx, roleID, req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"role":    updated,
		"message": "Role metadata updated successfully",
	})
}

// UpdateRolePermissions handles PUT /super-admin/roles/:id/permissions - synchronize mapped permissions.
func (h *RoleHandler) UpdateRolePermissions(c *gin.Context) {
	roleIDStr := c.Param("id")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid role ID"))
		return
	}

	var req models.UpdateRolePermissionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body: permission_ids and reason are required"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	detail, err := h.service.UpdateRolePermissions(ctx, roleID, req)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"role":    detail,
		"message": "Role permissions updated successfully",
	})
}

// DeleteRole handles DELETE /super-admin/roles/:id - delete an unused custom role.
func (h *RoleHandler) DeleteRole(c *gin.Context) {
	roleIDStr := c.Param("id")
	roleID, err := uuid.Parse(roleIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid role ID"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)
	ctx = context.WithValue(ctx, services.ActorRoleContextKey, actorRole)

	if err := h.service.DeleteCustomRole(ctx, roleID); err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"role_id": roleID,
		"message": "Custom role deleted successfully",
	})
}

// ListRoleTemplates handles GET /super-admin/roles/templates - returns template advisory status.
func (h *RoleHandler) ListRoleTemplates(c *gin.Context) {
	res, err := h.service.ListRoleTemplates(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, res)
}
