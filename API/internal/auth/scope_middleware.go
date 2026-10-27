package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RequirePlatformScope() gin.HandlerFunc {
	return func(c *gin.Context) {
		scopeValue, exists := c.Get(ContextScopeKey)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "UNAUTHORIZED",
					"message": "authentication scope is missing",
				},
			})
			return
		}

		scope, ok := scopeValue.(string)
		if !ok || scope != ScopePlatform {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "FORBIDDEN",
					"message": "platform scope is required",
				},
			})
			return
		}

		c.Next()
	}
}

func RequireCollegeScope() gin.HandlerFunc {
	return func(c *gin.Context) {
		scopeValue, exists := c.Get(ContextScopeKey)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "UNAUTHORIZED",
					"message": "authentication scope is missing",
				},
			})
			return
		}

		scope, ok := scopeValue.(string)
		if !ok || scope != ScopeCollege {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "FORBIDDEN",
					"message": "college scope is required",
				},
			})
			return
		}

		if _, exists := c.Get(ContextTenantIDKey); !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "FORBIDDEN",
					"message": "college tenant context is required",
				},
			})
			return
		}

		c.Next()
	}
}
