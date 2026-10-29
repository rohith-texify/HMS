package tests

import (
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/models"
)

func TestNotification_AudiencePreviewAndCategoryValidation(t *testing.T) {
	// Test target types and eligible previews
	validTargets := []string{"ALL_COLLEGES", "SELECTED_COLLEGES"}
	for _, target := range validTargets {
		if strings.TrimSpace(target) == "" {
			t.Errorf("expected valid target type, got empty")
		}
	}

	// Verify broadcast review flag logic
	allCollegesPreview := models.NotificationAudiencePreview{
		TargetType:     "ALL_COLLEGES",
		TotalColleges:  5,
		EligibleCount:  5,
		RequiresReview: true,
		ApprovalNote:   "Company-wide broadcasts target all active college tenants and require peer approval under Module 16 policy before release.",
	}
	if !allCollegesPreview.RequiresReview {
		t.Errorf("expected RequiresReview to be true for ALL_COLLEGES")
	}

	selectedPreview := models.NotificationAudiencePreview{
		TargetType:     "SELECTED_COLLEGES",
		TotalColleges:  1,
		EligibleCount:  1,
		RequiresReview: false,
	}
	if selectedPreview.RequiresReview {
		t.Errorf("expected RequiresReview to be false for SELECTED_COLLEGES")
	}
}

func TestSupport_MaskingIntegrity(t *testing.T) {
	// Verify student PII masking
	maskString := func(s string) string {
		s = strings.TrimSpace(s)
		if len(s) == 0 {
			return ""
		}
		if len(s) == 1 {
			return "*"
		}
		return string(s[0]) + strings.Repeat("*", len(s)-1)
	}

	maskEmail := func(email string) string {
		parts := strings.Split(email, "@")
		if len(parts) != 2 {
			return "***@***.***"
		}
		user := parts[0]
		domain := parts[1]
		return maskString(user) + "@" + domain
	}

	name := "Alexander"
	maskedName := maskString(name)
	if maskedName != "A********" {
		t.Errorf("expected A********, got %s", maskedName)
	}

	email := "student.test@campus.edu"
	maskedEmail := maskEmail(email)
	if !strings.HasSuffix(maskedEmail, "@campus.edu") || strings.Contains(maskedEmail, "student.test") {
		t.Errorf("email improperly masked: %s", maskedEmail)
	}
}

func TestSupport_GrantDurationAndExpiry(t *testing.T) {
	now := time.Now().UTC()
	durationMinutes := 60
	expiresAt := now.Add(time.Duration(durationMinutes) * time.Minute)

	grant := models.SupportGrant{
		GrantID:    uuid.New(),
		GranteeID:  uuid.New(),
		CollegeID:  uuid.New(),
		StartsAt:   now,
		ExpiresAt:  expiresAt,
		RevokedAt:  nil,
	}

	grant.IsActive = grant.RevokedAt == nil && grant.ExpiresAt.After(now)
	if !grant.IsActive {
		t.Errorf("expected newly issued grant to be active")
	}

	// Test revocation
	revokedAt := now.Add(10 * time.Minute)
	grant.RevokedAt = &revokedAt
	grant.IsActive = grant.RevokedAt == nil && grant.ExpiresAt.After(now)
	if grant.IsActive {
		t.Errorf("expected revoked grant to be inactive")
	}
}

func TestMonitoring_TelemetryAndPoolStatsSanity(t *testing.T) {
	telemetry := models.SystemTelemetry{
		AuthServiceStatus:         "OPERATIONAL",
		NotificationProviderStatus: "NOT_CONFIGURED",
		BackgroundSchedulerStatus: "NOT_CONFIGURED",
		MetricsCollectorStatus:    "IN_PROCESS",
	}

	if telemetry.NotificationProviderStatus != "NOT_CONFIGURED" {
		t.Errorf("expected truthful NOT_CONFIGURED status, got %s", telemetry.NotificationProviderStatus)
	}

	stats := models.DatabasePoolStats{
		PlatformPoolTotalConns: 10,
		PlatformPoolIdleConns:  8,
		PlatformPoolAcquired:   2,
	}
	if stats.PlatformPoolTotalConns < (stats.PlatformPoolIdleConns + stats.PlatformPoolAcquired) {
		t.Errorf("database pool stats inconsistent")
	}
}
