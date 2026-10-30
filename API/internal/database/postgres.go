package database

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/internal/config"
)

type Database struct {
	// Pool is the primary/college application pool, preserved for backward compatibility.
	Pool *pgxpool.Pool
	// CollegePool connects via the restricted college application role (hms_college_app).
	CollegePool *pgxpool.Pool
	// PlatformPool connects via the restricted platform control-plane role (hms_platform_app).
	PlatformPool *pgxpool.Pool
}

func New(ctx context.Context, cfg config.DatabaseConfig) (*Database, error) {
	// 1. Build College Application Pool (hms_college_app)
	collegeUser := cfg.CollegeUser
	if collegeUser == "" {
		collegeUser = cfg.User
	}
	collegePassword := cfg.CollegePassword
	if collegePassword == "" {
		collegePassword = cfg.Password
	}
	collegeMaxConns := cfg.CollegeMaxConns
	if collegeMaxConns <= 0 {
		collegeMaxConns = cfg.MaxConns
	}
	collegeMinConns := cfg.CollegeMinConns
	if collegeMinConns <= 0 {
		collegeMinConns = cfg.MinConns
	}

	collegePool, err := createPool(ctx, cfg, collegeUser, collegePassword, collegeMaxConns, collegeMinConns)
	if err != nil {
		return nil, fmt.Errorf("failed to create college database pool: %w", err)
	}

	if err := collegePool.Ping(ctx); err != nil {
		collegePool.Close()
		return nil, fmt.Errorf("failed to ping college database pool: %w", err)
	}

	// 2. Build Platform Control-Plane Pool (hms_platform_app)
	platformUser := cfg.PlatformUser
	if platformUser == "" {
		platformUser = cfg.User
	}
	platformPassword := cfg.PlatformPassword
	if platformPassword == "" {
		platformPassword = cfg.Password
	}
	platformMaxConns := cfg.PlatformMaxConns
	if platformMaxConns <= 0 {
		platformMaxConns = 5
	}
	platformMinConns := cfg.PlatformMinConns
	if platformMinConns <= 0 {
		platformMinConns = 1
	}

	platformPool, err := createPool(ctx, cfg, platformUser, platformPassword, platformMaxConns, platformMinConns)
	if err != nil {
		// Clean up already initialized collegePool on partial failure
		collegePool.Close()
		return nil, fmt.Errorf("failed to create platform database pool: %w", err)
	}

	if err := platformPool.Ping(ctx); err != nil {
		// Clean up both pools on partial failure
		platformPool.Close()
		collegePool.Close()
		return nil, fmt.Errorf("failed to ping platform database pool: %w", err)
	}

	// Log successful platform pool initialization
	fmt.Printf("[DB-INIT] Platform pool initialized successfully for user %q\n", platformUser)

	// Idempotently ensure hms_platform_app possesses DML privileges on app.users for Super Admin provisioning
	_, _ = collegePool.Exec(ctx, `
		DO $$
		BEGIN
			IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hms_platform_app') THEN
				GRANT USAGE ON SCHEMA app TO hms_platform_app;
				GRANT SELECT, INSERT, UPDATE, DELETE ON app.users TO hms_platform_app;
			END IF;
		END
		$$;
	`)

	return &Database{
		Pool:         collegePool,
		CollegePool:  collegePool,
		PlatformPool: platformPool,
	}, nil
}

