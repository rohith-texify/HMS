package middleware_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/yourusername/hostel-management-system/API/internal/middleware"
)

func TestTenantTransactionMiddleware_NilPool_Returns500(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	router.Use(middleware.TenantTransactionMiddleware(nil))
	router.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req, _ := http.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected 500, got %d", w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to parse json response: %v", err)
	}

	if response["success"] != false {
		t.Errorf("expected success=false, got %v", response["success"])
	}

	errObj, ok := response["error"].(map[string]interface{})
	if !ok || errObj["code"] != "DATABASE_POOL_NIL" {
		t.Errorf("expected error code DATABASE_POOL_NIL, got %v", errObj)
	}
}
