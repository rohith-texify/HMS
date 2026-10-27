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

type BedHandler struct {
	service *service.BedService
}

func NewBedHandler(service *service.BedService) *BedHandler {
	return &BedHandler{
		service: service,
	}
}

type bedRequest struct {
	Code string  `json:"code" binding:"required"`
	Name *string `json:"name"`
}

type bedStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *BedHandler) Create(c *gin.Context) {
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

	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid room ID",
		})
		return
	}

	var req bedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	item, err := h.service.Create(
		c.Request.Context(),
		collegeID,
		hostelID,
		blockID,
		floorID,
		roomID,
		req.Code,
		req.Name,
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

func (h *BedHandler) Get(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid room ID",
		})
		return
	}

	bedID, err := uuid.Parse(c.Param("bed_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid bed ID",
		})
		return
	}

	item, err := h.service.Get(c.Request.Context(), collegeID, roomID, bedID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Bed not found",
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

func (h *BedHandler) List(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid room ID",
		})
		return
	}

	items, err := h.service.List(c.Request.Context(), collegeID, roomID)
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

func (h *BedHandler) Update(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid room ID",
		})
		return
	}

	bedID, err := uuid.Parse(c.Param("bed_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid bed ID",
		})
		return
	}

	var req bedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	item, err := h.service.Update(
		c.Request.Context(),
		collegeID,
		roomID,
		bedID,
		req.Code,
		req.Name,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Bed not found",
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

func (h *BedHandler) UpdateStatus(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	roomID, err := uuid.Parse(c.Param("room_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid room ID",
		})
		return
	}

	bedID, err := uuid.Parse(c.Param("bed_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid bed ID",
		})
		return
	}

	var req bedStatusRequest
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
		roomID,
		bedID,
		req.Status,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Bed not found",
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
