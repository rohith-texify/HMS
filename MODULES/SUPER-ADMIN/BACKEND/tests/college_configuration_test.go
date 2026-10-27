package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/handlers"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/services"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/validators"
)

// -----------------------------------------------------------------------------
// FEATURE 4: COLLEGE CONFIGURATION UNIT & CONTRACT TESTS
// -----------------------------------------------------------------------------

func TestCollegeConfiguration_SettingDefinitionsRegistry(t *testing.T) {
	// Verify registry contains all 12 platform tenant settings across 3 categories
	expectedKeys := []string{
		"college_name", "logo_url", "contact_email", "contact_phone", "address",
		"timezone", "locale", "academic_year_start",
		"password_policy", "session_policy",
		"data_retention_policy", "allowed_notification_channels",
	}

	for _, key := range expectedKeys {
		def, exists := models.GetSettingDefinition(key)
		if !exists {
			t.Errorf("expected setting '%s' to exist in GlobalSettingDefinitions registry", key)
			continue
		}
		if def.Key != key {
			t.Errorf("definition key mismatch: expected %s, got %s", key, def.Key)
		}
		if def.OwnerDomain != "PLATFORM_TENANT" {
			t.Errorf("setting %s expected OwnerDomain PLATFORM_TENANT, got %s", key, def.OwnerDomain)
		}
		if def.DefaultValue == nil && key != "college_name" && key != "logo_url" && key != "contact_email" && key != "contact_phone" && key != "address" {
			t.Errorf("setting %s must have a non-nil default value", key)
		}
	}
}

func TestCollegeConfiguration_Validators_KeyAndOwnershipBoundary(t *testing.T) {
	// 1. Valid platform keys
	validKeys := []string{"timezone", "locale", "password_policy", "session_policy", "data_retention_policy"}
	for _, key := range validKeys {
		k, err := validators.ValidatePlatformSettingKey(key)
		if err != nil {
			t.Errorf("expected key '%s' to be valid, got: %v", key, err)
		}
		if k != key {
			t.Errorf("expected validated key '%s', got '%s'", key, k)
		}
	}

	// 2. Syntax validation
	invalidSyntaxKeys := []string{"", "   ", "key with space", "key/with/slash", "key$special"}
	for _, key := range invalidSyntaxKeys {
		_, err := validators.ValidateSettingKey(key)
		if err == nil {
			t.Errorf("expected syntax validation error for key '%s', got nil", key)
		}
	}

	// 3. Ownership boundary: College-owned operational settings MUST be rejected
	operationalKeys := []string{
		"curfew_time", "room_allocation_rules", "leave_approval_policy",
		"visitor_policy", "gate_pass_rules", "meal_schedule",
	}
	for _, key := range operationalKeys {
		_, err := validators.ValidatePlatformSettingKey(key)
		if err == nil {
			t.Errorf("expected ownership boundary error for operational setting '%s', got nil", key)
		}
		if !models.IsCollegeOwnedOperationalSetting(key) {
			t.Errorf("key '%s' should be flagged in CollegeOwnedOperationalSettings", key)
		}
	}

	// 4. Unknown keys rejected
	_, err := validators.ValidatePlatformSettingKey("unregistered_random_setting")
	if err == nil {
		t.Error("expected unknown key to be rejected, got nil")
	}
}

