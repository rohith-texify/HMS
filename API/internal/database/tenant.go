package database

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

type tenantContextKey string

const tenantIDKey tenantContextKey = "tenant_id"

func WithTenantID(ctx context.Context, tenantID uuid.UUID) context.Context {
	return context.WithValue(ctx, tenantIDKey, tenantID)
}

func TenantIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	tenantID, ok := ctx.Value(tenantIDKey).(uuid.UUID)
	return tenantID, ok
}

func RequireTenantID(ctx context.Context) (uuid.UUID, error) {
	tenantID, ok := TenantIDFromContext(ctx)
	if !ok || tenantID == uuid.Nil {
		return uuid.Nil, fmt.Errorf("tenant ID is missing from request context")
	}

	return tenantID, nil
}
