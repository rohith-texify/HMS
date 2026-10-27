package database

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	internaldb "github.com/yourusername/hostel-management-system/API/internal/database"
)

// Database exposes the API database type to other project modules.
type Database = internaldb.Database

// TxFromContext returns the transaction stored in the request context.
func TxFromContext(ctx context.Context) (pgx.Tx, bool) {
	return internaldb.TxFromContext(ctx)
}

// WithPlatformUserID attaches an authenticated platform administrator UUID to the context.
func WithPlatformUserID(ctx context.Context, userID uuid.UUID) context.Context {
	return internaldb.WithPlatformUserID(ctx, userID)
}

// PlatformUserIDFromContext retrieves the platform administrator UUID from the context.
func PlatformUserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	return internaldb.PlatformUserIDFromContext(ctx)
}

// WithPlatformReason attaches an audit justification string to the context.
func WithPlatformReason(ctx context.Context, reason string) context.Context {
	return internaldb.WithPlatformReason(ctx, reason)
}

// PlatformReasonFromContext retrieves the audit justification string from the context.
func PlatformReasonFromContext(ctx context.Context) (string, bool) {
	return internaldb.PlatformReasonFromContext(ctx)
}