func TestCollegeConfiguration_Validators_GeneralSettings(t *testing.T) {
	// Timezone (IANA validation)
	validTimezones := []string{"Asia/Kolkata", "UTC", "America/New_York", "Europe/London"}
	for _, tz := range validTimezones {
		if err := validators.ValidateSettingValue("timezone", tz); err != nil {
			t.Errorf("expected timezone '%s' to be valid, got: %v", tz, err)
		}
	}
	invalidTimezones := []string{"Invalid/Zone", "GMT+5:30", "Asia/Mars", ""}
	for _, tz := range invalidTimezones {
		if err := validators.ValidateSettingValue("timezone", tz); err == nil {
			t.Errorf("expected invalid timezone '%s' to be rejected, got nil", tz)
		}
	}

	// Locale
	validLocales := []string{"en-IN", "hi-IN", "ta-IN", "en-US", "te-IN"}
	for _, loc := range validLocales {
		if err := validators.ValidateSettingValue("locale", loc); err != nil {
			t.Errorf("expected locale '%s' to be valid, got: %v", loc, err)
		}
	}
	invalidLocales := []string{"invalid_locale_format", "123", ""}
	for _, loc := range invalidLocales {
		if err := validators.ValidateSettingValue("locale", loc); err == nil {
			t.Errorf("expected invalid locale '%s' to be rejected, got nil", loc)
		}
	}

	// Academic year start (01-12)
	validMonths := []interface{}{"01", "06", "12", 1, 8, 12}
	for _, m := range validMonths {
		if err := validators.ValidateSettingValue("academic_year_start", m); err != nil {
			t.Errorf("expected academic year start '%v' to be valid, got: %v", m, err)
		}
	}
	invalidMonths := []interface{}{"00", "13", "99", 0, 15, "invalid"}
	for _, m := range invalidMonths {
		if err := validators.ValidateSettingValue("academic_year_start", m); err == nil {
			t.Errorf("expected invalid academic year start '%v' to be rejected, got nil", m)
		}
	}

	// Contact email
	if err := validators.ValidateSettingValue("contact_email", "admin@campus.edu"); err != nil {
		t.Errorf("expected valid email, got: %v", err)
	}
	if err := validators.ValidateSettingValue("contact_email", "invalid-email"); err == nil {
		t.Error("expected invalid email to be rejected, got nil")
	}

	// Logo URL
	if err := validators.ValidateSettingValue("logo_url", "https://campus.edu/logo.png"); err != nil {
		t.Errorf("expected valid HTTPS logo URL, got: %v", err)
	}
	if err := validators.ValidateSettingValue("logo_url", "ftp://invalid-scheme"); err == nil {
		t.Error("expected non-HTTP logo URL to be rejected, got nil")
	}
}

func TestCollegeConfiguration_Validators_SecurityFloors(t *testing.T) {
	// Password Policy Floors:
	// - min_length >= 8
	// - max_age_days <= 90
	// - require_uppercase cannot be disabled
	// - require_number cannot be disabled

	validPasswordPolicy := map[string]interface{}{
		"min_length":           12, // Stricter than floor (8) -> Allowed!
		"max_age_days":         60, // Stricter than floor (90) -> Allowed!
		"require_uppercase":    true,
		"require_lowercase":    true,
		"require_number":       true,
		"require_special_char": true,
	}
	if err := validators.ValidateSettingValue("password_policy", validPasswordPolicy); err != nil {
		t.Errorf("expected stricter password policy to be valid, got: %v", err)
	}

	// Weakening min_length (< 8) MUST be rejected
	weakLengthPolicy := map[string]interface{}{
		"min_length":   6, // Weakens company minimum floor of 8!
		"max_age_days": 90,
	}
	if err := validators.ValidateSettingValue("password_policy", weakLengthPolicy); err == nil {
		t.Error("expected password policy weakening min_length < 8 to be rejected, got nil")
	}

	// Weakening max_age_days (> 90) MUST be rejected
	weakAgePolicy := map[string]interface{}{
		"min_length":   8,
		"max_age_days": 180, // Weakens company maximum age floor of 90!
	}
	if err := validators.ValidateSettingValue("password_policy", weakAgePolicy); err == nil {
		t.Error("expected password policy weakening max_age_days > 90 to be rejected, got nil")
	}

	// Disabling uppercase MUST be rejected
	disableUpperPolicy := map[string]interface{}{
		"min_length":        8,
		"require_uppercase": false,
	}
	if err := validators.ValidateSettingValue("password_policy", disableUpperPolicy); err == nil {
		t.Error("expected disabling require_uppercase to be rejected, got nil")
	}

	// Session Policy Floors:
	// - idle_timeout_minutes <= 30
	// - absolute_timeout_hours <= 24
	// - max_concurrent_sessions: 1 to 5

	validSessionPolicy := map[string]interface{}{
		"idle_timeout_minutes":    15, // Stricter than floor (30) -> Allowed!
		"absolute_timeout_hours":  12, // Stricter than floor (24) -> Allowed!
		"max_concurrent_sessions": 2,
	}
	if err := validators.ValidateSettingValue("session_policy", validSessionPolicy); err != nil {
		t.Errorf("expected stricter session policy to be valid, got: %v", err)
	}

	// Weakening idle_timeout_minutes (> 30) MUST be rejected
	weakIdlePolicy := map[string]interface{}{
		"idle_timeout_minutes":   60, // Weakens floor!
		"absolute_timeout_hours": 24,
	}
	if err := validators.ValidateSettingValue("session_policy", weakIdlePolicy); err == nil {
		t.Error("expected idle timeout > 30 minutes to be rejected, got nil")
	}

	// Weakening absolute_timeout_hours (> 24) MUST be rejected
	weakAbsPolicy := map[string]interface{}{
		"idle_timeout_minutes":   30,
		"absolute_timeout_hours": 48, // Weakens floor!
	}
	if err := validators.ValidateSettingValue("session_policy", weakAbsPolicy); err == nil {
		t.Error("expected absolute timeout > 24 hours to be rejected, got nil")
	}

	// Invalid concurrent sessions (> 5 or < 1)
	invalidSessionsPolicy := map[string]interface{}{
		"idle_timeout_minutes":    30,
		"absolute_timeout_hours":  24,
		"max_concurrent_sessions": 10,
	}
	if err := validators.ValidateSettingValue("session_policy", invalidSessionsPolicy); err == nil {
		t.Error("expected max_concurrent_sessions > 5 to be rejected, got nil")
	}
}

