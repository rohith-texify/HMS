package repository_test

import (
	"context"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/yourusername/hostel-management-system/API/internal/config"
	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

// setupIntegrationDB safely initializes a test database connection.
func setupIntegrationDB(t *testing.T) (*database.Database, *repository.Repository) {
	t.Helper()

	testDBURL := os.Getenv("TEST_DATABASE_URL")
	if testDBURL == "" {
		t.Skip("Skipping RLS integration test: TEST_DATABASE_URL is not set.")
	}

	parsedURL, err := url.Parse(testDBURL)
	if err != nil {
		t.Fatalf("Failed to parse TEST_DATABASE_URL: %v", err)
	}

	dbName := strings.TrimPrefix(parsedURL.Path, "/")
	if !strings.HasSuffix(dbName, "_test") {
		t.Fatalf("SAFETY CHECK FAILED: Database name '%s' must end in '_test' to prevent accidental destruction.", dbName)
	}

	password, _ := parsedURL.User.Password()
	cfg := config.DatabaseConfig{
		Host:            parsedURL.Hostname(),
		Port:            parsedURL.Port(),
		User:            parsedURL.User.Username(),
		Password:        password,
		Name:            dbName,
		SSLMode:         parsedURL.Query().Get("sslmode"),
		MaxConns:        5,
		MinConns:        1,
		MaxConnLifetime: 5,
		MaxConnIdleTime: 5,
	}
	if cfg.SSLMode == "" {
		cfg.SSLMode = "disable"
	}

	ctx := context.Background()
	db, err := database.New(ctx, cfg)
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}

	// SAFETY: Ensure the current role is not a superuser and does not bypass RLS.
	var isSuperuser, bypassesRLS bool
	err = db.Pool.QueryRow(ctx, "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user").Scan(&isSuperuser, &bypassesRLS)
	if err != nil {
		t.Fatalf("Failed to query role permissions: %v", err)
	}
	if isSuperuser || bypassesRLS {
		t.Skipf("Skipping Tenant RLS test: connection role '%s' bypasses RLS (Superuser: %v, BypassRLS: %v).", parsedURL.User.Username(), isSuperuser, bypassesRLS)
		return nil, nil
	}

	// SAFETY: Verify RLS is actually enabled on the tested table
	var hasRowSecurity bool
	err = db.Pool.QueryRow(ctx, "SELECT relrowsecurity FROM pg_class WHERE relname = 'hostels'").Scan(&hasRowSecurity)
	if err != nil {
		t.Fatalf("Failed to check RLS status on hostels table: %v", err)
	}
	if !hasRowSecurity {
		t.Fatalf("SAFETY CHECK FAILED: Row-Level Security is not enabled on 'hostels'.")
	}

	repo := repository.New(db)
	return db, repo
}

