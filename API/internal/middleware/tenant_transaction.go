package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/internal/database"
)

// TenantTransactionMiddleware manages a request-scoped database transaction
// for authenticated college routes, ensuring all queries execute within a
// transaction where transaction-local tenant context is established.
func TenantTransactionMiddleware(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		if pool == nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "DATABASE_POOL_NIL",
					"message": "database pool is not initialized",
				},
			})
			return
		}

		ctx := c.Request.Context()

		// Begin request-scoped transaction
		tx, err := pool.Begin(ctx)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "FAILED_TO_START_TRANSACTION",
					"message": "failed to begin database transaction",
				},
			})
			return
		}

		// Inject transaction into standard request context
		txCtx := database.WithTx(ctx, tx)
		c.Request = c.Request.WithContext(txCtx)

		// Set transaction-local tenant context in PostgreSQL
		if err := database.SetTenantContext(txCtx, tx); err != nil {
			cleanupCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			_ = tx.Rollback(cleanupCtx)
			cancel()

			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "FAILED_TO_SET_TENANT_CONTEXT",
					"message": "failed to establish tenant context on transaction",
				},
			})
			return
		}

		committed := false
		defer func() {
			if p := recover(); p != nil {
				cleanupCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
				_ = tx.Rollback(cleanupCtx)
				cancel()
				panic(p) // Re-panic to trigger Gin's recovery middleware
			}

			if !committed {
				cleanupCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
				_ = tx.Rollback(cleanupCtx)
				cancel()
			}
		}()

		// Execute downstream handlers
		c.Next()

		// Rollback if errors were added to Gin context or response status indicates failure (>= 400)
		if len(c.Errors) > 0 || c.Writer.Status() >= 400 {
			cleanupCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			_ = tx.Rollback(cleanupCtx)
			cancel()
			committed = true
			return
		}

		// Commit transaction upon successful completion
		if err := tx.Commit(ctx); err != nil {
			cleanupCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			_ = tx.Rollback(cleanupCtx)
			cancel()
			committed = true

			// If response headers were not yet committed, write an error response
			if !c.Writer.Written() {
				c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "FAILED_TO_COMMIT_TRANSACTION",
						"message": "failed to commit database transaction",
					},
				})
			}
			return
		}

		committed = true
	}
}
