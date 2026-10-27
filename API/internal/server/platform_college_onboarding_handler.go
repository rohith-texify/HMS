package server

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type updateCollegeOnboardingRequest struct {
	Status string  `json:"status" binding:"required"`
	Notes  *string `json:"notes"`
}

func (h *PlatformCollegeHandler) GetCollegeOnboarding(c *gin.Context) {
	collegeID, err := uuid.Parse(c.Param("college_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{
			"code": "INVALID_COLLEGE_ID", "message": "college_id must be a valid UUID",
		}})
		return
	}

	steps, err := h.service.GetCollegeOnboarding(c.Request.Context(), collegeID)
	if err != nil {
		status := http.StatusInternalServerError
		code := "ONBOARDING_FETCH_FAILED"
		if errors.Is(err, repository.ErrNotFound) {
			status, code = http.StatusNotFound, "COLLEGE_NOT_FOUND"
		}
		c.JSON(status, gin.H{"success": false, "error": gin.H{
			"code": code, "message": err.Error(),
		}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"college_id": collegeID,
		"steps":      steps,
	}})
}

func (h *PlatformCollegeHandler) UpdateCollegeOnboarding(c *gin.Context) {
	collegeID, err := uuid.Parse(c.Param("college_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{
			"code": "INVALID_COLLEGE_ID", "message": "college_id must be a valid UUID",
		}})
		return
	}

	var request updateCollegeOnboardingRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": gin.H{
			"code": "INVALID_REQUEST", "message": "status is required",
		}})
		return
	}

	actorValue, exists := c.Get(auth.ContextUserIDKey)
	actorID, ok := actorValue.(uuid.UUID)
	if !exists || !ok || actorID == uuid.Nil {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{
			"code": "AUTHENTICATED_USER_REQUIRED", "message": "authenticated user context is missing",
		}})
		return
	}

	roleValue, exists := c.Get(auth.ContextRoleKey)
	actorRole, ok := roleValue.(string)
	if !exists || !ok || strings.TrimSpace(actorRole) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "error": gin.H{
			"code": "AUTHENTICATED_ROLE_REQUIRED", "message": "authenticated role context is missing",
		}})
		return
	}

	step, err := h.service.UpdateCollegeOnboarding(
		c.Request.Context(),
		collegeID,
		service.UpdateCollegeOnboardingInput{
			StepCode:    c.Param("step_code"),
			Status:      request.Status,
			Notes:       request.Notes,
			ActorUserID: actorID,
			ActorRole:   actorRole,
		},
	)
	if err != nil {
		status, code := http.StatusInternalServerError, "ONBOARDING_UPDATE_FAILED"
		switch {
		case errors.Is(err, repository.ErrNotFound):
			status, code = http.StatusNotFound, "ONBOARDING_STEP_NOT_FOUND"
		case strings.Contains(err.Error(), "invalid onboarding"),
			strings.Contains(err.Error(), "notes are required"),
			strings.Contains(err.Error(), "IDs are required"),
			strings.Contains(err.Error(), "actor role is required"):
			status, code = http.StatusBadRequest, "INVALID_ONBOARDING_UPDATE"
		}
		c.JSON(status, gin.H{"success": false, "error": gin.H{
			"code": code, "message": err.Error(),
		}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{
		"step": step,
	}})
}
