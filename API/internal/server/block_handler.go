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

type BlockHandler struct {
	service *service.BlockService
}

func NewBlockHandler(service *service.BlockService) *BlockHandler {
	return &BlockHandler{
		service: service,
	}
}

type blockRequest struct {
	Code        string  `json:"code" binding:"required"`
	Name        string  `json:"name" binding:"required"`
	Description *string `json:"description"`
}

type blockStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *BlockHandler) Create(c *gin.Context) {
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

	var req blockRequest
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
		req.Code,
		req.Name,
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

func (h *BlockHandler) Get(c *gin.Context) {
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

	item, err := h.service.Get(c.Request.Context(), collegeID, hostelID, blockID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Block not found",
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

func (h *BlockHandler) List(c *gin.Context) {
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

	items, err := h.service.List(c.Request.Context(), collegeID, hostelID)
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

func (h *BlockHandler) Update(c *gin.Context) {
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

	var req blockRequest
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
		hostelID,
		blockID,
		req.Code,
		req.Name,
		req.Description,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Block not found",
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

func (h *BlockHandler) UpdateStatus(c *gin.Context) {
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

	var req blockStatusRequest
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
		hostelID,
		blockID,
		req.Status,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Block not found",
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