func createPool(
	ctx context.Context,
	cfg config.DatabaseConfig,
	user, password string,
	maxConns, minConns int32,
) (*pgxpool.Pool, error) {
	connConfig, err := pgx.ParseConfig("")
	if err != nil {
		return nil, fmt.Errorf("failed to initialize PostgreSQL configuration: %w", err)
	}

	trimmedUser := strings.TrimSpace(user)
	trimmedHost := strings.TrimSpace(cfg.Host)
	trimmedPort := strings.TrimSpace(cfg.Port)
	trimmedDBName := strings.TrimSpace(cfg.Name)
	trimmedSSLMode := strings.TrimSpace(cfg.SSLMode)

	// Safe diagnostic: Print quoted representation and byte codes of the username (NO secrets).
	fmt.Printf("[DB-INIT] Initializing pool for user %q (len=%d, bytes=%v) at %s:%s/%s\n",
		trimmedUser, len(trimmedUser), []byte(trimmedUser), trimmedHost, trimmedPort, trimmedDBName)

	connConfig.Host = trimmedHost
	connConfig.Port = parsePort(trimmedPort)
	connConfig.Database = trimmedDBName
	connConfig.User = trimmedUser
	connConfig.Password = password
	connConfig.TLSConfig = nil

	// Disable TLS for local development when DB_SSLMODE=disable.
	if trimmedSSLMode != "disable" {
		connConfig, err = pgx.ParseConfig(
			fmt.Sprintf(
				"postgres://%s@%s:%s/%s?sslmode=%s",
				url.QueryEscape(trimmedUser),
				trimmedHost,
				trimmedPort,
				trimmedDBName,
				trimmedSSLMode,
			),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to configure PostgreSQL TLS: %w", err)
		}

		connConfig.Password = password
	}

	poolConfig, err := pgxpool.ParseConfig("")
	if err != nil {
		return nil, fmt.Errorf("failed to create PostgreSQL pool configuration: %w", err)
	}

	poolConfig.ConnConfig = connConfig
	poolConfig.MaxConns = maxConns
	poolConfig.MinConns = minConns
	poolConfig.MaxConnLifetime = time.Duration(cfg.MaxConnLifetime) * time.Minute
	poolConfig.MaxConnIdleTime = time.Duration(cfg.MaxConnIdleTime) * time.Minute

	connectTimeout := time.Duration(cfg.ConnectTimeoutSeconds) * time.Second
	if connectTimeout <= 0 {
		connectTimeout = 45 * time.Second
	}
	poolConfig.ConnConfig.ConnectTimeout = connectTimeout

	queryTimeoutMs := cfg.QueryTimeoutSeconds * 1000
	if queryTimeoutMs <= 0 {
		queryTimeoutMs = 60000 // default 60s
	}
	if poolConfig.ConnConfig.RuntimeParams == nil {
		poolConfig.ConnConfig.RuntimeParams = make(map[string]string)
	}
	poolConfig.ConnConfig.RuntimeParams["statement_timeout"] = fmt.Sprintf("%d", queryTimeoutMs)

	// Neon DB: Optimize connection pool for Neon's connection management
	// Neon closes idle connections after 5 minutes, so set lower idle timeout
	// Also handle channel_binding parameter from Neon connection strings
	if strings.Contains(trimmedHost, "neon.tech") {
		poolConfig.MaxConnIdleTime = 4 * time.Minute
		poolConfig.MaxConnLifetime = 10 * time.Minute
		
		// Neon pooler requires channel_binding - pgx handles this automatically
		// but we log it for diagnostics
		fmt.Printf("[DB-INIT] Neon DB detected: Using optimized pool settings (4min idle, 10min lifetime, channel_binding support)\n")
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	return pool, nil
}

func parsePort(port string) uint16 {
	var value uint16

	for _, char := range port {
		value = value*10 + uint16(char-'0')
	}

	return value
}

// GetCollegePool returns the dedicated college tenant connection pool.
func (db *Database) GetCollegePool() *pgxpool.Pool {
	if db == nil {
		return nil
	}
	if db.CollegePool != nil {
		return db.CollegePool
	}
	return db.Pool
}

// GetPlatformPool returns the dedicated platform control-plane connection pool.
func (db *Database) GetPlatformPool() *pgxpool.Pool {
	if db == nil {
		return nil
	}
	if db.PlatformPool != nil {
		return db.PlatformPool
	}
	return db.Pool
}

// Close gracefully closes all active database pools.
func (db *Database) Close() {
	if db == nil {
		return
	}

	// Close platform pool if distinct from college pool
	if db.PlatformPool != nil && db.PlatformPool != db.CollegePool && db.PlatformPool != db.Pool {
		db.PlatformPool.Close()
	}

	// Close college pool
	if db.CollegePool != nil {
		db.CollegePool.Close()
	}

	// Close legacy pool if distinct
	if db.Pool != nil && db.Pool != db.CollegePool && db.Pool != db.PlatformPool {
		db.Pool.Close()
	}
}

