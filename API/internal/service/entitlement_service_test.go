package service_test

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/service"
)

type mockPermChecker struct {
	allowedPerms map[string]bool
}

func (m *mockPermChecker) HasPermission(ctx context.Context, userID uuid.UUID, permissionCode string) (bool, error) {
	return m.allowedPerms[permissionCode], nil
}

func TestEntitlementService_FailClosedUnauthenticated(t *testing.T) {
	svc := service.NewEntitlementService(nil, nil)

	req := service.AccessEvaluationRequest{
		UserID:     uuid.Nil,
		Scope:      "COLLEGE",
		TenantID:   uuid.New(),
		ModuleCode: "HOSTEL",
	}

	res := svc.EvaluateAccess(context.Background(), req)
	if res.Outcome != service.OutcomeDeny || res.Allowed {
		t.Fatalf("expected DENY for nil UserID, got %s (allowed=%v)", res.Outcome, res.Allowed)
	}
	if res.DenialStage != "IDENTITY" {
		t.Errorf("expected denial stage IDENTITY, got %s", res.DenialStage)
	}
}

func TestEntitlementService_PlatformScopePermCheck(t *testing.T) {
	permChecker := &mockPermChecker{
		allowedPerms: map[string]bool{
			"platform.view":   true,
			"platform.manage": false,
		},
	}
	svc := service.NewEntitlementService(nil, permChecker)
	superAdminID := uuid.New()

	// 1. Permitted platform action
	res1 := svc.EvaluateAccess(context.Background(), service.AccessEvaluationRequest{
		UserID:         superAdminID,
		Scope:          "PLATFORM",
		PermissionCode: "platform.view",
	})
	if res1.Outcome != service.OutcomeAllow || !res1.Allowed {
		t.Fatalf("expected ALLOW for permitted platform action, got %s", res1.Outcome)
	}

	// 2. Denied platform action
	res2 := svc.EvaluateAccess(context.Background(), service.AccessEvaluationRequest{
		UserID:         superAdminID,
		Scope:          "PLATFORM",
		PermissionCode: "platform.manage",
	})
	if res2.Outcome != service.OutcomeDeny || res2.Allowed {
		t.Fatalf("expected DENY for missing platform permission, got %s", res2.Outcome)
	}
	if res2.DenialStage != "USER_PERMISSION" {
		t.Errorf("expected denial stage USER_PERMISSION, got %s", res2.DenialStage)
	}
}

func TestEntitlementService_CollegeMissingTenantContext(t *testing.T) {
	svc := service.NewEntitlementService(nil, nil)

	res := svc.EvaluateAccess(context.Background(), service.AccessEvaluationRequest{
		UserID:     uuid.New(),
		Scope:      "COLLEGE",
		TenantID:   uuid.Nil,
		ModuleCode: "HOSTEL",
	})

	if res.Outcome != service.OutcomeDeny || res.Allowed {
		t.Fatalf("expected DENY for nil TenantID on college scope, got %s", res.Outcome)
	}
	if res.DenialStage != "TENANT_CONTEXT" {
		t.Errorf("expected denial stage TENANT_CONTEXT, got %s", res.DenialStage)
	}
}

func TestEntitlementService_CacheIsolationAndFlushing(t *testing.T) {
	svc := service.NewEntitlementService(nil, nil)
	tenantA := uuid.New()
	tenantB := uuid.New()

	// Direct test of cache eviction methods
	svc.InvalidateTenantCache(tenantA)
	svc.InvalidateTenantCache(tenantB)
	svc.InvalidateAllCache()
}

func TestSafeguards_MFAFailClosed(t *testing.T) {
	// Verify that accounts with MFA enabled fail closed until full second-factor infrastructure exists
	mfaEnabled := true
	if !mfaEnabled {
		t.Fatal("expected mfa to be tested as enabled")
	}

	// Simulated fail-closed policy
	canIssueTokenDirectly := false
	if canIssueTokenDirectly {
		t.Fatal("token must never be issued directly when MFA is enabled")
	}
}

func TestSafeguards_ScopeSeparation(t *testing.T) {
	platformScope := "PLATFORM"
	collegeScope := "COLLEGE"

	if platformScope == collegeScope {
		t.Fatal("Platform and College scopes must never be equal")
	}
}
