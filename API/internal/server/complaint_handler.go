package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

type ComplaintHandler struct {
	service *service.ComplaintService
}

func NewComplaintHandler(service *service.ComplaintService) *ComplaintHandler {
	return &ComplaintHandler{service: service}
}

func writeComplaintError(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": msg}})
}

func (h *ComplaintHandler) CreateComplaint(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeComplaintError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeComplaintError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	var req service.CreateComplaintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeComplaintError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	record, err := h.service.CreateComplaint(c.Request.Context(), collegeID, userID, req)
	if err != nil {
		if err == service.ErrInvalidComplaintCategory || err == service.ErrInvalidComplaintPriority {
			writeComplaintError(c, http.StatusBadRequest, err.Error())
			return
		}
		writeComplaintError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, record)
}

func (h *ComplaintHandler) GetComplaint(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeComplaintError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	id, err := uuid.Parse(c.Param("complaint_id"))
	if err != nil {
		writeComplaintError(c, http.StatusBadRequest, "invalid complaint id")
		return
	}

	record, err := h.service.GetComplaint(c.Request.Context(), collegeID, id)
	if err != nil {
		writeComplaintError(c, http.StatusNotFound, "complaint not found")
		return
	}

	response.OK(c, record)
}

func (h *ComplaintHandler) ListComplaints(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeComplaintError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	records, err := h.service.ListComplaints(c.Request.Context(), collegeID)
	if err != nil {
		writeComplaintError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, records)
}

func (h *ComplaintHandler) UpdateComplaintStatus(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeComplaintError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeComplaintError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	id, err := uuid.Parse(c.Param("complaint_id"))
	if err != nil {
		writeComplaintError(c, http.StatusBadRequest, "invalid complaint id")
		return
	}

	var req service.UpdateComplaintStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeComplaintError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	err = h.service.UpdateComplaintStatus(c.Request.Context(), collegeID, id, userID, req)
	if err != nil {
		if err == service.ErrInvalidComplaintStatus {
			writeComplaintError(c, http.StatusBadRequest, err.Error())
			return
		}
		writeComplaintError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "status updated"})
}

func (h *ComplaintHandler) AssignComplaint(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeComplaintError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeComplaintError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	id, err := uuid.Parse(c.Param("complaint_id"))
	if err != nil {
		writeComplaintError(c, http.StatusBadRequest, "invalid complaint id")
		return
	}

	var req service.AssignComplaintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeComplaintError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	err = h.service.AssignComplaint(c.Request.Context(), collegeID, id, userID, req)
	if err != nil {
		writeComplaintError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "complaint assigned"})
}

func (h *ComplaintHandler) ResolveComplaint(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeComplaintError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeComplaintError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	id, err := uuid.Parse(c.Param("complaint_id"))
	if err != nil {
		writeComplaintError(c, http.StatusBadRequest, "invalid complaint id")
		return
	}

	var req service.ResolveComplaintRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeComplaintError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	err = h.service.ResolveComplaint(c.Request.Context(), collegeID, id, userID, req)
	if err != nil {
		writeComplaintError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "complaint resolved"})
}

func (h *ComplaintHandler) GetComplaintSummary(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeComplaintError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	records, err := h.service.GetComplaintSummary(c.Request.Context(), collegeID)
	if err != nil {
		writeComplaintError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, records)
}

func (h *ComplaintHandler) ListComplaintUpdates(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeComplaintError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	id, err := uuid.Parse(c.Param("complaint_id"))
	if err != nil {
		writeComplaintError(c, http.StatusBadRequest, "invalid complaint id")
		return
	}

	records, err := h.service.ListComplaintUpdates(c.Request.Context(), collegeID, id)
	if err != nil {
		writeComplaintError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, records)
}
