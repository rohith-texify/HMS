package handlers

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

// ListStaff handles GET /admin/staff.
func (h *StaffHandler) ListStaff(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	staff, err := h.svc.ListStaff(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"staff": staff})
}

// ListGates handles GET /admin/gates.
func (h *StaffHandler) ListGates(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	gates, err := h.svc.ListGates(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"gates": gates})
}

// ListSecurityAssignments handles GET /admin/security-assignments.
func (h *StaffHandler) ListSecurityAssignments(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	assignments, err := h.svc.ListSecurityAssignments(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"security_assignments": assignments})
}

