package database

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

func SetTenantContext(
	ctx context.Context,
	tx pgx.Tx,
) error {
	tenantID, err := RequireTenantID(ctx)
	if err != nil {
		return err
	}

	_, err = tx.Exec(
		ctx,
		"SELECT set_config('app.current_tenant_id', $1, true)",
		tenantID.String(),
	)
	if err != nil {
		return fmt.Errorf("failed to set tenant context: %w", err)
	}

	return nil
}
