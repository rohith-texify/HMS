package response_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"

	apierrors "github.com/yourusername/hostel-management-system/API/pkg/errors"
	"github.com/yourusername/hostel-management-system/API/pkg/response"
)

// TestError_NoSensitiveDetailsLeakage verifies that error responses
// do not leak sensitive internal details to clients.
//
// REGRESSION TEST for: Information disclosure vulnerability where
// APIError.Details field could expose SQL errors, stack traces, or
// internal system paths.
func TestError_NoSensitiveDetailsLeakage(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name              string
		err               *apierrors.APIError
		wantCode          string
		wantMessage       string
		detailsShouldLeak bool // Whether details SHOULD be in response (they shouldn't)
	}{
		{
			name: "Error without details",
			err: apierrors.New(
				apierrors.ValidationError,
				"invalid input",
			),
			wantCode:          "VALIDATION_ERROR",
			wantMessage:       "invalid input",
			detailsShouldLeak: false,
		},
		{
			name: "Error with sensitive SQL details",
			err: apierrors.NewWithDetails(
				apierrors.InternalError,
				"database operation failed",
				map[string]interface{}{
					"sql_error": "ERROR: duplicate key value violates unique constraint \"users_email_key\"",
					"query":     "INSERT INTO app.users (email, password_hash) VALUES ($1, $2)",
					"table":     "app.users",
				},
			),
			wantCode:          "INTERNAL_ERROR",
			wantMessage:       "database operation failed",
			detailsShouldLeak: false, // CRITICAL: SQL details must NOT leak
		},
		{
			name: "Error with stack trace",
			err: apierrors.NewWithDetails(
				apierrors.InternalError,
				"unexpected panic recovered",
				map[string]interface{}{
					"stack": []string{
						"goroutine 1 [running]:",
						"main.handler(0xc0001a0000)",
						"/home/user/project/internal/handler.go:42",
					},
					"panic_value": "runtime error: invalid memory address",
				},
			),
			wantCode:          "INTERNAL_ERROR",
			wantMessage:       "unexpected panic recovered",
			detailsShouldLeak: false, // CRITICAL: Stack traces must NOT leak
		},
		{
			name: "Error with file paths",
			err: apierrors.NewWithDetails(
				apierrors.InternalError,
				"configuration error",
				map[string]interface{}{
					"config_path": "/etc/hms/secrets/database.yaml",
					"error":       "permission denied",
				},
			),
			wantCode:          "INTERNAL_ERROR",
			wantMessage:       "configuration error",
			detailsShouldLeak: false, // CRITICAL: File paths must NOT leak
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			router := gin.New()
			router.GET("/test", func(c *gin.Context) {
				c.Set("request_id", "test-request-123")
				response.Error(c, tc.err)
			})

			req, _ := http.NewRequest("GET", "/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Parse response
			var resp map[string]interface{}
			if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
				t.Fatalf("Failed to parse response: %v", err)
			}

			// Verify success is false
			if resp["success"] != false {
				t.Errorf("expected success=false, got %v", resp["success"])
			}

			// Verify request_id is included
			if resp["request_id"] == nil {
				t.Error("expected request_id to be present")
			}

			// Verify error object exists
			errObj, ok := resp["error"].(map[string]interface{})
			if !ok {
				t.Fatal("expected error object in response")
			}

			// Verify code is correct
			if errObj["code"] != tc.wantCode {
				t.Errorf("expected code=%s, got %v", tc.wantCode, errObj["code"])
			}

			// Verify message is correct
			if errObj["message"] != tc.wantMessage {
				t.Errorf("expected message=%s, got %v", tc.wantMessage, errObj["message"])
			}

			// CRITICAL SECURITY CHECK: Verify details are NOT leaked
			if details, exists := errObj["details"]; exists && details != nil {
				if !tc.detailsShouldLeak {
					t.Errorf("SECURITY ISSUE: Details field leaked to client: %+v", details)
					t.Errorf("This could expose: SQL errors, stack traces, file paths, or other sensitive information")
				}
			}
		})
	}
}

// TestError_StandardErrorCodes verifies that standard error codes
// are properly returned without modification.
func TestError_StandardErrorCodes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name     string
		err      *apierrors.APIError
		wantCode int
	}{
		{
			name:     "ValidationError returns 400",
			err:      apierrors.New(apierrors.ValidationError, "validation failed"),
			wantCode: http.StatusBadRequest,
		},
		{
			name:     "Unauthorized returns 401",
			err:      apierrors.New(apierrors.Unauthorized, "auth required"),
			wantCode: http.StatusUnauthorized,
		},
		{
			name:     "Forbidden returns 403",
			err:      apierrors.New(apierrors.Forbidden, "access denied"),
			wantCode: http.StatusForbidden,
		},
		{
			name:     "NotFound returns 404",
			err:      apierrors.New(apierrors.NotFound, "resource not found"),
			wantCode: http.StatusNotFound,
		},
		{
			name:     "Conflict returns 409",
			err:      apierrors.New(apierrors.Conflict, "resource already exists"),
			wantCode: http.StatusConflict,
		},
		{
			name:     "InternalError returns 500",
			err:      apierrors.New(apierrors.InternalError, "internal error"),
			wantCode: http.StatusInternalServerError,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			router := gin.New()
			router.GET("/test", func(c *gin.Context) {
				response.Error(c, tc.err)
			})

			req, _ := http.NewRequest("GET", "/test", nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != tc.wantCode {
				t.Errorf("expected status %d, got %d", tc.wantCode, w.Code)
			}
		})
	}
}
