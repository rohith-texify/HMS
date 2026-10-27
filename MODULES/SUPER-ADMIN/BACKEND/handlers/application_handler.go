package handlers

import (
	"strconv"

	"github.com/gin-gonic/gin"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// ApplicationHandler handles HTTP requests for application management.
type ApplicationHandler struct {
	service *services.ApplicationService
}

// NewApplicationHandler creates a new application handler.
func NewApplicationHandler(service *services.ApplicationService) *ApplicationHandler {
	return &ApplicationHandler{
		service: service,
	}
}

// GetCatalogue handles GET /super-admin/applications/catalogue - returns platform catalogue.
func (h *ApplicationHandler) GetCatalogue(c *gin.Context) {
	catalogue := h.service.GetCatalogue(c.Request.Context())
	response.OK(c, catalogue)
}

// ListCollegeApplications handles GET /super-admin/colleges/:id/applications - returns 5 app configs for college.
func (h *ApplicationHandler) ListCollegeApplications(c *gin.Context) {
	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	apps, err := h.service.ListCollegeApplications(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, apps)
}

// GetCollegeApplication handles GET /super-admin/colleges/:id/applications/:app_id.
func (h *ApplicationHandler) GetCollegeApplication(c *gin.Context) {
	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	appID := c.Param("app_id")
	if appID == "" {
		respondError(c, apierrors.New(apierrors.ValidationError, "Application identifier is required"))
		return
	}

	cfg, err := h.service.GetCollegeApplication(c.Request.Context(), collegeID, appID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, cfg)
}

// EnableApplication handles POST /super-admin/colleges/:id/applications/:app_id/enable.
func (h *ApplicationHandler) EnableApplication(c *gin.Context) {
	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	appID := c.Param("app_id")
	if appID == "" {
		respondError(c, apierrors.New(apierrors.ValidationError, "Application identifier is required"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req struct {
		Reason *string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)

	updated, err := h.service.EnableApplication(c.Request.Context(), collegeID, appID, actorID, actorRole, req.Reason)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, updated)
}

// DisableApplication handles POST /super-admin/colleges/:id/applications/:app_id/disable.
func (h *ApplicationHandler) DisableApplication(c *gin.Context) {
	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	appID := c.Param("app_id")
	if appID == "" {
		respondError(c, apierrors.New(apierrors.ValidationError, "Application identifier is required"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req struct {
		Reason *string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)

	updated, err := h.service.DisableApplication(c.Request.Context(), collegeID, appID, actorID, actorRole, req.Reason)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, updated)
}

// SuspendApplication handles POST /super-admin/colleges/:id/applications/:app_id/suspend.
func (h *ApplicationHandler) SuspendApplication(c *gin.Context) {
	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	appID := c.Param("app_id")
	if appID == "" {
		respondError(c, apierrors.New(apierrors.ValidationError, "Application identifier is required"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	var req struct {
		Reason *string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)

	updated, err := h.service.SuspendApplication(c.Request.Context(), collegeID, appID, actorID, actorRole, req.Reason)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, updated)
}

// UpdateVersion handles PUT /super-admin/colleges/:id/applications/:app_id/version.
func (h *ApplicationHandler) UpdateVersion(c *gin.Context) {
	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	appID := c.Param("app_id")
	if appID == "" {
		respondError(c, apierrors.New(apierrors.ValidationError, "Application identifier is required"))
		return
	}

	var req models.UpdateAppVersionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, apierrors.New(apierrors.ValidationError, "Invalid request payload: min_version is required"))
		return
	}

	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		respondError(c, err)
		return
	}

	updated, err := h.service.UpdateVersion(c.Request.Context(), collegeID, appID, req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, updated)
}

// GetApplicationHistory handles GET /super-admin/colleges/:id/applications/:app_id/history.
func (h *ApplicationHandler) GetApplicationHistory(c *gin.Context) {
	collegeID, err := validators.ValidateCollegeID(c.Param("id"))
	if err != nil {
		respondError(c, err)
		return
	}

	appID := c.Param("app_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	history, meta, err := h.service.GetApplicationHistory(c.Request.Context(), collegeID, appID, limit, offset)
	if err != nil {
		respondError(c, err)
		return
	}

	response.WithMeta(c, 200, history, meta)
}
