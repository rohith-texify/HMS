package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

type MaintenanceHandler struct {
	service *service.MaintenanceService
}

func NewMaintenanceHandler(service *service.MaintenanceService) *MaintenanceHandler {
	return &MaintenanceHandler{service: service}
}

func writeMaintenanceError(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": msg}})
}

func (h *MaintenanceHandler) CreateMaintenance(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeMaintenanceError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeMaintenanceError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	var req service.CreateMaintenanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeMaintenanceError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	record, err := h.service.CreateMaintenance(c.Request.Context(), collegeID, userID, req)
	if err != nil {
		if err == service.ErrInvalidMaintenanceType || err == service.ErrMaintenanceDatesInvalid {
			writeMaintenanceError(c, http.StatusBadRequest, err.Error())
			return
		}
		writeMaintenanceError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, record)
}

func (h *MaintenanceHandler) GetMaintenance(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeMaintenanceError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	id, err := uuid.Parse(c.Param("maintenance_id"))
	if err != nil {
		writeMaintenanceError(c, http.StatusBadRequest, "invalid maintenance id")
		return
	}

	record, err := h.service.GetMaintenance(c.Request.Context(), collegeID, id)
	if err != nil {
		writeMaintenanceError(c, http.StatusNotFound, "maintenance not found")
		return
	}

	response.OK(c, record)
}

func (h *MaintenanceHandler) ListMaintenance(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeMaintenanceError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	records, err := h.service.ListMaintenance(c.Request.Context(), collegeID)
	if err != nil {
		writeMaintenanceError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, records)
}

func (h *MaintenanceHandler) ResolveMaintenance(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeMaintenanceError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeMaintenanceError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	id, err := uuid.Parse(c.Param("maintenance_id"))
	if err != nil {
		writeMaintenanceError(c, http.StatusBadRequest, "invalid maintenance id")
		return
	}

	var req service.ResolveMaintenanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeMaintenanceError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	err = h.service.ResolveMaintenance(c.Request.Context(), collegeID, id, userID, req)
	if err != nil {
		if err == service.ErrInvalidMaintenanceStatus {
			writeMaintenanceError(c, http.StatusBadRequest, err.Error())
			return
		}
		writeMaintenanceError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "maintenance resolved"})
}
