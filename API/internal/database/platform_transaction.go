package database

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type platformContextKey string

const (
	platformUserIDKey platformContextKey = "platform_user_id"
	platformReasonKey platformContextKey = "platform_reason"
)

// WithPlatformUserID attaches an authenticated platform administrator UUID to the context.
func WithPlatformUserID(ctx context.Context, userID uuid.UUID) context.Context {
	return context.WithValue(ctx, platformUserIDKey, userID)
}

// PlatformUserIDFromContext retrieves the platform administrator UUID from the context.
func PlatformUserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
	uid, ok := ctx.Value(platformUserIDKey).(uuid.UUID)
	return uid, ok
}

// WithPlatformReason attaches an audit justification string to the context.
func WithPlatformReason(ctx context.Context, reason string) context.Context {
	return context.WithValue(ctx, platformReasonKey, reason)
}

// PlatformReasonFromContext retrieves the audit justification string from the context.
func PlatformReasonFromContext(ctx context.Context) (string, bool) {
	reason, ok := ctx.Value(platformReasonKey).(string)
	return reason, ok
}

// WithPlatformTransaction executes the callback within a transaction on the dedicated PlatformPool,
// enforcing transaction-local platform scope and optional platform user/audit context.
func (db *Database) WithPlatformTransaction(
	ctx context.Context,
	fn func(ctx context.Context, tx pgx.Tx) error,
) error {
	// Re-entrancy: If an active transaction already exists in context (e.g. from
	// request-scoped middleware), start a nested transaction using a SAVEPOINT.
	if existingTx, ok := TxFromContext(ctx); ok {
		subTx, err := existingTx.Begin(ctx)
		if err != nil {
			return fmt.Errorf("failed to begin nested platform transaction: %w", err)
		}

		subTxCtx := WithTx(ctx, subTx)

		if err := fn(subTxCtx, subTx); err != nil {
			if rollbackErr := subTx.Rollback(ctx); rollbackErr != nil {
				return fmt.Errorf(
					"nested platform transaction failed: %w; rollback failed: %v",
					err,
					rollbackErr,
				)
			}

			return err
		}

		if err := subTx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit nested platform transaction: %w", err)
		}

		return nil
	}

	pool := db.GetPlatformPool()
	if pool == nil {
		return fmt.Errorf("platform database pool is nil")
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin platform transaction: %w", err)
	}

	txCtx := WithTx(ctx, tx)

	// Set transaction-local platform scope
	if _, err := tx.Exec(ctx, "SELECT set_config('app.current_scope', 'PLATFORM', true)"); err != nil {
		_ = tx.Rollback(ctx)
		return fmt.Errorf("failed to set platform scope: %w", err)
	}

	// Set platform user ID if present in context
	if uid, ok := PlatformUserIDFromContext(ctx); ok && uid != uuid.Nil {
		if _, err := tx.Exec(ctx, "SELECT set_config('app.current_user_id', $1, true)", uid.String()); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to set platform user context: %w", err)
		}
	}

	// Set platform reason if present in context
	if reason, ok := PlatformReasonFromContext(ctx); ok && reason != "" {
		if _, err := tx.Exec(ctx, "SELECT set_config('app.platform_audit_reason', $1, true)", reason); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("failed to set platform audit reason: %w", err)
		}
	}

	if err := fn(txCtx, tx); err != nil {
		if rollbackErr := tx.Rollback(ctx); rollbackErr != nil {
			return fmt.Errorf(
				"platform transaction failed: %w; rollback failed: %v",
				err,
				rollbackErr,
			)
		}

		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf(
			"failed to commit platform transaction: %w",
			err,
		)
	}

	return nil
}

