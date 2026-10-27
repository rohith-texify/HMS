package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type PlatformApprovalDecisionHandler struct {
	service *service.PlatformApprovalDecisionService
}

func NewPlatformApprovalDecisionHandler(
	approvalDecisionService *service.PlatformApprovalDecisionService,
) *PlatformApprovalDecisionHandler {
	return &PlatformApprovalDecisionHandler{
		service: approvalDecisionService,
	}
}

type approvalDecisionRequest struct {
	Comment string `json:"comment"`
	Reason  string `json:"reason"`
}

func (h *PlatformApprovalDecisionHandler) Approve(
	c *gin.Context,
) {
	h.decide(c, "APPROVED")
}

func (h *PlatformApprovalDecisionHandler) Reject(
	c *gin.Context,
) {
	h.decide(c, "REJECTED")
}

func (h *PlatformApprovalDecisionHandler) decide(
	c *gin.Context,
	decision string,
) {
	requestID, err := uuid.Parse(
		strings.TrimSpace(c.Param("request_id")),
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request_id",
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

	approverID, ok := userIDValue.(uuid.UUID)
	if !ok || approverID == uuid.Nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": "invalid authenticated user",
		})
		return
	}

	var input approvalDecisionRequest

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "invalid request body",
		})
		return
	}

	input.Comment = strings.TrimSpace(input.Comment)
	input.Reason = strings.TrimSpace(input.Reason)

	var step interface{}

	if decision == "APPROVED" {
		result, err := h.service.Approve(
			c.Request.Context(),
			requestID,
			approverID,
			input.Comment,
			input.Reason,
		)
		if err != nil {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}

		step = result
	} else {
		result, err := h.service.Reject(
			c.Request.Context(),
			requestID,
			approverID,
			input.Comment,
			input.Reason,
		)
		if err != nil {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}

		step = result
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  "approval decision processed successfully",
		"decision": decision,
		"step":     step,
	})
}
