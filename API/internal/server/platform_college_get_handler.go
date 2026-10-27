package server

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

func (h *PlatformCollegeHandler) GetCollege(c *gin.Context) {
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

	college, err := h.service.GetCollege(
		c.Request.Context(),
		collegeID,
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

		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "COLLEGE_FETCH_FAILED",
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
