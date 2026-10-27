package server

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/middleware"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type BedAllocationHandler struct {
	service *service.BedAllocationService
}

func NewBedAllocationHandler(service *service.BedAllocationService) *BedAllocationHandler {
	return &BedAllocationHandler{
		service: service,
	}
}

type bedAllocationRequest struct {
	BedID          uuid.UUID  `json:"bed_id" binding:"required"`
	StudentID      *uuid.UUID `json:"student_id"`
	AllocationType string     `json:"allocation_type"`
	AllocatedAt    time.Time  `json:"allocated_at" binding:"required"`
	Remarks        *string    `json:"remarks"`
}

type bedAllocationUpdateRequest struct {
	AllocationType string  `json:"allocation_type" binding:"required"`
	Remarks        *string `json:"remarks"`
}

type bedAllocationReleaseRequest struct {
	ReleasedAt time.Time `json:"released_at" binding:"required"`
	Status     string    `json:"status" binding:"required"`
}

type bedAllocationTransferRequest struct {
	NewBedID      uuid.UUID `json:"new_bed_id" binding:"required"`
	TransferredAt time.Time `json:"transferred_at" binding:"required"`
}

func (h *BedAllocationHandler) Create(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	var req bedAllocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	allocType := req.AllocationType
	if allocType == "" {
		allocType = "REGULAR"
	}

	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	var createdBy *uuid.UUID
	if exists {
		userID := userIDValue.(uuid.UUID)
		createdBy = &userID
	}

	item, err := h.service.Create(
		c.Request.Context(),
		collegeID,
		req.BedID,
		req.StudentID,
		allocType,
		req.AllocatedAt,
		req.Remarks,
		createdBy,
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

func (h *BedAllocationHandler) Get(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	allocationID, err := uuid.Parse(c.Param("allocation_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid allocation ID",
		})
		return
	}

	item, err := h.service.Get(c.Request.Context(), collegeID, allocationID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Bed allocation not found",
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

func (h *BedAllocationHandler) List(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	var bedIDPtr *uuid.UUID
	if bedIDStr := c.Query("bed_id"); bedIDStr != "" {
		bedID, err := uuid.Parse(bedIDStr)
		if err == nil {
			bedIDPtr = &bedID
		}
	}

	var studentIDPtr *uuid.UUID
	if studentIDStr := c.Query("student_id"); studentIDStr != "" {
		studentID, err := uuid.Parse(studentIDStr)
		if err == nil {
			studentIDPtr = &studentID
		}
	}

	var statusPtr *string
	if statusStr := c.Query("status"); statusStr != "" {
		statusPtr = &statusStr
	}

	items, err := h.service.List(c.Request.Context(), collegeID, bedIDPtr, studentIDPtr, statusPtr)
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

func (h *BedAllocationHandler) Update(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	allocationID, err := uuid.Parse(c.Param("allocation_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid allocation ID",
		})
		return
	}

	var req bedAllocationUpdateRequest
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
		allocationID,
		req.AllocationType,
		req.Remarks,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Bed allocation not found",
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

func (h *BedAllocationHandler) Release(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	allocationID, err := uuid.Parse(c.Param("allocation_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid allocation ID",
		})
		return
	}

	var req bedAllocationReleaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	var releasedBy *uuid.UUID
	if exists {
		userID := userIDValue.(uuid.UUID)
		releasedBy = &userID
	}

	item, err := h.service.Release(
		c.Request.Context(),
		collegeID,
		allocationID,
		req.ReleasedAt,
		releasedBy,
		req.Status,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Bed allocation not found",
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

func (h *BedAllocationHandler) Transfer(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	allocationID, err := uuid.Parse(c.Param("allocation_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid allocation ID",
		})
		return
	}

	var req bedAllocationTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	var releasedBy *uuid.UUID
	if exists {
		userID := userIDValue.(uuid.UUID)
		releasedBy = &userID
	}

	item, err := h.service.Transfer(
		c.Request.Context(),
		collegeID,
		allocationID,
		req.NewBedID,
		req.TransferredAt,
		releasedBy,
	)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Bed allocation not found",
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

func (h *BedAllocationHandler) GetCurrent(c *gin.Context) {
	collegeIDValue, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Tenant context not found",
		})
		return
	}
	collegeID := collegeIDValue.(uuid.UUID)

	studentIDStr := c.Query("student_id")
	if studentIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "student_id is required",
		})
		return
	}
	studentID, err := uuid.Parse(studentIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Invalid student ID",
		})
		return
	}

	item, err := h.service.GetCurrentAllocation(c.Request.Context(), collegeID, studentID)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"message": "Active bed allocation not found",
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
