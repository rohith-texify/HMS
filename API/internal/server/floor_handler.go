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

type FloorHandler struct {
	service *service.FloorService
}

func NewFloorHandler(service *service.FloorService) *FloorHandler {
	return &FloorHandler{
		service: service,
	}
}

type floorRequest struct {
	Code        string  `json:"code" binding:"required"`
	Name        string  `json:"name" binding:"required"`
	FloorNumber int     `json:"floor_number"`
	Description *string `json:"description"`
}

type floorStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *FloorHandler) Create(c *gin.Context) {
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

	var req floorRequest
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
		req.Code,
		req.Name,
		req.FloorNumber,
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

func (h *FloorHandler) Get(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

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

	item, err := h.service.Get(c.Request.Context(), collegeID, blockID, floorID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Floor not found",
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

func (h *FloorHandler) List(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	blockID, err := uuid.Parse(c.Param("block_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid block ID",
		})
		return
	}

	items, err := h.service.List(c.Request.Context(), collegeID, blockID)
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

func (h *FloorHandler) Update(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

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

	var req floorRequest
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
		blockID,
		floorID,
		req.Code,
		req.Name,
		req.FloorNumber,
		req.Description,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Floor not found",
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

func (h *FloorHandler) UpdateStatus(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

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

	var req floorStatusRequest
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
		blockID,
		floorID,
		req.Status,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Floor not found",
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
