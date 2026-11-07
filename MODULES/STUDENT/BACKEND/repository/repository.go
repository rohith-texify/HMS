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
	ErrCollegePoolNotConfigured = errors.New("student repository: college database pool is not configured")
	ErrCollegePoolRequired      = errors.New("student repository: college database pool is required")
	ErrNilDatabase              = errors.New("student repository: database handle cannot be nil")
	ErrNotFound                 = errors.New("resource not found")
	ErrStudentNotFound          = errors.New("student record not found for authenticated user")
)

// DBTX represents a database transaction or connection.
type DBTX interface {
	Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error)
	Query(context.Context, string, ...interface{}) (pgx.Rows, error)
	QueryRow(context.Context, string, ...interface{}) pgx.Row
}

// Repository provides data access methods for the Student self-service module.
type Repository struct {
	db          *database.Database
	Pool        *pgxpool.Pool
	CollegePool *pgxpool.Pool
}

type repoContextKey string

const repoTxKey repoContextKey = "student_repo_tx"

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

// New creates a new student repository instance.
func New(db *database.Database) *Repository {
	if db == nil {
		panic(ErrNilDatabase)
	}

	collegePool := db.GetCollegePool()
	if collegePool == nil {
		panic(ErrCollegePoolRequired)
	}

	return &Repository{
		db:          db,
		Pool:        collegePool,
		CollegePool: collegePool,
	}
}

// getDB returns the active transaction if present, otherwise the connection pool.
func (r *Repository) getDB(ctx context.Context) DBTX {
	if tx, ok := TxFromContext(ctx); ok {
		return tx
	}
	if r.CollegePool != nil {
		return r.CollegePool
	}
	return r.Pool
}

