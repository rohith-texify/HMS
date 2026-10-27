package middleware

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TenantStatusMiddleware struct {
	pool *pgxpool.Pool
}

func NewTenantStatusMiddleware(pool *pgxpool.Pool) *TenantStatusMiddleware {
	return &TenantStatusMiddleware{
		pool: pool,
	}
}

// RequireActiveTenant verifies that the authenticated tenant exists
// and is currently ACTIVE.
//
// Tenant ID must already be established by TenantContextMiddleware.
func (m *TenantStatusMiddleware) RequireActiveTenant() gin.HandlerFunc {
	return func(c *gin.Context) {
		tenantValue, exists := c.Get(TenantIDContextKey)
		if !exists || tenantValue == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "TENANT_CONTEXT_REQUIRED",
					"message": "tenant context is required",
				},
			})
			return
		}

		tenantID, ok := tenantValue.(uuid.UUID)
		if !ok || tenantID == uuid.Nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_TENANT_CONTEXT",
					"message": "invalid tenant context",
				},
			})
			return
		}

		status, err := m.getTenantStatus(c, tenantID)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "TENANT_STATUS_CHECK_FAILED",
					"message": "failed to verify tenant status",
				},
			})
			return
		}

		if status != "ACTIVE" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "TENANT_NOT_ACTIVE",
					"message": "tenant is not active",
					"status":  status,
				},
			})
			return
		}

		c.Set("tenant_status", status)
		c.Next()
	}
}

func (m *TenantStatusMiddleware) getTenantStatus(
	c *gin.Context,
	tenantID uuid.UUID,
) (string, error) {
	if m.pool == nil {
		return "", fmt.Errorf("database pool is nil")
	}

	var status string

	err := m.pool.QueryRow(
		c.Request.Context(),
		`
		SELECT status
		FROM platform.colleges
		WHERE college_id = $1
		`,
		tenantID,
	).Scan(&status)

	if err != nil {
		return "", fmt.Errorf("failed to query tenant status: %w", err)
	}

	return status, nil
}
