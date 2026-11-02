package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

// ListMealTimings handles GET /admin/hostels/:hostel_id/mess/timings.
func (h *MessHandler) ListMealTimings(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.InvalidInput, "Invalid hostel ID"))
		return
	}

	timings, err := h.svc.ListMealTimings(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"timings": timings})
}

// ListMealMenus handles GET /admin/hostels/:hostel_id/mess/menus.
func (h *MessHandler) ListMealMenus(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.InvalidInput, "Invalid hostel ID"))
		return
	}

	menus, err := h.svc.ListMealMenus(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"menus": menus})
}
