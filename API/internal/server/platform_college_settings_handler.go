package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type PlatformCollegeSettingsHandler struct {
	service *service.PlatformCollegeSettingsService
}

func NewPlatformCollegeSettingsHandler(
	service *service.PlatformCollegeSettingsService,
) *PlatformCollegeSettingsHandler {
	return &PlatformCollegeSettingsHandler{
		service: service,
	}
}

type updateCollegeSettingRequest struct {
	Value string `json:"value"`
}

func (h *PlatformCollegeSettingsHandler) ListSettings(c *gin.Context) {
	collegeID, err := uuid.Parse(c.Param("college_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "INVALID_COLLEGE_ID",
			"message": "invalid college_id",
		})
		return
	}

	settings, err := h.service.ListSettings(c.Request.Context(), collegeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "COLLEGE_SETTINGS_LIST_FAILED",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    settings,
	})
}

func (h *PlatformCollegeSettingsHandler) UpdateSetting(c *gin.Context) {
	collegeID, err := uuid.Parse(c.Param("college_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "INVALID_COLLEGE_ID",
			"message": "invalid college_id",
		})
		return
	}

	key := strings.TrimSpace(c.Param("key"))

	if key == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "INVALID_SETTING_KEY",
			"message": "setting key is required",
		})
		return
	}

	var req updateCollegeSettingRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "INVALID_REQUEST_BODY",
			"message": "invalid request body",
		})
		return
	}

	value := strings.TrimSpace(req.Value)

	if value == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error":   "INVALID_SETTING_VALUE",
			"message": "setting value is required",
		})
		return
	}

	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "UNAUTHORIZED",
			"message": "authenticated user not found",
		})
		return
	}

	userID, ok := userIDValue.(uuid.UUID)
	if !ok || userID == uuid.Nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error":   "INVALID_USER_CONTEXT",
			"message": "invalid authenticated user context",
		})
		return
	}

	setting, err := h.service.UpdateSetting(
		c.Request.Context(),
		collegeID,
		key,
		value,
		userID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error":   "COLLEGE_SETTING_UPDATE_FAILED",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    setting,
	})
}
