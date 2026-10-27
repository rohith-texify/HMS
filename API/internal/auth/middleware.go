package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const (
	ContextClaimsKey   = "auth_claims"
	ContextUserIDKey   = "auth_user_id"
	ContextTenantIDKey = "auth_tenant_id"
	ContextRoleKey     = "auth_role"
	ContextScopeKey    = "auth_scope"
)

func NewMiddleware(jwtService *JWTService) *Middleware {
	return &Middleware{
		jwt: jwtService,
	}
}

type Middleware struct {
	jwt *JWTService
}

func (m *Middleware) RequireAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))

		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "UNAUTHORIZED",
					"message": "authorization header is required",
				},
			})
			return
		}

		parts := strings.Fields(authHeader)

		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "UNAUTHORIZED",
					"message": "invalid authorization header",
				},
			})
			return
		}

		claims, err := m.jwt.ValidateAccessToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "UNAUTHORIZED",
					"message": "invalid or expired access token",
				},
			})
			return
		}

		userID, err := uuid.Parse(claims.Subject)
		if err != nil || userID == uuid.Nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "UNAUTHORIZED",
					"message": "access token contains an invalid user ID",
				},
			})
			return
		}

		c.Set(ContextClaimsKey, claims)
		c.Set(ContextUserIDKey, userID)
		c.Set(ContextRoleKey, claims.Role)
		c.Set(ContextScopeKey, claims.Scope)

		if claims.TenantID != nil {
			c.Set(ContextTenantIDKey, *claims.TenantID)
		}

		c.Next()
	}
}
