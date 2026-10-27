package middleware_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
	"github.com/yourusername/hostel-management-system/API/internal/middleware"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type MockPermissionService struct {
	HasPermissionFunc func(ctx context.Context, userID uuid.UUID, permissionCode string) (bool, error)
}

func (m *MockPermissionService) HasPermission(ctx context.Context, userID uuid.UUID, permissionCode string) (bool, error) {
	if m.HasPermissionFunc != nil {
		return m.HasPermissionFunc(ctx, userID, permissionCode)
	}
	return false, nil
}

func TestPermissionMiddleware_Unit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// We use nil for the permissionService in this first router to test the 500 error boundary
	nilServiceMiddleware := middleware.NewPermissionMiddleware(nil)

	// We use a mock service for the other tests to bypass Postgres
	mockService := &MockPermissionService{}
	activeMiddleware := middleware.NewPermissionMiddleware(mockService)

	setupRouter := func(mw *middleware.PermissionMiddleware) *gin.Engine {
		router := gin.New()

		router.Use(func(c *gin.Context) {
			authType := c.GetHeader("X-Mock-Auth")
			if authType == "valid" {
				c.Set(auth.ContextUserIDKey, uuid.MustParse("00000000-0000-0000-0000-000000000003"))
			} else if authType == "invalid_type" {
				c.Set(auth.ContextUserIDKey, "not-a-uuid")
			} else if authType == "nil_uuid" {
				c.Set(auth.ContextUserIDKey, uuid.Nil)
			}
			c.Next()
		})

		router.Use(mw.RequirePermission("test:action"))
		router.GET("/restricted", func(c *gin.Context) {
			c.Status(http.StatusOK)
		})
		return router
	}

	t.Run("Authentication Context Missing", func(t *testing.T) {
		router := setupRouter(nilServiceMiddleware)
		req, _ := http.NewRequest("GET", "/restricted", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected %d, got %d", http.StatusUnauthorized, w.Code)
		}
	})

	t.Run("Invalid Authentication Context", func(t *testing.T) {
		router := setupRouter(nilServiceMiddleware)
		req, _ := http.NewRequest("GET", "/restricted", nil)
		req.Header.Set("X-Mock-Auth", "invalid_type")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusUnauthorized {
			t.Errorf("expected %d, got %d", http.StatusUnauthorized, w.Code)
		}
	})

	t.Run("Unavailable Dependency returns 500", func(t *testing.T) {
		router := setupRouter(nilServiceMiddleware)
		req, _ := http.NewRequest("GET", "/restricted", nil)
		req.Header.Set("X-Mock-Auth", "valid")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusInternalServerError {
			t.Errorf("expected %d, got %d", http.StatusInternalServerError, w.Code)
		}
	})

	t.Run("Insufficient Permission returns 403", func(t *testing.T) {
		router := setupRouter(activeMiddleware)
		mockService.HasPermissionFunc = func(ctx context.Context, userID uuid.UUID, permissionCode string) (bool, error) {
			return false, nil // Denied
		}

		req, _ := http.NewRequest("GET", "/restricted", nil)
		req.Header.Set("X-Mock-Auth", "valid")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusForbidden {
			t.Errorf("expected %d, got %d", http.StatusForbidden, w.Code)
		}
	})

	t.Run("Sufficient Permission proceeds to handler", func(t *testing.T) {
		router := setupRouter(activeMiddleware)
		mockService.HasPermissionFunc = func(ctx context.Context, userID uuid.UUID, permissionCode string) (bool, error) {
			return true, nil // Allowed
		}

		req, _ := http.NewRequest("GET", "/restricted", nil)
		req.Header.Set("X-Mock-Auth", "valid")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected %d, got %d", http.StatusOK, w.Code)
		}
	})

	t.Run("Service returns explicitly tracked Domain Error", func(t *testing.T) {
		router := setupRouter(activeMiddleware)
		mockService.HasPermissionFunc = func(ctx context.Context, userID uuid.UUID, permissionCode string) (bool, error) {
			return false, service.ErrInvalidPermissionCode
		}

		req, _ := http.NewRequest("GET", "/restricted", nil)
		req.Header.Set("X-Mock-Auth", "valid")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// The middleware is explicitly designed to map domain errors to 403 Forbidden
		if w.Code != http.StatusForbidden {
			t.Errorf("expected %d, got %d", http.StatusForbidden, w.Code)
		}
	})

	t.Run("Service returns unexpected error", func(t *testing.T) {
		router := setupRouter(activeMiddleware)
		mockService.HasPermissionFunc = func(ctx context.Context, userID uuid.UUID, permissionCode string) (bool, error) {
			return false, errors.New("database connection failed")
		}

		req, _ := http.NewRequest("GET", "/restricted", nil)
		req.Header.Set("X-Mock-Auth", "valid")
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		// The middleware maps unexpected system errors to 500
		if w.Code != http.StatusInternalServerError {
			t.Errorf("expected %d, got %d", http.StatusInternalServerError, w.Code)
		}
	})
}
