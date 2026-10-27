package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
)

func TestScopeMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Platform Scope", func(t *testing.T) {
		router := gin.New()

		// Mock the JWT extraction middleware
		router.Use(func(c *gin.Context) {
			scope := c.GetHeader("X-Mock-Scope")
			if scope != "" {
				c.Set(auth.ContextScopeKey, scope)
			}
			c.Next()
		})

		router.Use(auth.RequirePlatformScope())
		router.GET("/platform", func(c *gin.Context) {
			c.Status(http.StatusOK)
		})

		tests := []struct {
			name           string
			scope          string
			expectedStatus int
		}{
			{"Missing Scope", "", http.StatusUnauthorized},
			{"College Scope", auth.ScopeCollege, http.StatusForbidden},
			{"Valid Platform Scope", auth.ScopePlatform, http.StatusOK},
		}

		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				req, _ := http.NewRequest("GET", "/platform", nil)
				if tc.scope != "" {
					req.Header.Set("X-Mock-Scope", tc.scope)
				}

				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)

				if w.Code != tc.expectedStatus {
					t.Errorf("expected %d, got %d", tc.expectedStatus, w.Code)
				}
			})
		}
	})

	t.Run("College Scope", func(t *testing.T) {
		router := gin.New()

		// Mock the JWT extraction middleware
		router.Use(func(c *gin.Context) {
			scope := c.GetHeader("X-Mock-Scope")
			if scope != "" {
				c.Set(auth.ContextScopeKey, scope)
			}
			tenant := c.GetHeader("X-Mock-Tenant")
			if tenant != "" {
				c.Set(auth.ContextTenantIDKey, uuid.New())
			}
			c.Next()
		})

		router.Use(auth.RequireCollegeScope())
		router.GET("/college", func(c *gin.Context) {
			c.Status(http.StatusOK)
		})

		tests := []struct {
			name           string
			scope          string
			hasTenant      bool
			expectedStatus int
		}{
			{"Missing Scope", "", false, http.StatusUnauthorized},
			{"Platform Scope", auth.ScopePlatform, false, http.StatusForbidden},
			{"College Scope Without Tenant", auth.ScopeCollege, false, http.StatusForbidden},
			{"Valid College Scope With Tenant", auth.ScopeCollege, true, http.StatusOK},
		}

		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				req, _ := http.NewRequest("GET", "/college", nil)
				if tc.scope != "" {
					req.Header.Set("X-Mock-Scope", tc.scope)
				}
				if tc.hasTenant {
					req.Header.Set("X-Mock-Tenant", "true")
				}

				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)

				if w.Code != tc.expectedStatus {
					t.Errorf("expected %d, got %d", tc.expectedStatus, w.Code)
				}
			})
		}
	})
}
