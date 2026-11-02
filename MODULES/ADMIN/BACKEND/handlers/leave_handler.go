package handlers

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

// ListLeaveRequests handles GET /admin/leaves.
func (h *LeaveHandler) ListLeaveRequests(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	leaves, err := h.svc.ListLeaveRequests(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"leaves": leaves})
}

// GetLeaveSummary handles GET /admin/leaves/summary.
func (h *LeaveHandler) GetLeaveSummary(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	summary, err := h.svc.GetLeaveSummary(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, summary)
}
