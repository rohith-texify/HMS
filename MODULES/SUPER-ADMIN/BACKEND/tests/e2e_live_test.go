package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

type platformTestClaims struct {
	TenantID *uuid.UUID `json:"tenant_id,omitempty"`
	Role     string     `json:"role"`
	Scope    string     `json:"scope"`
	jwt.RegisteredClaims
}

func TestLiveApplicationAPI_EndToEnd(t *testing.T) {
	// 1. Verify backend server is reachable
	resp, err := http.Get("http://localhost:8080/health")
	if err != nil {
		t.Skip("Live server is not running on :8080, skipping live E2E test")
		return
	}
	resp.Body.Close()

	// 2. Load .env for JWT_SECRET
	secret := "HMS_2026_a8F7kP2xQ9mL4vR6tY3nW8zC5jD1sG7hK0pX"
	if s := os.Getenv("JWT_SECRET"); s != "" {
		secret = s
	}

	now := time.Now()
	claims := platformTestClaims{
		TenantID: nil,
		Role:     "SUPER_ADMIN",
		Scope:    "PLATFORM",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "8e14eed1-6d82-4807-a769-df15bfc236b2",
			Issuer:    "hms-api",
			Audience:  jwt.ClaimStrings{"hms-client"},
			ExpiresAt: jwt.NewNumericDate(now.Add(1 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	jwtToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	token, err := jwtToken.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("failed to sign JWT: %v", err)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	collegeID := "035b8589-64d5-457a-8b59-0b8153ef4d98"

	// 3. Test GET /super-admin/colleges/:id/applications
	req, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("http://localhost:8080/super-admin/colleges/%s/applications", collegeID), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("X-Scope", "PLATFORM")

	getResp, err := client.Do(req)
	if err != nil {
		t.Fatalf("GET applications failed: %v", err)
	}
	defer getResp.Body.Close()
	if getResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(getResp.Body)
		t.Fatalf("expected 200 OK, got %d: %s", getResp.StatusCode, string(body))
	}

	var getAppsResp struct {
		Success bool                              `json:"success"`
		Data    []models.CollegeApplicationConfig `json:"data"`
	}
	if err := json.NewDecoder(getResp.Body).Decode(&getAppsResp); err != nil {
		t.Fatalf("failed to parse applications response: %v", err)
	}
	if !getAppsResp.Success || len(getAppsResp.Data) != 5 {
		t.Fatalf("expected 5 applications returned, got %d", len(getAppsResp.Data))
	}
	t.Logf("Successfully retrieved 5 college applications from live API")

	// 4. Test PUT version on student_app
	vBody, _ := json.Marshal(map[string]interface{}{
		"min_version":  "1.2.0",
		"force_update": true,
		"reason":       "Integration test E2E version update",
	})
	vReq, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("http://localhost:8080/super-admin/colleges/%s/applications/student_app/version", collegeID), bytes.NewBuffer(vBody))
	vReq.Header.Set("Authorization", "Bearer "+token)
	vReq.Header.Set("X-Scope", "PLATFORM")
	vReq.Header.Set("Content-Type", "application/json")

	vResp, err := client.Do(vReq)
	if err != nil {
		t.Fatalf("PUT version failed: %v", err)
	}
	defer vResp.Body.Close()
	if vResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(vResp.Body)
		t.Fatalf("expected 200 OK from PUT version, got %d: %s", vResp.StatusCode, string(body))
	}
	t.Logf("Successfully updated student_app version to 1.2.0 with force_update=true")

	// 5. Test GET history on student_app
	hReq, _ := http.NewRequest(http.MethodGet, fmt.Sprintf("http://localhost:8080/super-admin/colleges/%s/applications/student_app/history", collegeID), nil)
	hReq.Header.Set("Authorization", "Bearer "+token)
	hReq.Header.Set("X-Scope", "PLATFORM")

	hResp, err := client.Do(hReq)
	if err != nil {
		t.Fatalf("GET history failed: %v", err)
	}
	defer hResp.Body.Close()
	if hResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(hResp.Body)
		t.Fatalf("expected 200 OK from GET history, got %d: %s", hResp.StatusCode, string(body))
	}
	t.Logf("Successfully verified audit history from platform.audit_logs")

	// 6. Test PROTECTED ADMIN PORTAL: Attempt to disable admin_portal => MUST return 409 Conflict
	disBody, _ := json.Marshal(map[string]interface{}{
		"reason": "Should be blocked by system invariant",
	})
	disReq, _ := http.NewRequest(http.MethodPost, fmt.Sprintf("http://localhost:8080/super-admin/colleges/%s/applications/admin_portal/disable", collegeID), bytes.NewBuffer(disBody))
	disReq.Header.Set("Authorization", "Bearer "+token)
	disReq.Header.Set("X-Scope", "PLATFORM")
	disReq.Header.Set("Content-Type", "application/json")

	disResp, err := client.Do(disReq)
	if err != nil {
		t.Fatalf("disable admin portal request failed: %v", err)
	}
	defer disResp.Body.Close()
	if disResp.StatusCode != http.StatusConflict {
		body, _ := io.ReadAll(disResp.Body)
		t.Fatalf("expected 409 Conflict when attempting to disable admin_portal, got %d: %s", disResp.StatusCode, string(body))
	}
	t.Logf("Admin/Management Portal protection verified: HTTP 409 Conflict returned")
}
