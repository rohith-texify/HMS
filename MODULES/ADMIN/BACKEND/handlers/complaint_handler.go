package handlers

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

// ListComplaints handles GET /admin/complaints.
func (h *ComplaintHandler) ListComplaints(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	complaints, err := h.svc.ListComplaints(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"complaints": complaints})
}

// GetComplaintSummary handles GET /admin/complaints/summary.
func (h *ComplaintHandler) GetComplaintSummary(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	summary, err := h.svc.GetComplaintSummary(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, summary)
}

