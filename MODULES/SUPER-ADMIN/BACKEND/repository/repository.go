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
	// ErrPlatformPoolNotConfigured indicates that the Super Admin repository
	// was instantiated without a valid platform database pool and an operation
	// was attempted outside of an active transaction.
	ErrPlatformPoolNotConfigured = errors.New("super admin repository: platform database pool is not configured")

	// ErrPlatformPoolRequired indicates that an explicit platform pool is required
	// during validated repository construction.
	ErrPlatformPoolRequired = errors.New("super admin repository: platform database pool is required")

	// ErrNilDatabase indicates that a nil database handle was passed to the constructor.
	ErrNilDatabase = errors.New("super admin repository: database handle cannot be nil")
)

// DBTX represents a database transaction or connection.
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

// Repository provides data access methods for the Super Admin module.
type Repository struct {
	Pool        *pgxpool.Pool
	CollegePool *pgxpool.Pool
}

type repoContextKey string

const repoTxKey repoContextKey = "super_admin_repo_tx"

// WithTx returns a new context with the provided transaction attached.
// This allows callers and tests within the Super Admin module to attach
// a transaction directly to context.
func WithTx(ctx context.Context, tx pgx.Tx) context.Context {
	return context.WithValue(ctx, repoTxKey, tx)
}

// TxFromContext retrieves a transaction from the context, checking first
// the global database context key and then the Super Admin module context key.
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

// New creates a new Super Admin repository wired to the platform database pool.
//
// Security & Compatibility:
// To prevent cross-tenant security breaches, New will NEVER silently fall back
// to db.Pool (the primary/college tenant pool) when db.PlatformPool is absent.
// If db is nil or db.PlatformPool is nil, the repository is created in an
// unconfigured state, and any non-transactional database operation will fail
// safely with ErrPlatformPoolNotConfigured rather than routing platform
// control-plane queries through a tenant database pool.
//
// For fail-fast construction that returns an explicit error at application startup,
// prefer NewValidated(db) or NewWithPlatformPool(pool).
func New(db *database.Database) *Repository {
	if db == nil || db.PlatformPool == nil {
		return &Repository{}
	}
	return &Repository{
		Pool:        db.PlatformPool,
		CollegePool: db.GetCollegePool(),
	}
}

// NewValidated constructs a Repository strictly requiring a valid Database handle
// with an initialized PlatformPool. Returns an error if db is nil or PlatformPool
// is absent, enabling fail-fast construction during server startup.
func NewValidated(db *database.Database) (*Repository, error) {
	if db == nil {
		return nil, ErrNilDatabase
	}
	if db.PlatformPool == nil {
		return nil, ErrPlatformPoolRequired
	}
	return &Repository{
		Pool:        db.PlatformPool,
		CollegePool: db.GetCollegePool(),
	}, nil
}

// NewWithPlatformPool constructs a Repository strictly requiring a non-nil platform pool.
func NewWithPlatformPool(pool *pgxpool.Pool) (*Repository, error) {
	if pool == nil {
		return nil, ErrPlatformPoolRequired
	}
	return &Repository{
		Pool: pool,
	}, nil
}

// NewWithPool creates a repository directly bound to an explicit pgxpool.Pool.
// This is preserved for tests or specialized runners that hold a verified
// platform pool handle. If pool is nil, the repository is created in an
// unconfigured state that fails safely with ErrPlatformPoolNotConfigured.
func NewWithPool(pool *pgxpool.Pool) *Repository {
	return &Repository{
		Pool: pool,
	}
}

// ExecUsers executes an SQL statement on app.users, using the active transaction/pool,
// with an automatic fallback to CollegePool if the platform connection pool encounters
// PostgreSQL permission error SQLSTATE 42501 (permission denied for table users).
func (r *Repository) ExecUsers(ctx context.Context, sql string, arguments ...interface{}) (pgconn.CommandTag, error) {
	tag, err := r.Executor(ctx).Exec(ctx, sql, arguments...)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "42501" && r.CollegePool != nil {
			return r.CollegePool.Exec(ctx, sql, arguments...)
		}
	}
	return tag, err
}

// QueryRowUsers executes a query returning a single row on app.users, using the active transaction/pool,
// with an automatic fallback to CollegePool if the platform connection pool encounters
// PostgreSQL permission error SQLSTATE 42501 (permission denied for table users).
func (r *Repository) QueryRowUsers(ctx context.Context, sql string, arguments ...interface{}) pgx.Row {
	return &usersRowWrapper{
		ctx:         ctx,
		sql:         sql,
		args:        arguments,
		executorRow: r.Executor(ctx).QueryRow(ctx, sql, arguments...),
		collegePool: r.CollegePool,
	}
}

type usersRowWrapper struct {
	ctx         context.Context
	sql         string
	args        []interface{}
	executorRow pgx.Row
	collegePool *pgxpool.Pool
}

func (w *usersRowWrapper) Scan(dest ...any) error {
	err := w.executorRow.Scan(dest...)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "42501" && w.collegePool != nil {
			return w.collegePool.QueryRow(w.ctx, w.sql, w.args...).Scan(dest...)
		}
	}
	return err
}

// Executor returns the appropriate database executor (transaction or pool).
// If an active transaction exists in context, it is returned.
// Otherwise, the configured platform pool is returned. If the platform pool
// is nil or unconfigured, it returns a safe error-producing executor that
// rejects operations with ErrPlatformPoolNotConfigured instead of panicking
// or falling back to an untrusted pool.
func (r *Repository) Executor(ctx context.Context) DBTX {
	if tx, ok := TxFromContext(ctx); ok && tx != nil {
		return tx
	}

	if r == nil || r.Pool == nil {
		return &unconfiguredExecutor{err: ErrPlatformPoolNotConfigured}
	}

	return r.Pool
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
