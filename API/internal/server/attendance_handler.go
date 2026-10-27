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

type AttendanceHandler struct {
	service *service.AttendanceService
}

func NewAttendanceHandler(service *service.AttendanceService) *AttendanceHandler {
	return &AttendanceHandler{service: service}
}

func writeAttendanceError(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": msg}})
}

func (h *AttendanceHandler) MarkStudentAttendance(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeAttendanceError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeAttendanceError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	var req service.MarkAttendanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeAttendanceError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	record, err := h.service.MarkStudentAttendance(c.Request.Context(), collegeID, userID, req)
	if err != nil {
		if err == service.ErrDuplicateAttendance || err == service.ErrInvalidStatus || err == service.ErrInvalidScanMethod {
			writeAttendanceError(c, http.StatusBadRequest, err.Error())
			return
		}
		writeAttendanceError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, record)
}

func (h *AttendanceHandler) BulkMarkStudentAttendance(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeAttendanceError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeAttendanceError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	var req service.BulkMarkAttendanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeAttendanceError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	err := h.service.BulkMarkStudentAttendance(c.Request.Context(), collegeID, userID, req)
	if err != nil {
		writeAttendanceError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "bulk attendance recorded successfully"})
}

func (h *AttendanceHandler) GetStudentAttendance(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeAttendanceError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	id, err := uuid.Parse(c.Param("record_id"))
	if err != nil {
		writeAttendanceError(c, http.StatusBadRequest, "invalid record id")
		return
	}

	record, err := h.service.GetStudentAttendance(c.Request.Context(), collegeID, id)
	if err != nil {
		if err == repository.ErrAttendanceNotFound {
			writeAttendanceError(c, http.StatusNotFound, "attendance record not found")
			return
		}
		writeAttendanceError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, record)
}

func (h *AttendanceHandler) ListStudentAttendance(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeAttendanceError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	params := repository.ListAttendanceParams{
		CollegeID: collegeID,
	}

	if sid := c.Query("student_id"); sid != "" {
		if id, err := uuid.Parse(sid); err == nil {
			params.StudentID = &id
		}
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
	if st := c.Query("status"); st != "" {
		params.Status = &st
	}

	records, err := h.service.ListStudentAttendance(c.Request.Context(), params)
	if err != nil {
		writeAttendanceError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, records)
}

func (h *AttendanceHandler) GetAttendanceSummary(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeAttendanceError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	var startDate, endDate time.Time
	var err error
	if sd := c.Query("start_date"); sd != "" {
		if startDate, err = time.Parse(time.RFC3339, sd); err != nil {
			writeAttendanceError(c, http.StatusBadRequest, "invalid start_date")
			return
		}
	} else {
		startDate = time.Now().AddDate(0, -1, 0) // default 1 month
	}
	if ed := c.Query("end_date"); ed != "" {
		if endDate, err = time.Parse(time.RFC3339, ed); err != nil {
			writeAttendanceError(c, http.StatusBadRequest, "invalid end_date")
			return
		}
	} else {
		endDate = time.Now()
	}

	summary, err := h.service.GetAttendanceSummary(c.Request.Context(), collegeID, startDate, endDate)
	if err != nil {
		writeAttendanceError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, summary)
}

func (h *AttendanceHandler) SubmitAttendanceCorrection(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeAttendanceError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeAttendanceError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	var req service.CorrectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeAttendanceError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	corr, err := h.service.SubmitAttendanceCorrection(c.Request.Context(), collegeID, userID, req)
	if err != nil {
		if err == service.ErrInvalidStatus {
			writeAttendanceError(c, http.StatusBadRequest, err.Error())
			return
		}
		if err == repository.ErrAttendanceNotFound {
			writeAttendanceError(c, http.StatusNotFound, "attendance record not found")
			return
		}
		writeAttendanceError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, corr)
}

func (h *AttendanceHandler) ApproveAttendanceCorrection(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeAttendanceError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeAttendanceError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	correctionID, err := uuid.Parse(c.Param("correction_id"))
	if err != nil {
		writeAttendanceError(c, http.StatusBadRequest, "invalid correction id")
		return
	}

	var req service.CorrectionDecisionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeAttendanceError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	corr, err := h.service.ApproveAttendanceCorrection(c.Request.Context(), collegeID, correctionID, userID, req)
	if err != nil {
		if err == repository.ErrCorrectionNotFound || err == repository.ErrAttendanceNotFound {
			writeAttendanceError(c, http.StatusNotFound, "record not found")
			return
		}
		if err.Error() == "correction is not pending" {
			writeAttendanceError(c, http.StatusConflict, err.Error())
			return
		}
		writeAttendanceError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, corr)
}
