package server

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type updateCollegeRequest struct {
	CollegeCode string `json:"college_code" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Timezone    string `json:"timezone" binding:"required"`
}

func (h *PlatformCollegeHandler) UpdateCollege(c *gin.Context) {
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

	var request updateCollegeRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": "college_code, name and timezone are required",
			},
		})
		return
	}

	college, err := h.service.UpdateCollege(
		c.Request.Context(),
		collegeID,
		service.UpdateCollegeInput{
			CollegeCode: request.CollegeCode,
			Name:        request.Name,
			Timezone:    request.Timezone,
		},
	)

	if err != nil {
		if errors.Is(err, repository.ErrConflict) {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "COLLEGE_CODE_EXISTS",
					"message": "college code already exists",
				},
			})
			return
		}

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

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "COLLEGE_UPDATE_FAILED",
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
