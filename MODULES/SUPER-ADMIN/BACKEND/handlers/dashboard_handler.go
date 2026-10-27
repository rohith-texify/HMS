package handlers

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/pkg/response"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// DashboardHandler handles HTTP requests for the Super Admin Dashboard.
type DashboardHandler struct {
	service *services.DashboardService
}

// NewDashboardHandler creates a new DashboardHandler instance.
func NewDashboardHandler(service *services.DashboardService) *DashboardHandler {
	return &DashboardHandler{
		service: service,
	}
}

// GetDashboard handles GET /super-admin/dashboard (and /super-admin/dashboard/summary).
// Supports query filters: start_date, end_date, and college_id.
func (h *DashboardHandler) GetDashboard(c *gin.Context) {
	startDateStr := c.Query("start_date")
	endDateStr := c.Query("end_date")
	collegeIDStr := c.Query("college_id")

	// Validate query parameters
	filters, err := validators.ValidateDashboardFilterParams(startDateStr, endDateStr, collegeIDStr)
	if err != nil {
		respondError(c, err)
		return
	}

	data, err := h.service.GetDashboard(c.Request.Context(), filters)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, data)
}
