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

type updateCollegeStatusRequest struct {
	Status          string `json:"status" binding:"required"`
	LifecycleReason string `json:"lifecycle_reason" binding:"required"`
}

func (h *PlatformCollegeHandler) UpdateCollegeStatus(c *gin.Context) {
	collegeIDParam := c.Param("college_id")

	collegeID, err := uuid.Parse(collegeIDParam)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_COLLEGE_ID",
				"message": "college_id must be a valid UUID",
			},
		})
		return
	}

	var request updateCollegeStatusRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": "status and lifecycle_reason are required",
			},
		})
		return
	}

	actorIDValue, exists := c.Get(auth.ContextUserIDKey)
	actorID, ok := actorIDValue.(uuid.UUID)

	if !exists || !ok || actorID == uuid.Nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTHENTICATED_USER_REQUIRED",
				"message": "authenticated user context is missing",
			},
		})
		return
	}

	roleValue, exists := c.Get(auth.ContextRoleKey)
	actorRole, ok := roleValue.(string)

	if !exists || !ok || strings.TrimSpace(actorRole) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "AUTHENTICATED_ROLE_REQUIRED",
				"message": "authenticated role context is missing",
			},
		})
		return
	}

	college, err := h.service.UpdateCollegeStatus(
		c.Request.Context(),
		collegeID,
		service.UpdateCollegeStatusInput{
			Status:          request.Status,
			LifecycleReason: request.LifecycleReason,
			ActorUserID:     actorID,
			ActorRole:       actorRole,
		},
	)

	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "COLLEGE_NOT_FOUND",
					"message": "college not found",
				},
			})
			return
		}

		if strings.Contains(err.Error(), "invalid college status transition:") {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_STATUS_TRANSITION",
					"message": err.Error(),
				},
			})
			return
		}

		if strings.Contains(err.Error(), "invalid college status:") {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_COLLEGE_STATUS",
					"message": "status must be ONBOARDING, ACTIVE, SUSPENDED or DEACTIVATED",
				},
			})
			return
		}

		if strings.Contains(err.Error(), "college status is already") {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "COLLEGE_STATUS_UNCHANGED",
					"message": err.Error(),
				},
			})
			return
		}

		if err.Error() == "lifecycle reason is required" {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "LIFECYCLE_REASON_REQUIRED",
					"message": "lifecycle_reason is required",
				},
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "COLLEGE_STATUS_UPDATE_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"college": college,
		},
	})
}
