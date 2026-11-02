package handlers

import (
	"time"

	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

// ListStudentAttendance handles GET /admin/attendance.
func (h *AttendanceHandler) ListStudentAttendance(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	dateStr := c.Query("date")
	targetDate := time.Now().UTC()
	if dateStr != "" {
		if parsed, err := time.Parse("2006-01-02", dateStr); err == nil {
			targetDate = parsed
		}
	}

	attendance, err := h.svc.ListStudentAttendance(c.Request.Context(), collegeID, targetDate)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{
		"date":       targetDate.Format("2006-01-02"),
		"attendance": attendance,
	})
}

// GetAttendanceSummary handles GET /admin/attendance/summary.
func (h *AttendanceHandler) GetAttendanceSummary(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	dateStr := c.Query("date")
	targetDate := time.Now().UTC()
	if dateStr != "" {
		if parsed, err := time.Parse("2006-01-02", dateStr); err == nil {
			targetDate = parsed
		}
	}

	summary, err := h.svc.GetAttendanceSummary(c.Request.Context(), collegeID, targetDate)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, summary)
}

