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
	// ErrNotFound is returned when a requested parent resource is missing.
	ErrNotFound = errors.New("parent repository: resource not found")
	// ErrConflict is returned when unique constraints or parent associations conflict.
	ErrConflict = errors.New("parent repository: conflict error")
	// ErrCollegePoolNotConfigured is returned when the database pool is missing.
	ErrCollegePoolNotConfigured = errors.New("parent repository: college database pool is not configured")
	// ErrNilDatabase is returned when constructing a repository with a nil database handle.
	ErrNilDatabase = errors.New("parent repository: database handle cannot be nil")
)

// DBTX represents a database connection or transaction.
type DBTX interface {
	Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error)
	Query(context.Context, string, ...interface{}) (pgx.Rows, error)
	QueryRow(context.Context, string, ...interface{}) pgx.Row
}

// Repository provides structured database operations for the Parent module.
type Repository struct {
	db          *database.Database
	Pool        *pgxpool.Pool
	CollegePool *pgxpool.Pool
}

type repoContextKey string

const repoTxKey repoContextKey = "parent_repo_tx"

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

// New creates a new Parent repository wired to the college database pool.
func New(db *database.Database) *Repository {
	if db == nil {
		return &Repository{}
	}
	pool := db.Pool
	if pool == nil {
		pool = db.CollegePool
	}
	return &Repository{
		db:          db,
		Pool:        pool,
		CollegePool: db.CollegePool,
	}
}

// NewWithPool creates a repository directly bound to an explicit pgxpool.Pool.
func NewWithPool(pool *pgxpool.Pool) *Repository {
	return &Repository{
		Pool:        pool,
		CollegePool: pool,
	}
}

// DB returns the underlying database handle.
func (r *Repository) DB() *database.Database {
	if r == nil {
		return nil
	}
	return r.db
}

// Executor returns the active transaction or configured database pool.
func (r *Repository) Executor(ctx context.Context) DBTX {
	if tx, ok := TxFromContext(ctx); ok && tx != nil {
		return tx
	}
	if r != nil && r.CollegePool != nil {
		return r.CollegePool
	}
	if r != nil && r.Pool != nil {
		return r.Pool
	}
	if r != nil && r.db != nil && r.db.Pool != nil {
		return r.db.Pool
	}
	return &unconfiguredExecutor{err: ErrCollegePoolNotConfigured}
}

type unconfiguredExecutor struct {
	err error
}

func (u *unconfiguredExecutor) Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, u.err
}

func (u *unconfiguredExecutor) Query(context.Context, string, ...interface{}) (pgx.Rows, error) {
	return nil, u.err
}

func (u *unconfiguredExecutor) QueryRow(context.Context, string, ...interface{}) pgx.Row {
	return &errRow{err: u.err}
}

type errRow struct {
	err error
}

func (r *errRow) Scan(...interface{}) error {
	return r.err
}

