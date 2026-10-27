package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type PlatformCollegeHandler struct {
	service *service.PlatformCollegeService
}

func NewPlatformCollegeHandler(
	svc *service.PlatformCollegeService,
) *PlatformCollegeHandler {
	return &PlatformCollegeHandler{
		service: svc,
	}
}

func (h *PlatformCollegeHandler) ListColleges(c *gin.Context) {
	colleges, err := h.service.ListColleges(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"error": gin.H{
				"code":    "COLLEGES_FETCH_FAILED",
				"message": err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"colleges": colleges,
		},
	})
}
