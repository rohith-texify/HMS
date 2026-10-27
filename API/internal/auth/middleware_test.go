package auth_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/auth"
)

func TestAuthMiddleware_JWTValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	secret := "this-is-a-strong-test-secret-32b"
	jwtService := auth.NewJWTService(secret, "test-issuer", "test-audience", 15*time.Minute)
	middleware := auth.NewMiddleware(jwtService)

	router := gin.New()
	router.Use(middleware.RequireAuth())
	router.GET("/protected", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	userID := uuid.New()
	tenantID := uuid.New()

	// 1. Valid token
	validToken, _ := jwtService.GenerateCollegeAccessToken(userID, tenantID, "student")

	// 2. Expired token
	expiredService := auth.NewJWTService(secret, "test-issuer", "test-audience", -1*time.Minute)
	expiredToken, _ := expiredService.GenerateCollegeAccessToken(userID, tenantID, "student")

	// 3. Incorrectly signed token
	wrongSecretService := auth.NewJWTService("wrong-secret-that-is-different", "test-issuer", "test-audience", 15*time.Minute)
	wrongSecretToken, _ := wrongSecretService.GenerateCollegeAccessToken(userID, tenantID, "student")

	// 4. Unsupported algorithm (None)
	noneAlgToken, _ := jwt.NewWithClaims(jwt.SigningMethodNone, jwt.MapClaims{
		"sub": userID.String(),
		"exp": time.Now().Add(time.Hour).Unix(),
	}).SignedString(jwt.UnsafeAllowNoneSignatureType)

	tests := []struct {
		name           string
		authHeader     string
		expectedStatus int
	}{
		{"Missing Header", "", http.StatusUnauthorized},
		{"Malformed Header", "Bearer", http.StatusUnauthorized},
		{"Malformed Token", "Bearer invalid.token.format", http.StatusUnauthorized},
		{"Expired Token", "Bearer " + expiredToken, http.StatusUnauthorized},
		{"Incorrect Signature", "Bearer " + wrongSecretToken, http.StatusUnauthorized},
		{"Unsupported Algorithm", "Bearer " + noneAlgToken, http.StatusUnauthorized},
		{"Valid Token", "Bearer " + validToken, http.StatusOK},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req, _ := http.NewRequest("GET", "/protected", nil)
			if tc.authHeader != "" {
				req.Header.Set("Authorization", tc.authHeader)
			}

			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			if w.Code != tc.expectedStatus {
				t.Errorf("expected %d, got %d", tc.expectedStatus, w.Code)
			}
		})
	}
}
