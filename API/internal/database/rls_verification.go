package database

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

func VerifyTenantContext(ctx context.Context) error {
	expectedTenantID, err := RequireTenantID(ctx)
	if err != nil {
		return err
	}

	tx, ok := TxFromContext(ctx)
	if !ok {
		return fmt.Errorf("database transaction is not present in context")
	}

	var actualTenantID string

	err = tx.QueryRow(
		ctx,
		"SELECT app.current_tenant_id()",
	).Scan(&actualTenantID)
	if err != nil {
		return fmt.Errorf("failed to read database tenant context: %w", err)
	}

	actualTenantUUID, err := uuid.Parse(actualTenantID)
	if err != nil {
		return fmt.Errorf(
			"database returned invalid tenant ID %q: %w",
			actualTenantID,
			err,
		)
	}

	if actualTenantUUID != expectedTenantID {
		return fmt.Errorf(
			"tenant context mismatch: expected %s, got %s",
			expectedTenantID,
			actualTenantUUID,
		)
	}

	return nil
}
