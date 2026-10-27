package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

type MessHandler struct {
	service *service.MessService
}

func NewMessHandler(service *service.MessService) *MessHandler {
	return &MessHandler{service: service}
}

func writeMessError(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"success": false, "error": gin.H{"code": "BAD_REQUEST", "message": msg}})
}

func (h *MessHandler) CreateMealTiming(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeMessError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeMessError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	var req service.CreateMealTimingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeMessError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	record, err := h.service.CreateMealTiming(c.Request.Context(), collegeID, userID, req)
	if err != nil {
		if err == service.ErrInvalidMealType || err == service.ErrInvalidTimeRange {
			writeMessError(c, http.StatusBadRequest, err.Error())
			return
		}
		writeMessError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, record)
}

func (h *MessHandler) ListMealTimings(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeMessError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		writeMessError(c, http.StatusBadRequest, "invalid hostel id")
		return
	}

	records, err := h.service.ListMealTimings(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		writeMessError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, records)
}

func (h *MessHandler) CreateMealMenu(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeMessError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}
	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		writeMessError(c, http.StatusUnauthorized, "invalid user id")
		return
	}
	userID := userIDValue.(uuid.UUID)

	var req service.CreateMealMenuRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeMessError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	record, err := h.service.CreateMealMenu(c.Request.Context(), collegeID, userID, req)
	if err != nil {
		if err == service.ErrInvalidMealType {
			writeMessError(c, http.StatusBadRequest, err.Error())
			return
		}
		writeMessError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, record)
}

func (h *MessHandler) ListMealMenus(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeMessError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		writeMessError(c, http.StatusBadRequest, "invalid hostel id")
		return
	}

	records, err := h.service.ListMealMenus(c.Request.Context(), collegeID, hostelID)
	if err != nil {
		writeMessError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, records)
}

func (h *MessHandler) CreateFoodFeedback(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeMessError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	var req service.CreateFoodFeedbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		writeMessError(c, http.StatusBadRequest, "invalid request body")
		return
	}

	record, err := h.service.CreateFoodFeedback(c.Request.Context(), collegeID, req)
	if err != nil {
		if err == service.ErrInvalidRating {
			writeMessError(c, http.StatusBadRequest, err.Error())
			return
		}
		writeMessError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Created(c, record)
}

func (h *MessHandler) GetTodayMenus(c *gin.Context) {
	collegeID, ok := collegeIDFromContext(c)
	if !ok {
		writeMessError(c, http.StatusUnauthorized, "tenant context is missing")
		return
	}

	records, err := h.service.GetTodayMenus(c.Request.Context(), collegeID)
	if err != nil {
		writeMessError(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.OK(c, records)
}