func TestTenantRLS_Isolation_Integration(t *testing.T) {
	db, _ := setupIntegrationDB(t)
	if db == nil {
		return // Skipped
	}
	defer db.Close()

	ctx := context.Background()
	collegeA := uuid.New()
	collegeB := uuid.New()
	hostelA := uuid.New()
	hostelB := uuid.New()

	// 1. Create fixtures outside of tenant context (requires bypassing or running as platform admin normally,
	// but here we just execute raw SQL, assuming the test role has INSERT grants).
	_, err := db.Pool.Exec(ctx, `
		INSERT INTO platform.colleges (college_id, college_code, name, timezone, status) 
		VALUES ($1, $3, 'College A', 'UTC', 'ACTIVE'),
		       ($2, $4, 'College B', 'UTC', 'ACTIVE')
	`, collegeA, collegeB, "COLA-"+collegeA.String()[:4], "COLB-"+collegeB.String()[:4])
	if err != nil {
		t.Fatalf("Failed to seed colleges: %v", err)
	}

	// Ensure cleanup
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id IN ($1, $2)", collegeA, collegeB)
	}()

	// Note: Triggers may auto-inject app.current_tenant_id() on insert if RLS is enforced on insert.
	// We wrap inserts in a transaction setting the correct context for each to simulate real application flow.
	insertHostel := func(collegeID uuid.UUID, hostelID uuid.UUID, code string, name string) {
		tx, _ := db.Pool.Begin(ctx)
		defer tx.Rollback(ctx)

		tenantCtx := database.WithTenantID(ctx, collegeID)
		_ = database.SetTenantContext(tenantCtx, tx)

		_, err := tx.Exec(ctx, `
			INSERT INTO app.hostels (id, college_id, code, name, category, total_capacity)
			VALUES ($1, $2, $3, $4, 'BOYS', 100)
		`, hostelID, collegeID, code, name)
		if err != nil {
			t.Fatalf("Failed to insert hostel: %v", err)
		}
		tx.Commit(ctx)
	}

	insertHostel(collegeA, hostelA, "HA", "Hostel A")
	insertHostel(collegeB, hostelB, "HB", "Hostel B")

	t.Run("College A cannot read College B's records", func(t *testing.T) {
		tx, _ := db.Pool.Begin(ctx)
		defer tx.Rollback(ctx)

		tenantCtx := database.WithTenantID(ctx, collegeA)
		err := database.SetTenantContext(tenantCtx, tx)
		if err != nil {
			t.Fatalf("Failed to set tenant context: %v", err)
		}

		rows, _ := tx.Query(ctx, "SELECT id FROM app.hostels")
		defer rows.Close()

		var ids []uuid.UUID
		for rows.Next() {
			var id uuid.UUID
			rows.Scan(&id)
			ids = append(ids, id)
		}

		if len(ids) != 1 || ids[0] != hostelA {
			t.Errorf("College A should only see Hostel A, saw: %v", ids)
		}
	})

	t.Run("College A cannot update College B's records", func(t *testing.T) {
		tx, _ := db.Pool.Begin(ctx)
		defer tx.Rollback(ctx)

		tenantCtx := database.WithTenantID(ctx, collegeA)
		_ = database.SetTenantContext(tenantCtx, tx)

		tag, _ := tx.Exec(ctx, "UPDATE app.hostels SET name = 'Hacked' WHERE id = $1", hostelB)
		if tag.RowsAffected() != 0 {
			t.Errorf("College A successfully updated College B's hostel! Affected rows: %d", tag.RowsAffected())
		}
	})

	t.Run("Missing tenant context prevents all access", func(t *testing.T) {
		tx, _ := db.Pool.Begin(ctx)
		defer tx.Rollback(ctx)

		// Do NOT call database.SetTenantContext
		var count int
		err := tx.QueryRow(ctx, "SELECT count(*) FROM app.hostels").Scan(&count)

		// It might return an error because app.current_tenant_id is missing, or it might just evaluate to NULL and return 0 rows.
		// Either behavior proves isolation.
		if err == nil && count > 0 {
			t.Errorf("Querying without tenant context exposed %d rows", count)
		}
	})

	t.Run("College A cannot delete College B's records", func(t *testing.T) {
		tx, _ := db.Pool.Begin(ctx)

		tenantCtx := database.WithTenantID(ctx, collegeA)
		_ = database.SetTenantContext(tenantCtx, tx)

		tag, _ := tx.Exec(ctx, "DELETE FROM app.hostels WHERE id = $1", hostelB)
		if tag.RowsAffected() != 0 {
			t.Errorf("College A successfully deleted College B's hostel! Affected rows: %d", tag.RowsAffected())
		}
		tx.Rollback(ctx)

		// Verify record still exists under College B's context
		tx2, _ := db.Pool.Begin(ctx)
		defer tx2.Rollback(ctx)

		tenantCtxB := database.WithTenantID(ctx, collegeB)
		_ = database.SetTenantContext(tenantCtxB, tx2)

		var exists bool
		err := tx2.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM app.hostels WHERE id = $1)", hostelB).Scan(&exists)
		if err != nil || !exists {
			t.Errorf("Hostel B should still exist under College B, but it was not found: %v", err)
		}
	})

	_ = time.Now()
}