func TestCollegeConfiguration_Validators_SystemSettings(t *testing.T) {
	// Data Retention Policy
	validRetention := map[string]interface{}{
		"classification":  "EXTENDED",
		"retention_years": 10,
	}
	if err := validators.ValidateSettingValue("data_retention_policy", validRetention); err != nil {
		t.Errorf("expected valid data retention policy, got: %v", err)
	}

	invalidClassification := map[string]interface{}{
		"classification":  "UNOFFICIAL_RETENTION",
		"retention_years": 7,
	}
	if err := validators.ValidateSettingValue("data_retention_policy", invalidClassification); err == nil {
		t.Error("expected invalid retention classification to be rejected, got nil")
	}

	// Notification Channels
	validChannels := []interface{}{"EMAIL", "SMS", "WHATSAPP"}
	if err := validators.ValidateSettingValue("allowed_notification_channels", validChannels); err != nil {
		t.Errorf("expected valid notification channels, got: %v", err)
	}

	invalidChannel := []interface{}{"EMAIL", "TELEGRAM"}
	if err := validators.ValidateSettingValue("allowed_notification_channels", invalidChannel); err == nil {
		t.Error("expected unsupported notification channel to be rejected, got nil")
	}

	emptyChannels := []interface{}{}
	if err := validators.ValidateSettingValue("allowed_notification_channels", emptyChannels); err == nil {
		t.Error("expected empty notification channel list to be rejected, got nil")
	}
}

func TestCollegeConfiguration_Validators_ResetAndRevert(t *testing.T) {
	// Reset: reason required, cannot be whitespace-only
	if err := validators.ValidateResetCollegeSettingRequest(&models.ResetCollegeSettingRequest{Reason: "Resetting to platform baseline"}); err != nil {
		t.Errorf("expected valid reset request, got: %v", err)
	}
	if err := validators.ValidateResetCollegeSettingRequest(&models.ResetCollegeSettingRequest{Reason: ""}); err == nil {
		t.Error("expected empty reason to be rejected, got nil")
	}
	if err := validators.ValidateResetCollegeSettingRequest(&models.ResetCollegeSettingRequest{Reason: "    \t   "}); err == nil {
		t.Error("expected whitespace-only reason to be rejected, got nil")
	}

	// Revert: AuditID required, reason required
	if err := validators.ValidateRevertCollegeSettingRequest(&models.RevertCollegeSettingRequest{
		AuditID: uuid.New(),
		Reason:  "Reverting to approved revision",
	}); err != nil {
		t.Errorf("expected valid revert request, got: %v", err)
	}
	if err := validators.ValidateRevertCollegeSettingRequest(&models.RevertCollegeSettingRequest{
		AuditID: uuid.Nil,
		Reason:  "Revert",
	}); err == nil {
		t.Error("expected nil audit ID to be rejected, got nil")
	}
	if err := validators.ValidateRevertCollegeSettingRequest(&models.RevertCollegeSettingRequest{
		AuditID: uuid.New(),
		Reason:  "   ",
	}); err == nil {
		t.Error("expected whitespace-only reason to be rejected, got nil")
	}
}

