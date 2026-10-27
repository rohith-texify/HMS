package middleware

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/database"
)

const TenantIDContextKey = "tenant_id"

// TenantContextMiddleware validates and establishes the tenant context
// for authenticated requests.
//
// AuthenticationMiddleware must run before this middleware.
func TenantContextMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantValue, exists := c.Get(auth.ContextTenantIDKey)

		if !exists || tenantValue == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "tenant context is required",
				"error":   "TENANT_CONTEXT_REQUIRED",
			})
			return
		}

		tenantID, err := parseTenantID(tenantValue)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"message": "invalid tenant context",
				"error":   "INVALID_TENANT_CONTEXT",
			})
			return
		}

		// Store normalized UUID in Gin context.
		c.Set(TenantIDContextKey, tenantID)

		// Store tenant ID in the standard Go request context.
		ctx := database.WithTenantID(
			c.Request.Context(),
			tenantID,
		)

		// Replace request with tenant-aware context.
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

func parseTenantID(value interface{}) (uuid.UUID, error) {
	switch v := value.(type) {
	case uuid.UUID:
		if v == uuid.Nil {
			return uuid.Nil, fmt.Errorf("tenant ID is empty")
		}

		return v, nil

	case string:
		tenantID, err := uuid.Parse(v)
		if err != nil {
			return uuid.Nil, fmt.Errorf("invalid tenant ID: %w", err)
		}

		if tenantID == uuid.Nil {
			return uuid.Nil, fmt.Errorf("tenant ID is empty")
		}

		return tenantID, nil

	default:
		return uuid.Nil, fmt.Errorf("unsupported tenant ID type")
	}
}
