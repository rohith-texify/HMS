package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

// SystemSettingsHandler handles HTTP requests for company-wide platform settings.
type SystemSettingsHandler struct {
	service *services.SystemSettingsService
}

// NewSystemSettingsHandler creates a new SystemSettingsHandler.
func NewSystemSettingsHandler(service *services.SystemSettingsService) *SystemSettingsHandler {
	return &SystemSettingsHandler{
		service: service,
	}
}

// ListSettings handles GET /super-admin/system-settings - list global configurations.
func (h *SystemSettingsHandler) ListSettings(c *gin.Context) {
	category := c.Query("category")
	if h.service == nil {
		response.OK(c, map[string]interface{}{
			"settings": []models.SystemSetting{},
			"total":    0,
		})
		return
	}

	settings, err := h.service.ListSettings(c.Request.Context(), category)
	if err != nil {
		// Log and return empty slice with 200 to prevent breaking the frontend UI
		response.OK(c, map[string]interface{}{
			"settings": []models.SystemSetting{},
			"total":    0,
			"warning":  err.Error(),
		})
		return
	}

	response.OK(c, map[string]interface{}{
		"settings": settings,
		"total":    len(settings),
	})
}

// GetSetting handles GET /super-admin/system-settings/:key - retrieve single setting.
func (h *SystemSettingsHandler) GetSetting(c *gin.Context) {
	key := c.Param("key")
	setting, err := h.service.GetSetting(c.Request.Context(), key)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"setting": setting,
	})
}

// UpdateSetting handles PUT /super-admin/system-settings/:key - update platform setting.
func (h *SystemSettingsHandler) UpdateSetting(c *gin.Context) {
	key := c.Param("key")
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.UpdateSystemSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "Invalid request body. Setting value and reason are required"))
		return
	}

	updated, err := h.service.UpdateSetting(c.Request.Context(), key, req, &actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message": "Platform setting updated successfully",
		"setting": updated,
	})
}

// ResetSetting handles POST /super-admin/system-settings/:key/reset - reset to factory default.
func (h *SystemSettingsHandler) ResetSetting(c *gin.Context) {
	key := c.Param("key")
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&body)

	reset, err := h.service.ResetSetting(c.Request.Context(), key, body.Reason, &actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message": "Platform setting reset to default successfully",
		"setting": reset,
	})
}

// RevertSetting handles POST /super-admin/system-settings/:key/revert - roll back to a prior version.
func (h *SystemSettingsHandler) RevertSetting(c *gin.Context) {
	key := c.Param("key")
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.RevertSystemSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "Invalid request body. History ID and reason are required"))
		return
	}

	reverted, err := h.service.RevertSetting(c.Request.Context(), key, req, &actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message": "Platform setting reverted successfully",
		"setting": reverted,
	})
}

// ListHistory handles GET /super-admin/system-settings/history - audit logs.
func (h *SystemSettingsHandler) ListHistory(c *gin.Context) {
	key := c.Query("key")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	history, total, err := h.service.ListHistory(c.Request.Context(), key, limit, offset)
	if err != nil {
		response.OK(c, map[string]interface{}{
			"history": []models.SystemSettingHistory{},
			"total":   0,
			"limit":   limit,
			"offset":  offset,
		})
		return
	}

	response.OK(c, map[string]interface{}{
		"history": history,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// GetTenantInheritanceOverview handles GET /super-admin/system-settings/tenant-inheritance.
func (h *SystemSettingsHandler) GetTenantInheritanceOverview(c *gin.Context) {
	overview, err := h.service.GetTenantInheritanceOverview(c.Request.Context())
	if err != nil {
		response.OK(c, map[string]interface{}{
			"inheritance": []models.TenantSettingInheritanceOverview{},
			"total":       0,
		})
		return
	}

	response.OK(c, map[string]interface{}{
		"inheritance": overview,
		"total":       len(overview),
	})
}

// CheckMaintenanceStatus handles GET /super-admin/system-settings/maintenance - public/internal quick check.
func (h *SystemSettingsHandler) CheckMaintenanceStatus(c *gin.Context) {
	setting, err := h.service.GetSetting(c.Request.Context(), "maintenance_mode")
	if err != nil || setting == nil {
		response.OK(c, map[string]interface{}{
			"maintenance": map[string]interface{}{
				"enabled": false,
			},
		})
		return
	}

	response.OK(c, map[string]interface{}{
		"maintenance": setting.SettingValue,
	})
}
