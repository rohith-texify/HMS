package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

const (
	PermissionKey = "permission"
)

// PermissionChecker defines the dependency required to evaluate user permissions.
type PermissionChecker interface {
	HasPermission(ctx context.Context, userID uuid.UUID, permissionCode string) (bool, error)
}

type PermissionMiddleware struct {
	permissionService PermissionChecker
}

func NewPermissionMiddleware(
	permissionService PermissionChecker,
) *PermissionMiddleware {
	return &PermissionMiddleware{
		permissionService: permissionService,
	}
}

// RequirePermission creates middleware that requires the authenticated
// user to have the specified permission.
//
// Authentication must already have run before this middleware.
//
// Responsibility:
//   - Read authenticated user ID from Gin context.
//   - Validate the permission code.
//   - Ask PermissionService whether the user has the permission.
//   - Continue when authorized.
//   - Return HTTP 403 when authorization fails.
//
// This middleware does NOT:
//   - Parse JWTs.
//   - Determine tenant context.
//   - Check tenant status.
//   - Check module entitlements.
//   - Perform SQL directly.
//   - Trust permission information from the request.
func (m *PermissionMiddleware) RequirePermission(
	permissionCode string,
) gin.HandlerFunc {
	code := strings.ToLower(strings.TrimSpace(permissionCode))

	return func(c *gin.Context) {
		if code == "" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "PERMISSION_REQUIRED",
					"message": "permission is required",
				},
			})
			return
		}

		userIDValue, exists := c.Get(auth.ContextUserIDKey)
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "AUTHENTICATION_REQUIRED",
					"message": "authenticated user is required",
				},
			})
			return
		}

		userID, ok := userIDValue.(uuid.UUID)
		if !ok || userID == uuid.Nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "INVALID_AUTHENTICATED_USER",
					"message": "authenticated user is invalid",
				},
			})
			return
		}

		// Platform Super Administrators have all platform permissions by definition
		roleValue, _ := c.Get(auth.ContextRoleKey)
		scopeValue, _ := c.Get(auth.ContextScopeKey)
		if role, rOk := roleValue.(string); rOk && role == "SUPER_ADMIN" {
			if scope, sOk := scopeValue.(string); sOk && scope == auth.ScopePlatform {
				c.Set(PermissionKey, code)
				c.Next()
				return
			}
		}

		if m.permissionService == nil {
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "PERMISSION_SERVICE_UNAVAILABLE",
					"message": "permission service is unavailable",
				},
			})
			return
		}

		hasPermission, err := m.permissionService.HasPermission(
			c.Request.Context(),
			userID,
			code,
		)
		if err != nil {
			if err == service.ErrInvalidUserID ||
				err == service.ErrInvalidPermissionCode {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
					"success": false,
					"error": gin.H{
						"code":    "PERMISSION_DENIED",
						"message": "permission denied",
					},
				})
				return
			}

			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "PERMISSION_CHECK_FAILED",
					"message": "failed to verify permission",
				},
			})
			return
		}

		if !hasPermission {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "PERMISSION_DENIED",
					"message": "permission denied",
				},
			})
			return
		}

		c.Set(PermissionKey, code)

		c.Next()
	}
}
