package server

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type createCollegeRequest struct {
	CollegeCode string `json:"college_code" binding:"required"`
	Name        string `json:"name" binding:"required"`
}

func (h *PlatformCollegeHandler) CreateCollege(c *gin.Context) {
	var request createCollegeRequest

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "INVALID_REQUEST",
				"message": "college_code and name are required",
			},
		})
		return
	}

	college, err := h.service.CreateCollege(
		c.Request.Context(),
		service.CreateCollegeInput{
			CollegeCode: request.CollegeCode,
			Name:        request.Name,
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

		if strings.Contains(err.Error(), "college code is required") ||
			strings.Contains(err.Error(), "college name is required") {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_COLLEGE_INPUT",
					"message": err.Error(),
				},
			})
			return
		}

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "COLLEGE_CREATE_FAILED",
				"message": "an unexpected error occurred while creating college",
			},
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data": gin.H{
			"college": college,
		},
	})
}
