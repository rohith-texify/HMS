package server

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
)

func PlatformMeHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, exists := c.Get(auth.ContextUserIDKey)
		if !exists || userID == nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "AUTHENTICATION_REQUIRED",
					"message": "authenticated user context is required",
				},
			})
			return
		}

		role, _ := c.Get(auth.ContextRoleKey)
		scope, _ := c.Get(auth.ContextScopeKey)

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"user_id": userID,
				"role":    role,
				"scope":   scope,
			},
		})
	}
}
