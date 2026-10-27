package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/middleware"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

type HostelHandler struct {
	service *service.HostelService
}

func NewHostelHandler(
	service *service.HostelService,
) *HostelHandler {
	return &HostelHandler{
		service: service,
	}
}

type createHostelRequest struct {
	Code          string `json:"code" binding:"required"`
	Name          string `json:"name" binding:"required"`
	Category      string `json:"category" binding:"required"`
	Description   string `json:"description"`
	Address       string `json:"address"`
	TotalCapacity int    `json:"total_capacity"`
	Status        string `json:"status"`
}

type updateHostelRequest struct {
	Code          string `json:"code" binding:"required"`
	Name          string `json:"name" binding:"required"`
	Category      string `json:"category" binding:"required"`
	Description   string `json:"description"`
	Address       string `json:"address"`
	TotalCapacity int    `json:"total_capacity"`
}

type updateHostelStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *HostelHandler) tenantID(
	c *gin.Context,
) (uuid.UUID, bool) {
	value, exists := c.Get(middleware.TenantIDContextKey)

	if !exists {
		return uuid.Nil, false
	}

	id, ok := value.(uuid.UUID)

	return id, ok && id != uuid.Nil
}

func (h *HostelHandler) List(c *gin.Context) {
	collegeID, ok := h.tenantID(c)

	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	items, err := h.service.List(
		c.Request.Context(),
		collegeID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.OK(c, items)
}

func (h *HostelHandler) Get(c *gin.Context) {
	collegeID, ok := h.tenantID(c)

	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	hostelID, err := uuid.Parse(
		c.Param("hostel_id"),
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid hostel_id",
		})
		return
	}

	item, err := h.service.Get(
		c.Request.Context(),
		collegeID,
		hostelID,
	)

	if err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "hostel not found",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.OK(c, item)
}

func (h *HostelHandler) Create(c *gin.Context) {
	collegeID, ok := h.tenantID(c)

	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	var req createHostelRequest

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
		service.CreateHostelInput{
			Code:          strings.TrimSpace(req.Code),
			Name:          strings.TrimSpace(req.Name),
			Category:      strings.TrimSpace(req.Category),
			Description:   strings.TrimSpace(req.Description),
			Address:       strings.TrimSpace(req.Address),
			TotalCapacity: req.TotalCapacity,
			Status:        strings.TrimSpace(req.Status),
		},
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.Created(c, item)
}

func (h *HostelHandler) Update(c *gin.Context) {
	collegeID, ok := h.tenantID(c)

	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	hostelID, err := uuid.Parse(
		c.Param("hostel_id"),
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid hostel_id",
		})
		return
	}

	var req updateHostelRequest

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
		service.UpdateHostelInput{
			Code:          strings.TrimSpace(req.Code),
			Name:          strings.TrimSpace(req.Name),
			Category:      strings.TrimSpace(req.Category),
			Description:   strings.TrimSpace(req.Description),
			Address:       strings.TrimSpace(req.Address),
			TotalCapacity: req.TotalCapacity,
		},
	)

	if err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "hostel not found",
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.OK(c, item)
}

func (h *HostelHandler) UpdateStatus(c *gin.Context) {
	collegeID, ok := h.tenantID(c)

	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "tenant context is missing",
		})
		return
	}

	hostelID, err := uuid.Parse(
		c.Param("hostel_id"),
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid hostel_id",
		})
		return
	}

	var req updateHostelStatusRequest

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
		strings.TrimSpace(req.Status),
	)

	if err != nil {
		if err == repository.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "hostel not found",
			})
			return
		}

		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	response.OK(c, item)
}
