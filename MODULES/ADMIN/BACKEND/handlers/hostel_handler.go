package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

// ListHostels handles GET /admin/hostels.
func (h *HostelHandler) ListHostels(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	hostels, err := h.svc.ListHostels(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"hostels": hostels})
}

// ListBlocks handles GET /admin/hostels/:hostel_id/blocks.
func (h *HostelHandler) ListBlocks(c *gin.Context) {
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

	blocks, err := h.svc.ListBlocks(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"blocks": blocks})
}

// ListFloors handles GET /admin/blocks/:block_id/floors.
func (h *HostelHandler) ListFloors(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	blockID, err := uuid.Parse(c.Param("block_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.InvalidInput, "Invalid block ID"))
		return
	}

	floors, err := h.svc.ListFloors(c.Request.Context(), collegeID, blockID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"floors": floors})
}

// ListRooms handles GET /admin/floors/:floor_id/rooms.
func (h *HostelHandler) ListRooms(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	floorID, err := uuid.Parse(c.Param("floor_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.InvalidInput, "Invalid floor ID"))
		return
	}

	rooms, err := h.svc.ListRooms(c.Request.Context(), collegeID, floorID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"rooms": rooms})
}

// ListBeds handles GET /admin/rooms/:room_id/beds.
func (h *HostelHandler) ListBeds(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		respondError(c, apierrors.New(apierrors.InvalidInput, "Invalid room ID"))
		return
	}

	beds, err := h.svc.ListBeds(c.Request.Context(), collegeID, roomID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"beds": beds})
}
