package server

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type ReportHandler struct {
	svc *service.ReportService
}

func NewReportHandler(svc *service.ReportService) *ReportHandler {
	return &ReportHandler{svc: svc}
}

func writeReportError(c *gin.Context, status int, err error) {
	c.JSON(status, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": err.Error()}})
}

func (h *ReportHandler) GetOverview(c *gin.Context) {
	ctx := c.Request.Context()
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeReportError(c, http.StatusUnauthorized, fmt.Errorf("tenant context is missing"))
		return
	}

	data, err := h.svc.GetDashboardOverview(ctx, collegeID)
	if err != nil {
		writeReportError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func (h *ReportHandler) GetStudents(c *gin.Context) {
	ctx := c.Request.Context()
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeReportError(c, http.StatusUnauthorized, fmt.Errorf("tenant context is missing"))
		return
	}

	data, err := h.svc.GetStudentStats(ctx, collegeID)
	if err != nil {
		writeReportError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func (h *ReportHandler) GetOccupancy(c *gin.Context) {
	ctx := c.Request.Context()
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeReportError(c, http.StatusUnauthorized, fmt.Errorf("tenant context is missing"))
		return
	}

	data, err := h.svc.GetHostelOccupancy(ctx, collegeID)
	if err != nil {
		writeReportError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func (h *ReportHandler) GetAllocations(c *gin.Context) {
	ctx := c.Request.Context()
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeReportError(c, http.StatusUnauthorized, fmt.Errorf("tenant context is missing"))
		return
	}

	data, err := h.svc.GetAllocationStats(ctx, collegeID)
	if err != nil {
		writeReportError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func (h *ReportHandler) GetAttendance(c *gin.Context) {
	ctx := c.Request.Context()
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeReportError(c, http.StatusUnauthorized, fmt.Errorf("tenant context is missing"))
		return
	}

	data, err := h.svc.GetAttendanceStats(ctx, collegeID)
	if err != nil {
		writeReportError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func (h *ReportHandler) GetLeave(c *gin.Context) {
	ctx := c.Request.Context()
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeReportError(c, http.StatusUnauthorized, fmt.Errorf("tenant context is missing"))
		return
	}

	data, err := h.svc.GetLeaveStats(ctx, collegeID)
	if err != nil {
		writeReportError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func (h *ReportHandler) GetComplaints(c *gin.Context) {
	ctx := c.Request.Context()
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeReportError(c, http.StatusUnauthorized, fmt.Errorf("tenant context is missing"))
		return
	}

	data, err := h.svc.GetComplaintStats(ctx, collegeID)
	if err != nil {
		writeReportError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func (h *ReportHandler) GetMaintenance(c *gin.Context) {
	ctx := c.Request.Context()
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeReportError(c, http.StatusUnauthorized, fmt.Errorf("tenant context is missing"))
		return
	}

	data, err := h.svc.GetMaintenanceStats(ctx, collegeID)
	if err != nil {
		writeReportError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func (h *ReportHandler) GetStaff(c *gin.Context) {
	ctx := c.Request.Context()
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeReportError(c, http.StatusUnauthorized, fmt.Errorf("tenant context is missing"))
		return
	}

	data, err := h.svc.GetStaffStats(ctx, collegeID)
	if err != nil {
		writeReportError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func (h *ReportHandler) GetPlatformOverview(c *gin.Context) {
	ctx := c.Request.Context()

	// Ensure this is accessed only by platform users.
	scope, _ := c.Get(auth.ContextScopeKey)
	if scope != "PLATFORM" {
		writeReportError(c, http.StatusForbidden, fmt.Errorf("forbidden: platform scope required"))
		return
	}

	data, err := h.svc.GetPlatformOverview(ctx)
	if err != nil {
		writeReportError(c, http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": data})
}

func (h *ReportHandler) GetPlatformActivity(c *gin.Context) {
	scope, exists := c.Get(auth.ContextScopeKey)
	if !exists || scope != "PLATFORM" {
		writeReportError(
			c,
			http.StatusForbidden,
			fmt.Errorf("platform scope required"),
		)
		return
	}

	limit := 10
	if rawLimit := c.Query("limit"); rawLimit != "" {
		parsed, err := strconv.Atoi(rawLimit)
		if err != nil || parsed < 1 || parsed > 50 {
			writeReportError(
				c,
				http.StatusBadRequest,
				fmt.Errorf("limit must be an integer between 1 and 50"),
			)
			return
		}
		limit = parsed
	}

	data, err := h.svc.GetRecentPlatformActivity(
		c.Request.Context(),
		limit,
	)
	if err != nil {
		// Avoid returning internal database details to the client.
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INTERNAL_ERROR",
				"message": "failed to retrieve platform activity",
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    data,
	})
}
