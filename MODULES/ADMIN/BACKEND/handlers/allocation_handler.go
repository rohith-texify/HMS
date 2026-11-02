package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

// ListBedAllocations handles GET /admin/allocations.
func (h *AllocationHandler) ListBedAllocations(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	allocations, err := h.svc.ListBedAllocations(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"allocations": allocations})
}

// GetCurrentAllocation handles GET /admin/allocations/student/:student_id.
func (h *AllocationHandler) GetCurrentAllocation(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	studentID, err := uuid.Parse(c.Param("student_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.InvalidInput, "Invalid student ID"))
		return
	}

	allocation, err := h.svc.GetCurrentAllocation(c.Request.Context(), collegeID, studentID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, allocation)
}

