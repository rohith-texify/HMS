package middleware_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap/zaptest"

	"github.com/yourusername/hostel-management-system/API/internal/middleware"
)

func TestRecoveryMiddleware_ErrorLeakage(t *testing.T) {
	gin.SetMode(gin.TestMode)
	logger := zaptest.NewLogger(t)

	router := gin.New()
	router.Use(middleware.Recovery(logger))

	router.GET("/panic", func(c *gin.Context) {
		panic("CRITICAL_DATABASE_SECRET_XYZ123")
	})

	req, _ := http.NewRequest("GET", "/panic", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}

	// Verify the response body DOES NOT contain the sensitive panic message
	body := w.Body.String()
	if bytes.Contains(w.Body.Bytes(), []byte("CRITICAL_DATABASE_SECRET_XYZ123")) {
		t.Errorf("error recovery leaked sensitive panic message to client: %s", body)
	}

	// Verify it contains a generic, safe error instead
	if !bytes.Contains(w.Body.Bytes(), []byte("an unexpected internal server error occurred")) {
		t.Errorf("expected generic error message, got: %s", body)
	}
}

func TestRecoveryMiddleware_PreservesRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	logger := zaptest.NewLogger(t)

	router := gin.New()
	router.Use(middleware.RequestID())
	router.Use(middleware.Recovery(logger))

	router.GET("/panic-with-id", func(c *gin.Context) {
		panic("test panic with request id")
	})

	req, _ := http.NewRequest("GET", "/panic-with-id", nil)
	req.Header.Set("X-Request-ID", "custom-req-id-777")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}

	body := w.Body.String()
	if !bytes.Contains(w.Body.Bytes(), []byte("custom-req-id-777")) {
		t.Errorf("expected response to preserve request ID custom-req-id-777, got: %s", body)
	}
}
