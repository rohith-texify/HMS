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
	// ErrNilDatabase indicates a nil database handle was passed.
	ErrNilDatabase = errors.New("hostel incharge repository: database handle cannot be nil")

	// ErrNotFound is returned when a requested record is not found.
	ErrNotFound = errors.New("hostel incharge record not found")
)

// DBTX represents a database transaction or connection.
type DBTX interface {
	Exec(context.Context, string, ...interface{}) (pgconn.CommandTag, error)
	Query(context.Context, string, ...interface{}) (pgx.Rows, error)
	QueryRow(context.Context, string, ...interface{}) pgx.Row
}

// Repository provides data access methods for the Hostel Incharge module.
type Repository struct {
	db *database.Database
}

// New creates a new Hostel Incharge repository instance.
func New(db *database.Database) *Repository {
	return &Repository{db: db}
}

// DB returns the underlying database handle.
func (r *Repository) DB() *database.Database {
	return r.db
}

// Pool returns the default connection pool.
func (r *Repository) Pool() *pgxpool.Pool {
	if r.db == nil {
		return nil
	}
	return r.db.Pool
}

// Executor returns the active transaction from context if available, otherwise the standard pool.
func (r *Repository) Executor(ctx context.Context) DBTX {
	if tx, ok := database.TxFromContext(ctx); ok {
		return tx
	}
	if r.db == nil {
		return nil
	}
	return r.db.Pool
}