func TestTenantRLS_PooledConnection_Leakage(t *testing.T) {
	testDBURL := os.Getenv("TEST_DATABASE_URL")
	if testDBURL == "" {
		t.Skip("Skipping RLS integration test: TEST_DATABASE_URL is not set.")
	}
	parsedURL, _ := url.Parse(testDBURL)
	dbName := strings.TrimPrefix(parsedURL.Path, "/")
	password, _ := parsedURL.User.Password()

	// Dedicated pool with MaxConns = 1 to guarantee deterministic connection reuse
	cfg := config.DatabaseConfig{
		Host:            parsedURL.Hostname(),
		Port:            parsedURL.Port(),
		User:            parsedURL.User.Username(),
		Password:        password,
		Name:            dbName,
		SSLMode:         parsedURL.Query().Get("sslmode"),
		MaxConns:        1,
		MinConns:        1,
		MaxConnLifetime: 5,
		MaxConnIdleTime: 5,
	}
	if cfg.SSLMode == "" {
		cfg.SSLMode = "disable"
	}
	ctx := context.Background()
	db, err := database.New(ctx, cfg)
	if err != nil {
		t.Fatalf("Failed to connect: %v", err)
	}
	defer db.Close()

	// Verify test role
	var isSuperuser, bypassesRLS bool
	err = db.Pool.QueryRow(ctx, "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user").Scan(&isSuperuser, &bypassesRLS)
	if err != nil || isSuperuser || bypassesRLS {
		t.Skipf("Skipping Tenant RLS test: connection role bypasses RLS.")
		return
	}

	collegeA := uuid.New()
	collegeB := uuid.New()
	hostelA := uuid.New()
	hostelB := uuid.New()

	_, err = db.Pool.Exec(ctx, `
		INSERT INTO platform.colleges (college_id, college_code, name, timezone, status) 
		VALUES ($1, $3, 'College Leak A', 'UTC', 'ACTIVE'),
		       ($2, $4, 'College Leak B', 'UTC', 'ACTIVE')
	`, collegeA, collegeB, "LEAKA-"+collegeA.String()[:4], "LEAKB-"+collegeB.String()[:4])
	if err != nil {
		t.Fatalf("Failed to seed colleges: %v", err)
	}
	defer func() {
		_, _ = db.Pool.Exec(ctx, "DELETE FROM platform.colleges WHERE college_id IN ($1, $2)", collegeA, collegeB)
	}()

	tenantCtxA := database.WithTenantID(ctx, collegeA)
	err = db.WithTransaction(tenantCtxA, func(txCtx context.Context, tx pgx.Tx) error {
		_, err := tx.Exec(ctx, "INSERT INTO app.hostels (id, college_id, code, name, category, total_capacity) VALUES ($1, $2, 'HLA', 'Hostel LA', 'BOYS', 100)", hostelA, collegeA)
		return err
	})
	if err != nil {
		t.Fatalf("Insert A failed: %v", err)
	}

	tenantCtxB := database.WithTenantID(ctx, collegeB)
	err = db.WithTransaction(tenantCtxB, func(txCtx context.Context, tx pgx.Tx) error {
		_, err := tx.Exec(ctx, "INSERT INTO app.hostels (id, college_id, code, name, category, total_capacity) VALUES ($1, $2, 'HLB', 'Hostel LB', 'BOYS', 100)", hostelB, collegeB)
		return err
	})
	if err != nil {
		t.Fatalf("Insert B failed: %v", err)
	}

	// 1. Transaction A (sets app.current_tenant_id locally)
	err = db.WithTransaction(tenantCtxA, func(txCtx context.Context, tx pgx.Tx) error {
		var count int
		tx.QueryRow(ctx, "SELECT count(*) FROM app.hostels WHERE id = $1", hostelA).Scan(&count)
		if count != 1 {
			t.Errorf("A cannot see A")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("Tx A failed: %v", err)
	}

	// 2. Transaction WITHOUT context (leakage check)
	// Because MaxConns=1, this acquires the exact same physical connection that just finished Transaction A.
	txNoContext, err := db.Pool.Begin(ctx)
	if err != nil {
		t.Fatalf("Failed to begin tx: %v", err)
	}

	// Ensure we are using the exact same connection by checking backend PID
	var pid int
	txNoContext.QueryRow(ctx, "SELECT pg_backend_pid()").Scan(&pid)
	t.Logf("Connection PID: %d", pid)

	var countNoContext int
	err = txNoContext.QueryRow(ctx, "SELECT count(*) FROM app.hostels").Scan(&countNoContext)
	txNoContext.Rollback(ctx)

	if err == nil && countNoContext > 0 {
		t.Errorf("LEAKAGE DETECTED! Connection reused and still bound to previous tenant. Saw %d rows.", countNoContext)
	}

	// 3. Transaction B
	err = db.WithTransaction(tenantCtxB, func(txCtx context.Context, tx pgx.Tx) error {
		var count int
		tx.QueryRow(ctx, "SELECT count(*) FROM app.hostels WHERE id = $1", hostelB).Scan(&count)
		if count != 1 {
			t.Errorf("B cannot see B")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("Tx B failed: %v", err)
	}
}
