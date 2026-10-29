package service

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

func TestEventDispatcher_SubscribeAndDispatch(t *testing.T) {
	logger := zap.NewNop()
	dispatcher := NewEventDispatcher(nil, logger)

	var callCount int32
	var receivedEvent PlatformEvent

	dispatcher.Subscribe(EventEntitlementChanged, func(_ context.Context, event PlatformEvent) error {
		atomic.AddInt32(&callCount, 1)
		receivedEvent = event
		return nil
	})

	tenantID := uuid.New()
	actorID := uuid.New()
	event := PlatformEvent{
		EventType:   EventEntitlementChanged,
		TenantID:    &tenantID,
		ActorUserID: &actorID,
		Metadata: map[string]interface{}{
			"module_code": "MESS",
			"action":      "ENABLED",
		},
	}

	ctx := context.Background()
	dispatcher.Dispatch(ctx, event)

	if atomic.LoadInt32(&callCount) != 1 {
		t.Errorf("expected handler to be called once, got %d", callCount)
	}
	if receivedEvent.EventType != EventEntitlementChanged {
		t.Errorf("expected event type %s, got %s", EventEntitlementChanged, receivedEvent.EventType)
	}
	if receivedEvent.TenantID == nil || *receivedEvent.TenantID != tenantID {
		t.Errorf("expected tenant ID %s, got %v", tenantID, receivedEvent.TenantID)
	}
	if receivedEvent.EventID == uuid.Nil {
		t.Errorf("expected generated event ID, got Nil")
	}
}

func TestEventDispatcher_AutomaticCacheInvalidation(t *testing.T) {
	// Initialize EntitlementService with empty pool (cache testing does not require DB)
	entSvc := &EntitlementService{
		cache:    make(map[string]cachedDecision),
		cacheTTL: 10 * time.Second,
	}

	tenantA := uuid.New()
	tenantB := uuid.New()
	user := uuid.New()

	// Seed cache entries for Tenant A and Tenant B
	keyA := entSvc.buildCacheKey(AccessEvaluationRequest{
		TenantID:   tenantA,
		UserID:     user,
		ModuleCode: "HOSTEL",
		HTTPMethod: "GET",
	})
	keyB := entSvc.buildCacheKey(AccessEvaluationRequest{
		TenantID:   tenantB,
		UserID:     user,
		ModuleCode: "HOSTEL",
		HTTPMethod: "GET",
	})

	entSvc.cache[keyA] = cachedDecision{
		result:    AccessEvaluationResult{Allowed: true},
		expiresAt: time.Now().Add(10 * time.Second),
	}
	entSvc.cache[keyB] = cachedDecision{
		result:    AccessEvaluationResult{Allowed: true},
		expiresAt: time.Now().Add(10 * time.Second),
	}

	dispatcher := NewEventDispatcher(entSvc, zap.NewNop())

	// Dispatch Entitlement Changed for Tenant A
	dispatcher.Dispatch(context.Background(), PlatformEvent{
		EventType: EventEntitlementChanged,
		TenantID:  &tenantA,
	})

	// Verify Tenant A's cache is invalidated while Tenant B's remains intact
	entSvc.cacheMu.RLock()
	_, existsA := entSvc.cache[keyA]
	_, existsB := entSvc.cache[keyB]
	entSvc.cacheMu.RUnlock()

	if existsA {
		t.Errorf("expected Tenant A cache entry to be invalidated")
	}
	if !existsB {
		t.Errorf("expected Tenant B cache entry to remain intact (tenant isolation violated)")
	}

	// Dispatch Tenant Lifecycle Changed for Tenant B (e.g. SUSPENDED)
	dispatcher.Dispatch(context.Background(), PlatformEvent{
		EventType: EventTenantLifecycleChanged,
		TenantID:  &tenantB,
	})

	entSvc.cacheMu.RLock()
	_, existsBAfter := entSvc.cache[keyB]
	entSvc.cacheMu.RUnlock()

	if existsBAfter {
		t.Errorf("expected Tenant B cache entry to be invalidated on lifecycle event")
	}
}

func TestEventDispatcher_HandlerErrorResilience(t *testing.T) {
	dispatcher := NewEventDispatcher(nil, zap.NewNop())

	var h2Called bool

	// Handler 1 returns error
	dispatcher.Subscribe(EventConfigChanged, func(_ context.Context, _ PlatformEvent) error {
		return errors.New("simulated handler failure")
	})

	// Handler 2 should still run
	dispatcher.Subscribe(EventConfigChanged, func(_ context.Context, _ PlatformEvent) error {
		h2Called = true
		return nil
	})

	dispatcher.Dispatch(context.Background(), PlatformEvent{
		EventType: EventConfigChanged,
	})

	if !h2Called {
		t.Errorf("expected second handler to execute even when first handler returns an error")
	}
}
