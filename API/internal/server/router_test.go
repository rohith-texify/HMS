package server_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

// We can mock the router structure to test global constraints like MaxBytesReader and JSON binding.
// Since router.NewRouter requires DB, we'll test the constraints by creating a minimal gin router
// mimicking the body limits enforced in router.go for strict unit testing.

func TestRouter_BodySizeLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	// Mimic the exact middleware from router.go
	router.Use(func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 1<<20) // 1 MB
		c.Next()
	})

	router.POST("/upload", func(c *gin.Context) {
		// Just read body to trigger maxbytesreader limit
		var payload map[string]interface{}
		err := c.ShouldBindJSON(&payload)
		if err != nil {
			c.Status(http.StatusRequestEntityTooLarge)
			return
		}
		c.Status(http.StatusOK)
	})

	// 1. Valid request (< 1MB)
	smallBody := []byte(`{"data":"test"}`)
	req1, _ := http.NewRequest("POST", "/upload", bytes.NewBuffer(smallBody))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Errorf("expected 200 for small body, got %d", w1.Code)
	}

	// 2. Oversized request (> 1MB)
	// Create a payload larger than 1MB
	largeString := strings.Repeat("a", (1<<20)+100)
	largeBody := []byte(`{"data":"` + largeString + `"}`)
	req2, _ := http.NewRequest("POST", "/upload", bytes.NewBuffer(largeBody))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("expected 413 for oversized body, got %d", w2.Code)
	}
}

func TestRouter_MalformedJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	router.POST("/data", func(c *gin.Context) {
		var payload struct {
			Field string `json:"field"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.AbortWithStatus(http.StatusBadRequest)
			return
		}
		c.Status(http.StatusOK)
	})

	// Valid JSON
	req1, _ := http.NewRequest("POST", "/data", bytes.NewBuffer([]byte(`{"field":"value"}`)))
	req1.Header.Set("Content-Type", "application/json")
	w1 := httptest.NewRecorder()
	router.ServeHTTP(w1, req1)
	if w1.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w1.Code)
	}

	// Malformed JSON (syntax error)
	req2, _ := http.NewRequest("POST", "/data", bytes.NewBuffer([]byte(`{"field": "value"`)))
	req2.Header.Set("Content-Type", "application/json")
	w2 := httptest.NewRecorder()
	router.ServeHTTP(w2, req2)
	if w2.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for malformed json, got %d", w2.Code)
	}
}
