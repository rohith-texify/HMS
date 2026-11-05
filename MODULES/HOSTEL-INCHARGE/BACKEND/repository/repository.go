package repository

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/database"
)

var (
	ErrCollegePoolNotConfigured = errors.New("hostel incharge repository: college database pool is not configured")
	ErrCollegePoolRequired      = errors.New("hostel incharge repository: college database pool is required")
	ErrNilDatabase              = errors.New("hostel incharge repository: database handle cannot be nil")
	ErrNotFound                 = errors.New("resource not found")
)

// DBTX represents a database transaction or connection.
type DBTX interface {
	Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error)
	Query(context.Context, string, ...interface{}) (pgx.Rows, error)
	QueryRow(context.Context, string, ...interface{}) pgx.Row
}

// Repository provides data access methods for the Hostel In-Charge module.
type Repository struct {
	Pool        *pgxpool.Pool
	CollegePool *pgxpool.Pool
}

type repoContextKey string

const repoTxKey repoContextKey = "incharge_repo_tx"

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

// New creates a new Hostel In-Charge repository wired to the college database pool.
func New(db *database.Database) *Repository {
	if db == nil {
		return &Repository{}
	}
	return &Repository{
		Pool:        db.PlatformPool,
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
	return &unconfiguredExecutor{err: ErrCollegePoolNotConfigured}
}

type unconfiguredExecutor struct {
	err error
}

func (u *unconfiguredExecutor) Exec(ctx context.Context, sql string, arguments ...interface{}) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, u.err
}

func (u *unconfiguredExecutor) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	return &emptyErrorRows{err: u.err}, u.err
}

func (u *unconfiguredExecutor) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	return &errorRow{err: u.err}
}

type errorRow struct {
	err error
}

func (r *errorRow) Scan(dest ...any) error {
	return r.err
}

type emptyErrorRows struct {
	err error
}

func (r *emptyErrorRows) Close()                                       {}
func (r *emptyErrorRows) Err() error                                   { return r.err }
func (r *emptyErrorRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (r *emptyErrorRows) FieldDescriptions() []pgconn.FieldDescription { return nil }
func (r *emptyErrorRows) Next() bool                                   { return false }
func (r *emptyErrorRows) Scan(dest ...any) error                       { return r.err }
func (r *emptyErrorRows) Values() ([]any, error)                       { return nil, r.err }
func (r *emptyErrorRows) RawValues() [][]byte                          { return nil }
func (r *emptyErrorRows) Conn() *pgx.Conn                              { return nil }
func (r *emptyErrorRows) TypeMap() *pgtype.Map                         { return nil }

