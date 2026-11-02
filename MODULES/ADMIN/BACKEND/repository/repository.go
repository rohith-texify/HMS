package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/database"
)

var (
	ErrCollegePoolNotConfigured = errors.New("admin repository: college database pool is not configured")
	ErrNilDatabase              = errors.New("admin repository: database handle cannot be nil")
)

// DBTX represents a database transaction or connection.
type DBTX interface {
	Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error)
	Query(context.Context, string, ...interface{}) (pgx.Rows, error)
	QueryRow(context.Context, string, ...interface{}) pgx.Row
}

// Repository provides data access methods for the College Admin module.
type Repository struct {
	Pool        *pgxpool.Pool
	CollegePool *pgxpool.Pool
}

type repoContextKey string

const repoTxKey repoContextKey = "admin_repo_tx"

// WithTx returns a new context with the provided transaction attached.
func WithTx(ctx context.Context, tx pgx.Tx) context.Context {
	return context.WithValue(ctx, repoTxKey, tx)
}

// TxFromContext retrieves a transaction from the context.
func TxFromContext(ctx context.Context) (pgx.Tx, bool) {
	if ctx == nil {
		return nil, false
	}
	if tx, ok := database.TxFromContext(ctx); ok && tx != nil {
		return tx, true
	}
	tx, ok := ctx.Value(repoTxKey).(pgx.Tx)
	return tx, ok && tx != nil
}

// New creates a new College Admin repository wired to the college database pool.
func New(db *database.Database) *Repository {
	if db == nil {
		return &Repository{}
	}
	return &Repository{
		Pool:        db.PlatformPool,
		CollegePool: db.CollegePool,
	}
}

// GetDB returns the active transaction from context, or falls back to CollegePool.
func (r *Repository) GetDB(ctx context.Context) (DBTX, error) {
	if tx, ok := TxFromContext(ctx); ok && tx != nil {
		return tx, nil
	}
	if r.CollegePool != nil {
		return r.CollegePool, nil
	}
	if r.Pool != nil {
		return r.Pool, nil
	}
	return nil, ErrCollegePoolNotConfigured
}

