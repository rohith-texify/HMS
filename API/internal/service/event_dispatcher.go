package service

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Supported canonical platform event types per Capability 24 C1.
const (
	EventEntitlementChanged      = "entitlement.changed"
	EventConfigChanged           = "config.changed"
	EventStructureChanged        = "structure.changed"
	EventTenantLifecycleChanged  = "tenant.lifecycle_changed"
)

// PlatformEvent represents an in-process domain change event.
//
// NOTE: This event provides IN-PROCESS, BEST-EFFORT delivery only.
// Multi-instance distributed event propagation and durable delivery
// are BLOCKED by missing message broker / transactional outbox infrastructure.
type PlatformEvent struct {
	EventID     uuid.UUID              `json:"event_id"`
	EventType   string                 `json:"event_type"`
	TenantID    *uuid.UUID             `json:"tenant_id,omitempty"`
	ActorUserID *uuid.UUID             `json:"actor_user_id,omitempty"`
	Timestamp   time.Time              `json:"timestamp"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// EventHandlerFunc is a callback invoked when a platform event is dispatched.
type EventHandlerFunc func(ctx context.Context, event PlatformEvent) error

// EventDispatcher provides thread-safe in-process event publication and subscription.
type EventDispatcher struct {
	mu          sync.RWMutex
	handlers    map[string][]EventHandlerFunc
	entitlement *EntitlementService
	logger      *zap.Logger
}

// NewEventDispatcher initializes an in-process platform event dispatcher.
func NewEventDispatcher(entitlement *EntitlementService, logger *zap.Logger) *EventDispatcher {
	dispatcher := &EventDispatcher{
		handlers:    make(map[string][]EventHandlerFunc),
		entitlement: entitlement,
		logger:      logger,
	}

	// Register built-in cache invalidation handlers
	dispatcher.registerBuiltInHandlers()

	return dispatcher
}

// registerBuiltInHandlers wires automatic cache invalidation for tenant lifecycle and entitlement events.
func (d *EventDispatcher) registerBuiltInHandlers() {
	if d.entitlement == nil {
		return
	}

	// Invalidate tenant entitlement cache when entitlements change
	d.Subscribe(EventEntitlementChanged, func(_ context.Context, event PlatformEvent) error {
		if event.TenantID != nil && *event.TenantID != uuid.Nil {
			d.entitlement.InvalidateTenantCache(*event.TenantID)
			if d.logger != nil {
				d.logger.Info(
					"invalidated entitlement cache on event",
					zap.String("event_type", event.EventType),
					zap.String("tenant_id", event.TenantID.String()),
				)
			}
		} else {
			d.entitlement.InvalidateAllCache()
		}
		return nil
	})

	// Invalidate tenant entitlement cache when tenant status changes (e.g. SUSPENDED, DEACTIVATED)
	d.Subscribe(EventTenantLifecycleChanged, func(_ context.Context, event PlatformEvent) error {
		if event.TenantID != nil && *event.TenantID != uuid.Nil {
			d.entitlement.InvalidateTenantCache(*event.TenantID)
			if d.logger != nil {
				d.logger.Info(
					"invalidated tenant cache on lifecycle change",
					zap.String("event_type", event.EventType),
					zap.String("tenant_id", event.TenantID.String()),
				)
			}
		}
		return nil
	})
}

// Subscribe registers an in-process handler function for a specific event type.
func (d *EventDispatcher) Subscribe(eventType string, handler EventHandlerFunc) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.handlers[eventType] = append(d.handlers[eventType], handler)
}

// Dispatch synchronously executes all registered handlers for the given event.
// Handlers are invoked in order. Any handler error is logged but does not stop
// remaining handlers from running (fail-safe best-effort dispatch).
func (d *EventDispatcher) Dispatch(ctx context.Context, event PlatformEvent) {
	if event.EventID == uuid.Nil {
		event.EventID = uuid.New()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now().UTC()
	}

	d.mu.RLock()
	handlers := append([]EventHandlerFunc(nil), d.handlers[event.EventType]...)
	d.mu.RUnlock()

	for _, h := range handlers {
		if err := h(ctx, event); err != nil && d.logger != nil {
			d.logger.Error(
				"event handler failed during in-process dispatch",
				zap.String("event_type", event.EventType),
				zap.String("event_id", event.EventID.String()),
				zap.Error(err),
			)
		}
	}
}
