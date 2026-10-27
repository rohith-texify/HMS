package server_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/API/internal/auth"
	superadminroutes "github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/routes"
)

// TestSuperAdmin_RouteRegistration verifies that canonical Super Admin routes
// are properly mounted under /super-admin without duplication.
func TestSuperAdmin_RouteRegistration(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()

	passMiddleware := func(c *gin.Context) { c.Next() }

	db := &database.Database{}

	// Register canonical routes
	superAdminGroup := router.Group("/super-admin")
	superadminroutes.RegisterSuperAdminRoutes(
		router.Group(""), // Group passes down /super-admin
		db,
		passMiddleware,
		passMiddleware,
	)
	_ = superAdminGroup

	// Verify registered routes
	routes := router.Routes()
	if len(routes) == 0 {
		t.Fatalf("expected registered routes, got 0")
	}

	registeredPaths := make(map[string]int)
	expectedPrefixes := []string{
		"/super-admin/colleges",
		"/super-admin/approvals",
		"/super-admin/modules",
	}

	for _, route := range routes {
		key := route.Method + " " + route.Path
		registeredPaths[key]++

		// Assert no duplicate method + path registration
		if registeredPaths[key] > 1 {
			t.Errorf("duplicate route detected: %s", key)
		}
	}

	// Verify that each expected domain prefix has registered routes
	for _, prefix := range expectedPrefixes {
		found := false
		for path := range registeredPaths {
			if strings.Contains(path, prefix) {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected at least one route matching prefix %s", prefix)
		}
	}
}

// TestSuperAdmin_PlatformScopeEnforcement ensures that /super-admin routes strictly
// require platform scope and reject college tokens or unauthenticated requests.
func TestSuperAdmin_PlatformScopeEnforcement(t *testing.T) {
	gin.SetMode(gin.TestMode)

	secret := "test-secret-that-is-32-bytes-long-minimum"
	jwtService := auth.NewJWTService(secret, "test-issuer", "test-audience", 15*time.Minute)
	authMiddleware := auth.NewMiddleware(jwtService)

	userID := uuid.New()
	tenantID := uuid.New()

	platformToken, err := jwtService.GeneratePlatformAccessToken(userID, "super_admin")
	if err != nil {
		t.Fatalf("failed to generate platform token: %v", err)
	}

	collegeToken, err := jwtService.GenerateCollegeAccessToken(userID, tenantID, "college_admin")
	if err != nil {
		t.Fatalf("failed to generate college token: %v", err)
	}

	router := gin.New()
	platformProtected := router.Group("/")
	platformProtected.Use(
		authMiddleware.RequireAuth(),
		auth.RequirePlatformScope(),
	)

	// Mock endpoint simulating canonical Super Admin route
	platformProtected.GET("/super-admin/colleges", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// 1. Unauthenticated request -> 401 Unauthorized
	reqNoAuth, _ := http.NewRequest("GET", "/super-admin/colleges", nil)
	wNoAuth := httptest.NewRecorder()
	router.ServeHTTP(wNoAuth, reqNoAuth)
	if wNoAuth.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for unauthenticated request, got %d", wNoAuth.Code)
	}

	// 2. College token on platform route -> 403 Forbidden
	reqCollege, _ := http.NewRequest("GET", "/super-admin/colleges", nil)
	reqCollege.Header.Set("Authorization", "Bearer "+collegeToken)
	wCollege := httptest.NewRecorder()
	router.ServeHTTP(wCollege, reqCollege)
	if wCollege.Code != http.StatusForbidden {
		t.Errorf("expected 403 for college token on platform route, got %d", wCollege.Code)
	}

	// 3. Platform token on platform route -> 200 OK
	reqPlatform, _ := http.NewRequest("GET", "/super-admin/colleges", nil)
	reqPlatform.Header.Set("Authorization", "Bearer "+platformToken)
	wPlatform := httptest.NewRecorder()
	router.ServeHTTP(wPlatform, reqPlatform)
	if wPlatform.Code != http.StatusOK {
		t.Errorf("expected 200 for platform token on platform route, got %d", wPlatform.Code)
	}
}

// TestCollege_PlatformTokenRejection ensures that college routes strictly require
// college scope and reject platform tokens.
func TestCollege_PlatformTokenRejection(t *testing.T) {
	gin.SetMode(gin.TestMode)

	secret := "test-secret-that-is-32-bytes-long-minimum"
	jwtService := auth.NewJWTService(secret, "test-issuer", "test-audience", 15*time.Minute)
	authMiddleware := auth.NewMiddleware(jwtService)

	userID := uuid.New()
	platformToken, err := jwtService.GeneratePlatformAccessToken(userID, "super_admin")
	if err != nil {
		t.Fatalf("failed to generate platform token: %v", err)
	}

	router := gin.New()
	collegeProtected := router.Group("/college")
	collegeProtected.Use(
		authMiddleware.RequireAuth(),
		auth.RequireCollegeScope(),
	)

	collegeProtected.GET("/students", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"success": true})
	})

	// Platform token on college route must be rejected with 403 Forbidden
	req, _ := http.NewRequest("GET", "/college/students", nil)
	req.Header.Set("Authorization", "Bearer "+platformToken)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("expected 403 for platform token on college route, got %d", w.Code)
	}
}
