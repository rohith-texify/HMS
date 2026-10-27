package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

type NotificationHandler struct {
	service *service.NotificationService
}

func NewNotificationHandler(service *service.NotificationService) *NotificationHandler {
	return &NotificationHandler{service: service}
}

func writeNotificationError(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": msg}})
}

func (h *NotificationHandler) CreateNotification(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeNotificationError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeNotificationError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	var req service.CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeNotificationError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	record, err := h.service.CreateNotification(c.Request.Context(), collegeID, userID, req)
	if err != nil {
		if err == service.ErrInvalidNotificationType || err == service.ErrInvalidNotificationPriority || err == service.ErrUserNotInCollege {
			writeNotificationError(c, http.StatusBadRequest, err.Error())
			return
		}
		writeNotificationError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, record)
}

func (h *NotificationHandler) ListNotifications(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeNotificationError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeNotificationError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	unreadOnly := c.Query("unread") == "true"

	records, err := h.service.ListNotifications(c.Request.Context(), collegeID, userID, unreadOnly)
	if err != nil {
		writeNotificationError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, records)
}

func (h *NotificationHandler) GetNotification(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeNotificationError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeNotificationError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	id, err := uuid.Parse(c.Param("notification_id"))
	if err != nil {
		writeNotificationError(c, http.StatusBadRequest, "invalid notification id")
		return
	}

	record, err := h.service.GetNotification(c.Request.Context(), collegeID, userID, id)
	if err != nil {
		writeNotificationError(c, http.StatusNotFound, "notification not found")
		return
	}

	response.OK(c, record)
}

func (h *NotificationHandler) MarkAsRead(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeNotificationError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeNotificationError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	id, err := uuid.Parse(c.Param("notification_id"))
	if err != nil {
		writeNotificationError(c, http.StatusBadRequest, "invalid notification id")
		return
	}

	err = h.service.MarkAsRead(c.Request.Context(), collegeID, userID, id)
	if err != nil {
		writeNotificationError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "notification marked as read"})
}

func (h *NotificationHandler) MarkAllAsRead(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeNotificationError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeNotificationError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	err := h.service.MarkAllAsRead(c.Request.Context(), collegeID, userID)
	if err != nil {
		writeNotificationError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, gin.H{"message": "all notifications marked as read"})
}

func (h *NotificationHandler) GetUnreadCount(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeNotificationError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeNotificationError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	count, err := h.service.GetUnreadCount(c.Request.Context(), collegeID, userID)
	if err != nil {
		writeNotificationError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, gin.H{"count": count})
}
