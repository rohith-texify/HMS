package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// PermissionHandler handles HTTP requests for permission catalog, orphan detection,
// access mapping (who-has-what), and deprecation advisories.
type PermissionHandler struct {
	service     *services.PermissionService
	roleService *services.RoleService
}

// NewPermissionHandler creates a new PermissionHandler instance.
func NewPermissionHandler(
	service *services.PermissionService,
	roleService *services.RoleService,
) *PermissionHandler {
	return &PermissionHandler{
		service:     service,
		roleService: roleService,
	}
}

// ListPermissions handles GET /super-admin/permissions - list permissions with filters and role mapping stats.
func (h *PermissionHandler) ListPermissions(c *gin.Context) {
	var filter models.ListPermissionsFilter
	if err := c.ShouldBindQuery(&filter); err != nil {
		respondError(c, validators.NewValidationError("Invalid query parameters"))
		return
	}

	res, err := h.service.ListPermissions(c.Request.Context(), filter)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, res)
}

// GetPermission handles GET /super-admin/permissions/:id - get single permission details and mapped roles.
func (h *PermissionHandler) GetPermission(c *gin.Context) {
	permIDStr := c.Param("id")
	permID, err := uuid.Parse(permIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid permission ID format"))
		return
	}

	detail, err := h.service.GetPermissionDetail(c.Request.Context(), permID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"permission": detail,
	})
}

// GetPermissionWhoHasWhat handles GET /super-admin/permissions/:id/who-has-what - who has what access view.
func (h *PermissionHandler) GetPermissionWhoHasWhat(c *gin.Context) {
	permIDStr := c.Param("id")
	permID, err := uuid.Parse(permIDStr)
	if err != nil {
		respondError(c, validators.NewValidationError("Invalid permission ID format"))
		return
	}

	res, err := h.service.GetWhoHasWhat(c.Request.Context(), permID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, res)
}

// ListOrphanPermissions handles GET /super-admin/permissions/orphans - list unmapped permissions report.
func (h *PermissionHandler) ListOrphanPermissions(c *gin.Context) {
	report, err := h.service.ListOrphanPermissions(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, report)
}

// GetDeprecationStatus handles GET /super-admin/permissions/deprecation-status - deprecation lifecycle advisory.
func (h *PermissionHandler) GetDeprecationStatus(c *gin.Context) {
	status, err := h.service.GetDeprecationStatus(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, status)
}
