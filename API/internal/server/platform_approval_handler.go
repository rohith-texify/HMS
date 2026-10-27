package server

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type PlatformApprovalHandler struct {
	service *service.PlatformApprovalService
}

func NewPlatformApprovalHandler(
	approvalService *service.PlatformApprovalService,
) *PlatformApprovalHandler {
	return &PlatformApprovalHandler{
		service: approvalService,
	}
}

type createApprovalRequestBody struct {
	OperationType string          `json:"operation_type"`
	CollegeID     *uuid.UUID      `json:"college_id,omitempty"`
	Payload       json.RawMessage `json:"payload"`
	ExpiresAt     *time.Time      `json:"expires_at,omitempty"`
	Reason        *string         `json:"reason,omitempty"`
	Snapshot      json.RawMessage `json:"snapshot,omitempty"`
	ApproverID    *uuid.UUID      `json:"approver_id,omitempty"`
}

func (h *PlatformApprovalHandler) CreateApprovalRequest(c *gin.Context) {
	var body createApprovalRequestBody

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
			"error":   err.Error(),
		})
		return
	}

	userIDValue, exists := c.Get(auth.ContextUserIDKey)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "authentication required",
		})
		return
	}

	requestedBy, ok := userIDValue.(uuid.UUID)
	if !ok || requestedBy == uuid.Nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "invalid authenticated user",
		})
		return
	}

	operationType := strings.TrimSpace(body.OperationType)

	if operationType == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "operation_type is required",
		})
		return
	}

	if len(body.Payload) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "payload is required",
		})
		return
	}

	var reason *string

	if body.Reason != nil {
		value := strings.TrimSpace(*body.Reason)

		if value != "" {
			reason = &value
		}
	}

	result, err := h.service.CreateApprovalRequest(
		c.Request.Context(),
		service.CreateApprovalRequestInput{
			OperationType: operationType,
			CollegeID:     body.CollegeID,
			Payload:       body.Payload,
			RequestedBy:   requestedBy,
			ExpiresAt:     body.ExpiresAt,
			Reason:        reason,
			Snapshot:      body.Snapshot,
			ApproverID:    body.ApproverID,
		},
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "approval request created successfully",
		"data":    result,
	})
}

func (h *PlatformApprovalHandler) GetApprovalRequest(c *gin.Context) {
	requestIDParam := strings.TrimSpace(
		c.Param("request_id"),
	)

	requestID, err := uuid.Parse(requestIDParam)
	if err != nil || requestID == uuid.Nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request_id",
		})
		return
	}

	request, err := h.service.GetApprovalRequest(
		c.Request.Context(),
		requestID,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "approval request retrieved successfully",
		"data":    request,
	})
}
