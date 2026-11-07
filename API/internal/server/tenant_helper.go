package server

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/middleware"
)

// getTenantID retrieves the authenticated tenant college UUID from the Gin context.
func getTenantID(c *gin.Context) (uuid.UUID, bool) {
	value, exists := c.Get(middleware.TenantIDContextKey)
	if !exists {
		return uuid.Nil, false
	}
	tenantID, ok := value.(uuid.UUID)
	return tenantID, ok && tenantID != uuid.Nil
}

