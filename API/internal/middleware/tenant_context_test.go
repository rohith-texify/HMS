package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/middleware"
)

func TestTenantContextMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()

	// Mock upstream auth middleware that sets the tenant ID
	router.Use(func(c *gin.Context) {
		tenantType := c.GetHeader("X-Mock-Tenant-Type")
		if tenantType == "uuid" {
			c.Set(auth.ContextTenantIDKey, uuid.MustParse("00000000-0000-0000-0000-000000000001"))
		} else if tenantType == "string_valid" {
			c.Set(auth.ContextTenantIDKey, "00000000-0000-0000-0000-000000000002")
		} else if tenantType == "string_invalid" {
			c.Set(auth.ContextTenantIDKey, "not-a-uuid")
		} else if tenantType == "nil_uuid" {
			c.Set(auth.ContextTenantIDKey, uuid.Nil)
		}
		c.Next()
	})

	router.Use(middleware.TenantContextMiddleware())
	router.GET("/tenant-data", func(c *gin.Context) {
		val, exists := c.Get(middleware.TenantIDContextKey)
		if !exists {
			c.Status(http.StatusInternalServerError)
			return
		}

		id, ok := val.(uuid.UUID)
		if !ok || id == uuid.Nil {
			c.Status(http.StatusInternalServerError)
			return
		}

		c.Status(http.StatusOK)
	})

	tests := []struct {
		name           string
		tenantType     string
		expectedStatus int
	}{
		{"Missing Tenant Context", "", http.StatusUnauthorized},
		{"Valid Tenant Context (UUID)", "uuid", http.StatusOK},
		{"Valid Tenant Context (String)", "string_valid", http.StatusOK},
		{"Invalid Tenant Context (Malformed String)", "string_invalid", http.StatusUnauthorized},
		{"Invalid Tenant Context (Nil UUID)", "nil_uuid", http.StatusUnauthorized},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/tenant-data", nil)
			if tc.tenantType != "" {
				req.Header.Set("X-Mock-Tenant-Type", tc.tenantType)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != tc.expectedStatus {
				t.Errorf("expected %d, got %d", tc.expectedStatus, w.Code)
			}
		})
	}
}
