package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

// NotificationHandler handles HTTP requests for platform announcements and communication.
type NotificationHandler struct {
	service *services.NotificationService
}

// NewNotificationHandler creates a new NotificationHandler instance.
func NewNotificationHandler(service *services.NotificationService) *NotificationHandler {
	return &NotificationHandler{
		service: service,
	}
}

// ListNotifications handles GET /super-admin/notifications.
func (h *NotificationHandler) ListNotifications(c *gin.Context) {
	var params models.NotificationFilterParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid filter parameters"})
		return
	}

	items, total, err := h.service.ListNotifications(c.Request.Context(), params)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  items,
		"total": total,
	})
}

// PreviewAudience handles POST /super-admin/notifications/preview-audience.
func (h *NotificationHandler) PreviewAudience(c *gin.Context) {
	var req struct {
		TargetType string   `json:"target_type" binding:"required"`
		CollegeIDs []string `json:"college_ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Target type is required"})
		return
	}

	preview, err := h.service.PreviewAudience(c.Request.Context(), req.TargetType, req.CollegeIDs)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": preview})
}

// CreateNotification handles POST /super-admin/notifications.
func (h *NotificationHandler) CreateNotification(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req models.CreatePlatformNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	notif, approval, err := h.service.CreateNotification(c.Request.Context(), req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"data":             notif,
		"approval_request": approval,
	})
}

// CancelNotification handles POST /super-admin/notifications/:id/cancel.
func (h *NotificationHandler) CancelNotification(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	idStr := c.Param("id")
	notifID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&body)
	if body.Reason == "" {
		body.Reason = "Cancelled by platform administrator"
	}

	if err := h.service.CancelNotification(c.Request.Context(), notifID, actorID, actorRole, body.Reason); err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Notification successfully cancelled"})
}

// MonitoringHandler handles HTTP requests for system health and telemetry monitoring.
type MonitoringHandler struct {
	service *services.MonitoringService
}

// NewMonitoringHandler creates a new MonitoringHandler instance.
func NewMonitoringHandler(service *services.MonitoringService) *MonitoringHandler {
	return &MonitoringHandler{
		service: service,
	}
}

// GetMetrics handles GET /super-admin/monitoring/metrics.
func (h *MonitoringHandler) GetMetrics(c *gin.Context) {
	metrics, err := h.service.GetMonitoringMetrics(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": metrics})
}

// SupportHandler handles HTTP diagnostic and support troubleshooting endpoints.
type SupportHandler struct {
	service *services.SupportService
}

// NewSupportHandler creates a new SupportHandler instance.
func NewSupportHandler(service *services.SupportService) *SupportHandler {
	return &SupportHandler{
		service: service,
	}
}

// ListGrants handles GET /super-admin/support/grants.
func (h *SupportHandler) ListGrants(c *gin.Context) {
	collegeIDStr := c.Query("college_id")
	var collegeID *uuid.UUID
	if collegeIDStr != "" {
		if id, err := uuid.Parse(collegeIDStr); err == nil {
			collegeID = &id
		}
	}
	activeOnly := c.Query("active_only") == "true"

	grants, err := h.service.ListSupportGrants(c.Request.Context(), collegeID, activeOnly)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": grants})
}

// CreateGrant handles POST /super-admin/support/grants.
func (h *SupportHandler) CreateGrant(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req models.CreateSupportGrantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	grant, err := h.service.CreateSupportGrant(c.Request.Context(), req, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusCreated, gin.H{"data": grant})
}

// RevokeGrant handles POST /super-admin/support/grants/:id/revoke.
func (h *SupportHandler) RevokeGrant(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	idStr := c.Param("id")
	grantID, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid grant ID"})
		return
	}

	var body struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&body)
	if body.Reason == "" {
		body.Reason = "Revoked by platform administrator"
	}

	if err := h.service.RevokeSupportGrant(c.Request.Context(), grantID, actorID, actorRole, body.Reason); err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Support grant successfully revoked"})
}

// DiagnoseEntitlement handles GET /super-admin/support/diagnose-entitlement.
func (h *SupportHandler) DiagnoseEntitlement(c *gin.Context) {
	collegeIDStr := c.Query("college_id")
	moduleCode := c.Query("module_code")
	if collegeIDStr == "" || moduleCode == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "college_id and module_code query parameters are required"})
		return
	}

	collegeID, err := uuid.Parse(collegeIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid college_id"})
		return
	}

	report, err := h.service.DiagnoseEntitlement(c.Request.Context(), collegeID, moduleCode)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": report})
}

// MaskedStudentLookup handles POST /super-admin/support/student-lookup.
func (h *SupportHandler) MaskedStudentLookup(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req struct {
		CollegeID       string `json:"college_id" binding:"required"`
		AdmissionNumber string `json:"admission_number" binding:"required"`
		Reason          string `json:"reason" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	collegeID, err := uuid.Parse(req.CollegeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid college_id"})
		return
	}

	res, err := h.service.MaskedStudentLookup(c.Request.Context(), collegeID, req.AdmissionNumber, actorID, actorRole, req.Reason)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}
