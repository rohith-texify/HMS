package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/database"
	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// isPrivilegedRole checks if a role has platform administrative privileges.
func isPrivilegedRole(role string) bool {
	return validators.IsPrivilegedRole(role)
}

// SettingsHandler handles HTTP requests for college settings management.
type SettingsHandler struct {
	service *services.SettingsService
}

// NewSettingsHandler creates a new settings handler.
func NewSettingsHandler(service *services.SettingsService) *SettingsHandler {
	return &SettingsHandler{
		service: service,
	}
}

// ListCollegeSettings handles GET /colleges/:id/settings - list effective configuration for a college.
func (h *SettingsHandler) ListCollegeSettings(c *gin.Context) {
	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	includeSensitive := c.Query("include_sensitive") == "true"
	if includeSensitive {
		_, actorRole, err := getAuthenticatedActor(c)
		if err != nil {
			respondError(c, err)
			return
		}
		if !isPrivilegedRole(actorRole) {
			respondError(c, apierrors.New(
				apierrors.Forbidden,
				"unauthorized to view sensitive college settings",
			))
			return
		}
	}

	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	params := models.ListCollegeSettingsParams{
		Category:         c.Query("category"),
		IncludeSensitive: includeSensitive,
		Limit:            limit,
		Offset:           offset,
	}

	settings, total, err := h.service.GetEffectiveCollegeSettings(c.Request.Context(), collegeID, params)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"settings": settings,
		"total":    total,
		"limit":    limit,
		"offset":   offset,
	})
}

// GetCollegeSetting handles GET /colleges/:id/settings/:key - retrieve a specific setting.
func (h *SettingsHandler) GetCollegeSetting(c *gin.Context) {
	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	settingKey, err := validators.ValidateSettingKey(c.Param("key"))
	if err != nil {
		respondError(c, err)
		return
	}

	includeSensitive := c.Query("include_sensitive") == "true"
	if includeSensitive {
		_, actorRole, err := getAuthenticatedActor(c)
		if err != nil {
			respondError(c, err)
			return
		}
		if !isPrivilegedRole(actorRole) {
			respondError(c, apierrors.New(
				apierrors.Forbidden,
				"unauthorized to view sensitive college setting",
			))
			return
		}
	}

	setting, err := h.service.GetEffectiveCollegeSetting(c.Request.Context(), collegeID, settingKey, includeSensitive)
	if err != nil {
		respondError(c, err)
		return
	}

	if setting.IsSensitive && !includeSensitive {
		_, actorRole, err := getAuthenticatedActor(c)
		if err != nil {
			respondError(c, err)
			return
		}
		if !isPrivilegedRole(actorRole) {
			respondError(c, apierrors.New(
				apierrors.Forbidden,
				"unauthorized to view sensitive college setting",
			))
			return
		}
	}

	response.OK(c, map[string]interface{}{
		"setting": setting,
	})
}

// UpdateCollegeSetting handles PUT /colleges/:id/settings/:key - update a college setting.
func (h *SettingsHandler) UpdateCollegeSetting(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	if !isPrivilegedRole(actorRole) {
		respondError(c, apierrors.New(
			apierrors.Forbidden,
			"unauthorized to update college settings",
		))
		return
	}

	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	settingKey, err := validators.ValidateSettingKey(c.Param("key"))
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.UpdateCollegeSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body"))
		return
	}

	if err := validators.ValidateUpdateCollegeSettingRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	// Validate typed values, ownership boundaries, and security floors
	if err := validators.ValidateSettingValue(settingKey, req.SettingValue); err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)

	setting, err := h.service.UpdateCollegeSetting(ctx, collegeID, settingKey, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"setting": setting,
	})
}

// ResetCollegeSetting handles POST /colleges/:id/settings/:key/reset - reset an override to default.
func (h *SettingsHandler) ResetCollegeSetting(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	if !isPrivilegedRole(actorRole) {
		respondError(c, apierrors.New(
			apierrors.Forbidden,
			"unauthorized to reset college settings",
		))
		return
	}

	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	settingKey, err := validators.ValidatePlatformSettingKey(c.Param("key"))
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.ResetCollegeSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body. Reason is required"))
		return
	}

	if err := validators.ValidateResetCollegeSettingRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)

	effective, err := h.service.ResetCollegeSetting(ctx, collegeID, settingKey, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message": "Setting reset to default successfully",
		"setting": effective,
	})
}

// CompareCollegeSettings handles GET /colleges/:id/settings/compare - compare settings with global defaults.
func (h *SettingsHandler) CompareCollegeSettings(c *gin.Context) {
	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	includeSensitive := c.Query("include_sensitive") == "true"
	if includeSensitive {
		_, actorRole, err := getAuthenticatedActor(c)
		if err != nil {
			respondError(c, err)
			return
		}
		if !isPrivilegedRole(actorRole) {
			respondError(c, apierrors.New(
				apierrors.Forbidden,
				"unauthorized to view sensitive settings comparison",
			))
			return
		}
	}

	comparisons, err := h.service.CompareCollegeSettings(c.Request.Context(), collegeID, includeSensitive)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"comparisons": comparisons,
	})
}

// ListCollegeSettingsHistory handles GET /colleges/:id/settings/history - retrieve setting audit history.
func (h *SettingsHandler) ListCollegeSettingsHistory(c *gin.Context) {
	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	settingKey := c.Query("key")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	history, total, err := h.service.ListCollegeSettingsHistory(c.Request.Context(), collegeID, settingKey, limit, offset)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"history": history,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	})
}

// RevertCollegeSetting handles POST /colleges/:id/settings/:key/revert - revert setting to historical version.
func (h *SettingsHandler) RevertCollegeSetting(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	if !isPrivilegedRole(actorRole) {
		respondError(c, apierrors.New(
			apierrors.Forbidden,
			"unauthorized to revert college settings",
		))
		return
	}

	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	settingKey, err := validators.ValidatePlatformSettingKey(c.Param("key"))
	if err != nil {
		respondError(c, err)
		return
	}

	var req models.RevertCollegeSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, validators.NewValidationError("Invalid request body. Audit ID and reason are required"))
		return
	}

	if err := validators.ValidateRevertCollegeSettingRequest(&req); err != nil {
		respondError(c, err)
		return
	}

	ctx := database.WithPlatformUserID(c.Request.Context(), actorID)

	reverted, err := h.service.RevertCollegeSetting(ctx, collegeID, settingKey, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, map[string]interface{}{
		"message": "Setting reverted successfully",
		"setting": reverted,
	})
}

// ListSettingDefinitions handles GET /colleges/:id/settings/definitions - retrieve configuration definitions.
func (h *SettingsHandler) ListSettingDefinitions(c *gin.Context) {
	definitions := h.service.ListSettingDefinitions()
	response.OK(c, map[string]interface{}{
		"definitions": definitions,
	})
}

