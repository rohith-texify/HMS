package server

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/middleware"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type RoomHandler struct {
	service *service.RoomService
}

func NewRoomHandler(service *service.RoomService) *RoomHandler {
	return &RoomHandler{
		service: service,
	}
}

type roomRequest struct {
	Code        string  `json:"code" binding:"required"`
	Name        string  `json:"name" binding:"required"`
	RoomType    string  `json:"room_type"`
	Capacity    int     `json:"capacity"`
	Description *string `json:"description"`
}

type roomStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *RoomHandler) Create(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	hostelID, err := uuid.Parse(c.Param("hostel_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid hostel ID",
		})
		return
	}

	blockID, err := uuid.Parse(c.Param("block_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid block ID",
		})
		return
	}

	floorID, err := uuid.Parse(c.Param("floor_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid floor ID",
		})
		return
	}

	var req roomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	roomType := req.RoomType
	if roomType == "" {
		roomType = "STANDARD"
	}

	item, err := h.service.Create(
		c.Request.Context(),
		collegeID,
		hostelID,
		blockID,
		floorID,
		req.Code,
		req.Name,
		roomType,
		req.Capacity,
		req.Description,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    item,
	})
}

func (h *RoomHandler) Get(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	floorID, err := uuid.Parse(c.Param("floor_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid floor ID",
		})
		return
	}

	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid room ID",
		})
		return
	}

	item, err := h.service.Get(c.Request.Context(), collegeID, floorID, roomID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Room not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    item,
	})
}

func (h *RoomHandler) List(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	floorID, err := uuid.Parse(c.Param("floor_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid floor ID",
		})
		return
	}

	items, err := h.service.List(c.Request.Context(), collegeID, floorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    items,
	})
}

func (h *RoomHandler) Update(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	floorID, err := uuid.Parse(c.Param("floor_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid floor ID",
		})
		return
	}

	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid room ID",
		})
		return
	}

	var req roomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	roomType := req.RoomType
	if roomType == "" {
		roomType = "STANDARD"
	}

	item, err := h.service.Update(
		c.Request.Context(),
		collegeID,
		floorID,
		roomID,
		req.Code,
		req.Name,
		roomType,
		req.Capacity,
		req.Description,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Room not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    item,
	})
}

func (h *RoomHandler) UpdateStatus(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	floorID, err := uuid.Parse(c.Param("floor_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid floor ID",
		})
		return
	}

	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid room ID",
		})
		return
	}

	var req roomStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	item, err := h.service.UpdateStatus(
		c.Request.Context(),
		collegeID,
		floorID,
		roomID,
		req.Status,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Room not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    item,
	})
}
