package server

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/database"
)

func RLSContextTestHandler(
	db *database.Database,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		err := db.WithTransaction(
			c.Request.Context(),
			func(ctx context.Context, tx pgx.Tx) error {
				return database.VerifyTenantContext(ctx)
			},
		)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "RLS_CONTEXT_VERIFICATION_FAILED",
					"message": err.Error(),
				},
			})
			return
		}

		tenantID, err := database.RequireTenantID(c.Request.Context())
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "TENANT_CONTEXT_REQUIRED",
					"message": "tenant context is required",
				},
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data": gin.H{
				"tenant_id": tenantID.String(),
				"rls":       "verified",
				"status":    "tenant_context_matches_database",
			},
		})
	}
}
