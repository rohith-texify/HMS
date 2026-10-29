package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestRequestIDMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name             string
		incomingHeader   string
		expectSameHeader bool
		expectValidUUID  bool
	}{
		{
			name:             "Generates fresh UUID when header is empty",
			incomingHeader:   "",
			expectSameHeader: false,
			expectValidUUID:  true,
		},
		{
			name:             "Preserves valid client request ID",
			incomingHeader:   "req-12345-abcde",
			expectSameHeader: true,
			expectValidUUID:  false,
		},
		{
			name:             "Preserves valid UUID client request ID",
			incomingHeader:   "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
			expectSameHeader: true,
			expectValidUUID:  true,
		},
		{
			name:             "Replaces excessively long request ID (> 64 chars)",
			incomingHeader:   strings.Repeat("a", 65),
			expectSameHeader: false,
			expectValidUUID:  true,
		},
		{
			name:             "Replaces request ID containing invalid characters / spaces",
			incomingHeader:   "req id with spaces and <script>",
			expectSameHeader: false,
			expectValidUUID:  true,
		},
		{
			name:             "Replaces request ID with newline / CRLF",
			incomingHeader:   "req\r\ninjection",
			expectSameHeader: false,
			expectValidUUID:  true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			router := gin.New()
			router.Use(RequestID())

			var capturedContextID string
			router.GET("/test", func(c *gin.Context) {
				capturedContextID = getRequestID(c)
				c.Status(http.StatusOK)
			})

			req, _ := http.NewRequest(http.MethodGet, "/test", nil)
			if tc.incomingHeader != "" {
				req.Header.Set(RequestIDHeader, tc.incomingHeader)
			}
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			respHeader := rec.Header().Get(RequestIDHeader)
			if respHeader == "" {
				t.Fatalf("expected non-empty response header %s", RequestIDHeader)
			}
			if respHeader != capturedContextID {
				t.Errorf("header %q does not match context %q", respHeader, capturedContextID)
			}

			if tc.expectSameHeader && respHeader != tc.incomingHeader {
				t.Errorf("expected header %q, got %q", tc.incomingHeader, respHeader)
			} else if !tc.expectSameHeader && respHeader == tc.incomingHeader {
				t.Errorf("expected header to be replaced, but got unchanged %q", respHeader)
			}

			if tc.expectValidUUID {
				if _, err := uuid.Parse(respHeader); err != nil {
					t.Errorf("expected valid UUID in response, got %q (err: %v)", respHeader, err)
				}
			}
		})
	}
}
