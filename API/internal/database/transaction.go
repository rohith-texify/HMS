package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

func (db *Database) WithTransaction(
	ctx context.Context,
	fn func(ctx context.Context, tx pgx.Tx) error,
) error {
	// Re-entrancy: If an active transaction already exists in context (e.g. from
	// request-scoped middleware), start a pseudo-nested transaction using a SAVEPOINT.
	// This prevents checking out a second connection from the pool and eliminates
	// nested transaction connection deadlocks.
	if existingTx, ok := TxFromContext(ctx); ok {
		subTx, err := existingTx.Begin(ctx)
		if err != nil {
			return fmt.Errorf("failed to begin nested transaction: %w", err)
		}

		subTxCtx := WithTx(ctx, subTx)

		if err := fn(subTxCtx, subTx); err != nil {
			if rollbackErr := subTx.Rollback(ctx); rollbackErr != nil {
				return fmt.Errorf(
					"nested transaction failed: %w; rollback failed: %v",
					err,
					rollbackErr,
				)
			}

			return err
		}

		if err := subTx.Commit(ctx); err != nil {
			return fmt.Errorf("failed to commit nested transaction: %w", err)
		}

		return nil
	}

	tx, err := db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	txCtx := WithTx(ctx, tx)

	if err := SetTenantContext(txCtx, tx); err != nil {
		if rollbackErr := tx.Rollback(ctx); rollbackErr != nil {
			return fmt.Errorf(
				"failed to set tenant context: %w; rollback failed: %v",
				err,
				rollbackErr,
			)
		}

		return err
	}

	if err := fn(txCtx, tx); err != nil {
		if rollbackErr := tx.Rollback(ctx); rollbackErr != nil {
			return fmt.Errorf(
				"transaction failed: %w; rollback failed: %v",
				err,
				rollbackErr,
			)
		}

		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
