package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/internal/database"
)

type DBTX interface {
	Exec(
		context.Context,
		string,
		...interface{},
	) (pgconn.CommandTag, error)

	Query(
		context.Context,
		string,
		...interface{},
	) (pgx.Rows, error)

	QueryRow(
		context.Context,
		string,
		...interface{},
	) pgx.Row
}

type Repository struct {
	Pool         *pgxpool.Pool
	PlatformPool *pgxpool.Pool
}

func New(db *database.Database) *Repository {
	if db == nil {
		return &Repository{}
	}
	return &Repository{
		Pool:         db.GetCollegePool(),
		PlatformPool: db.GetPlatformPool(),
	}
}

func (r *Repository) Executor(ctx context.Context) DBTX {
	if tx, ok := database.TxFromContext(ctx); ok {
		return tx
	}

	// Guard against direct pool queries when tenant context is active.
	// In a multi-tenant system with Row-Level Security, executing queries directly on the
	// connection pool when a tenant ID is present bypasses transaction-local tenant context
	// (SELECT set_config('app.current_tenant_id', ...)), causing queries to evaluate with
	// NULL tenant context. If no transaction is active, fail closed immediately.
	if tenantID, ok := database.TenantIDFromContext(ctx); ok && tenantID != uuid.Nil {
		return &unprotectedTenantGuardExecutor{
			tenantID: tenantID,
		}
	}

	return r.Pool
}

type unprotectedTenantGuardExecutor struct {
	tenantID uuid.UUID
}

func (g *unprotectedTenantGuardExecutor) Exec(
	ctx context.Context,
	sql string,
	arguments ...interface{},
) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, fmt.Errorf(
		"tenant-scoped query attempted without active transaction for tenant %s: transaction context is required",
		g.tenantID,
	)
}

func (g *unprotectedTenantGuardExecutor) Query(
	ctx context.Context,
	sql string,
	args ...interface{},
) (pgx.Rows, error) {
	return nil, fmt.Errorf(
		"tenant-scoped query attempted without active transaction for tenant %s: transaction context is required",
		g.tenantID,
	)
}

func (g *unprotectedTenantGuardExecutor) QueryRow(
	ctx context.Context,
	sql string,
	args ...interface{},
) pgx.Row {
	return &guardErrorRow{
		err: fmt.Errorf(
			"tenant-scoped query attempted without active transaction for tenant %s: transaction context is required",
			g.tenantID,
		),
	}
}

type guardErrorRow struct {
	err error
}

func (e *guardErrorRow) Scan(dest ...interface{}) error {
	return e.err
}