func TestCollegeConfiguration_Handlers_SecurityAndOwnershipGuards(t *testing.T) {
	svc := services.NewSettingsService(&database.Database{}, repository.New(nil))
	handler := handlers.NewSettingsHandler(svc)

	collegeID := uuid.New().String()

	// 1. Unauthenticated reset attempt -> 401 Unauthorized
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest("POST", "/colleges/"+collegeID+"/settings/timezone/reset", bytes.NewBufferString(`{"reason":"reset"}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: collegeID},
		{Key: "key", Value: "timezone"},
	}
	handler.ResetCollegeSetting(c)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected HTTP 401 Unauthorized for reset without auth, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 2. Unprivileged actor (STUDENT) reset attempt -> 403 Forbidden
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("POST", "/colleges/"+collegeID+"/settings/timezone/reset", bytes.NewBufferString(`{"reason":"reset"}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: collegeID},
		{Key: "key", Value: "timezone"},
	}
	c.Set("auth_user_id", uuid.New())
	c.Set("auth_role", "STUDENT")
	handler.ResetCollegeSetting(c)
	if w.Code != http.StatusForbidden {
		t.Fatalf("expected HTTP 403 Forbidden for reset by non-privileged actor, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 3. Unauthenticated revert attempt -> 401 Unauthorized
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("POST", "/colleges/"+collegeID+"/settings/timezone/revert", bytes.NewBufferString(`{"audit_id":"`+uuid.New().String()+`","reason":"revert"}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: collegeID},
		{Key: "key", Value: "timezone"},
	}
	handler.RevertCollegeSetting(c)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected HTTP 401 Unauthorized for revert without auth, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 4. Privileged actor attempting to reset an operational college-owned setting -> 400 Bad Request (Ownership boundary!)
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("POST", "/colleges/"+collegeID+"/settings/curfew_time/reset", bytes.NewBufferString(`{"reason":"reset"}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: collegeID},
		{Key: "key", Value: "curfew_time"},
	}
	c.Set("auth_user_id", uuid.New())
	c.Set("auth_role", "SUPER_ADMIN")
	handler.ResetCollegeSetting(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected HTTP 400 Bad Request for resetting operational setting, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 5. Privileged actor attempting to revert an operational college-owned setting -> 400 Bad Request (Ownership boundary!)
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("POST", "/colleges/"+collegeID+"/settings/room_allocation_rules/revert", bytes.NewBufferString(`{"audit_id":"`+uuid.New().String()+`","reason":"revert"}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: collegeID},
		{Key: "key", Value: "room_allocation_rules"},
	}
	c.Set("auth_user_id", uuid.New())
	c.Set("auth_role", "SUPER_ADMIN")
	handler.RevertCollegeSetting(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected HTTP 400 Bad Request for reverting operational setting, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 6. Privileged actor attempting to update a setting weakening security floors -> 400 Bad Request
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("PUT", "/colleges/"+collegeID+"/settings/password_policy", bytes.NewBufferString(`{"setting_value":{"min_length":4}}`))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Params = gin.Params{
		{Key: "id", Value: collegeID},
		{Key: "key", Value: "password_policy"},
	}
	c.Set("auth_user_id", uuid.New())
	c.Set("auth_role", "SUPER_ADMIN")
	handler.UpdateCollegeSetting(c)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected HTTP 400 Bad Request for weakening password policy floor, got %d. Body: %s", w.Code, w.Body.String())
	}

	// 7. Verify ListSettingDefinitions returns all global definitions
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest("GET", "/colleges/"+collegeID+"/settings/definitions", nil)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: collegeID}}
	handler.ListSettingDefinitions(c)
	if w.Code != http.StatusOK {
		t.Fatalf("expected HTTP 200 OK for ListSettingDefinitions, got %d. Body: %s", w.Code, w.Body.String())
	}
	var defResp struct {
		Success bool `json:"success"`
		Data    struct {
			Definitions []models.SettingDefinition `json:"definitions"`
		} `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &defResp); err != nil {
		t.Fatalf("failed to decode definitions response: %v", err)
	}
	if len(defResp.Data.Definitions) != len(models.GlobalSettingDefinitions) {
		t.Fatalf("expected %d definitions, got %d", len(models.GlobalSettingDefinitions), len(defResp.Data.Definitions))
	}
}
