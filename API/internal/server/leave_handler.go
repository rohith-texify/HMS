package server

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

type LeaveHandler struct {
	service *service.LeaveService
}

func NewLeaveHandler(service *service.LeaveService) *LeaveHandler {
	return &LeaveHandler{service: service}
}

func writeLeaveError(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": msg}})
}

func (h *LeaveHandler) CreateLeaveRequest(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeLeaveError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeLeaveError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	var req service.CreateLeaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeLeaveError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	record, err := h.service.CreateLeaveRequest(c.Request.Context(), collegeID, userID, req)
	if err != nil {
		if err == service.ErrInvalidLeaveType || err == service.ErrInvalidDateRange || err == service.ErrOverlappingLeave {
			writeLeaveError(c, http.StatusBadRequest, err.Error())
			return
		}
		writeLeaveError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, record)
}

func (h *LeaveHandler) GetLeaveRequest(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeLeaveError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	id, err := uuid.Parse(c.Param("leave_id"))
	if err != nil {
		writeLeaveError(c, http.StatusBadRequest, "invalid leave id")
		return
	}

	record, err := h.service.GetLeaveRequest(c.Request.Context(), collegeID, id)
	if err != nil {
		if err == repository.ErrLeaveNotFound {
			writeLeaveError(c, http.StatusNotFound, "leave request not found")
			return
		}
		writeLeaveError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, record)
}

func (h *LeaveHandler) ListLeaveRequests(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeLeaveError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	params := repository.ListLeaveParams{
		CollegeID: collegeID,
	}

	if sid := c.Query("student_id"); sid != "" {
		if id, err := uuid.Parse(sid); err == nil {
			params.StudentID = &id
		}
	}
	if st := c.Query("status"); st != "" {
		status := repository.LeaveStatus(st)
		params.Status = &status
	}
	if sd := c.Query("start_date"); sd != "" {
		if t, err := time.Parse(time.RFC3339, sd); err == nil {
			params.StartDate = &t
		}
	}
	if ed := c.Query("end_date"); ed != "" {
		if t, err := time.Parse(time.RFC3339, ed); err == nil {
			params.EndDate = &t
		}
	}

	records, err := h.service.ListLeaveRequests(c.Request.Context(), params)
	if err != nil {
		writeLeaveError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, records)
}

func (h *LeaveHandler) ProcessDecision(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeLeaveError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeLeaveError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	leaveID, err := uuid.Parse(c.Param("leave_id"))
	if err != nil {
		writeLeaveError(c, http.StatusBadRequest, "invalid leave id")
		return
	}

	var req service.LeaveDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeLeaveError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	err = h.service.ProcessLeaveDecision(c.Request.Context(), collegeID, leaveID, userID, req)
	if err != nil {
		if err == repository.ErrLeaveNotFound {
			writeLeaveError(c, http.StatusNotFound, "leave request not found")
			return
		}
		if err == service.ErrLeaveNotApprovable || err == service.ErrInvalidTransition {
			writeLeaveError(c, http.StatusConflict, err.Error())
			return
		}
		writeLeaveError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "leave decision processed"})
}

func (h *LeaveHandler) CancelLeaveRequest(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeLeaveError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeLeaveError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	leaveID, err := uuid.Parse(c.Param("leave_id"))
	if err != nil {
		writeLeaveError(c, http.StatusBadRequest, "invalid leave id")
		return
	}

	err = h.service.CancelLeaveRequest(c.Request.Context(), collegeID, leaveID, userID)
	if err != nil {
		if err == repository.ErrLeaveNotFound {
			writeLeaveError(c, http.StatusNotFound, "leave request not found")
			return
		}
		if err == service.ErrInvalidTransition {
			writeLeaveError(c, http.StatusConflict, err.Error())
			return
		}
		writeLeaveError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "leave request cancelled"})
}

func (h *LeaveHandler) GetLeaveSummary(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeLeaveError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	summary, err := h.service.GetLeaveSummary(c.Request.Context(), collegeID)
	if err != nil {
		writeLeaveError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, summary)
}
