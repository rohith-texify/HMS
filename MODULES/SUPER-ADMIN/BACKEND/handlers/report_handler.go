package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
)

// ReportHandler exposes HTTP endpoints for Module 20 Reports and Analytics.
type ReportHandler struct {
	service *services.SuperAdminReportService
}

// NewReportHandler creates a new ReportHandler instance.
func NewReportHandler(service *services.SuperAdminReportService) *ReportHandler {
	return &ReportHandler{
		service: service,
	}
}

// GetSummary handles GET /super-admin/reports/summary.
func (h *ReportHandler) GetSummary(c *gin.Context) {
	summary, err := h.service.GetPlatformAnalyticsSummary(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": summary})
}

// GetCollegeUsage handles GET /super-admin/reports/college-usage.
func (h *ReportHandler) GetCollegeUsage(c *gin.Context) {
	var params models.ReportFilterParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid filter parameters"})
		return
	}

	// Always apply small-count suppression by default on web dashboard
	if c.Query("suppress") != "false" {
		params.ApplySuppression = true
	}

	metrics, err := h.service.GetCollegeUsageBreakdown(c.Request.Context(), params)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": metrics})
}

// GetModuleAdoption handles GET /super-admin/reports/module-adoption.
func (h *ReportHandler) GetModuleAdoption(c *gin.Context) {
	adoption, err := h.service.GetModuleAdoptionMetrics(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": adoption})
}

// GetLoginSecurity handles GET /super-admin/reports/login-security.
func (h *ReportHandler) GetLoginSecurity(c *gin.Context) {
	days := 14
	if daysStr := c.Query("days"); daysStr != "" {
		if d, err := strconv.Atoi(daysStr); err == nil && d > 0 && d <= 90 {
			days = d
		}
	}

	metrics, err := h.service.GetLoginSecurityMetrics(c.Request.Context(), days)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": metrics})
}

// ExportCollegeUsageCSV handles GET /super-admin/reports/export/college-usage.
func (h *ReportHandler) ExportCollegeUsageCSV(c *gin.Context) {
	actorID, actorRole, err := getAuthenticatedActor(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var params models.ReportFilterParams
	_ = c.ShouldBindQuery(&params)
	params.ApplySuppression = c.Query("suppress") == "true"

	data, err := h.service.GenerateCollegeUsageCSV(c.Request.Context(), params, actorID, actorRole)
	if err != nil {
		respondError(c, err)
		return
	}

	filename := fmt.Sprintf("hms-college-usage-%s.csv", time.Now().Format("20060102-150405"))
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", "text/csv")
	c.Data(http.StatusOK, "text/csv", data)
}
