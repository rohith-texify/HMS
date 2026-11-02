package handlers

import (
	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

// ListNotifications handles GET /admin/notifications.
func (h *NotificationHandler) ListNotifications(c *gin.Context) {
	collegeID, err := getAuthenticatedCollegeID(c)
	if err != nil {
		respondError(c, err)
		return
	}

	notifications, err := h.svc.ListNotifications(c.Request.Context(), collegeID)
	if err != nil {
		respondError(c, err)
		return
	}

	response.OK(c, gin.H{"notifications": notifications})
}

