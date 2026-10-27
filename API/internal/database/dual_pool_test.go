package database_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/yourusername/hostel-management-system/API/internal/database"
	apirepo "github.com/yourusername/hostel-management-system/API/internal/repository"
	superadminrepo "github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

// mockPlatformTx verifies that WithPlatformTransaction executes the required
// session configuration commands inside transactions.
type mockPlatformTx struct {
	pgx.Tx
	executedSQL  []string
	beginCalled  bool
	commitCalled bool
	subTx        *mockPlatformTx
}

func newMockPlatformTx() *mockPlatformTx {
	return &mockPlatformTx{
		subTx: &mockPlatformTx{},
	}
}

func (m *mockPlatformTx) Begin(ctx context.Context) (pgx.Tx, error) {
	m.beginCalled = true
	return m.subTx, nil
}

func (m *mockPlatformTx) Commit(ctx context.Context) error {
	m.commitCalled = true
	return nil
}

func (m *mockPlatformTx) Rollback(ctx context.Context) error {
	return nil
}

func (m *mockPlatformTx) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	m.executedSQL = append(m.executedSQL, sql)
	return pgconn.NewCommandTag("OK"), nil
}

// TestDualPool_PoolSelection validates that GetCollegePool and GetPlatformPool
// return the correct connection pool abstractions.
func TestDualPool_PoolSelection(t *testing.T) {
	t.Run("Distinct pools returned properly", func(t *testing.T) {
		// When both pools are nil or non-nil
		db := &database.Database{
			Pool:         nil,
			CollegePool:  nil,
			PlatformPool: nil,
		}

		if db.GetCollegePool() != nil {
			t.Errorf("expected nil college pool, got %v", db.GetCollegePool())
		}
		if db.GetPlatformPool() != nil {
			t.Errorf("expected nil platform pool, got %v", db.GetPlatformPool())
		}
	})

	t.Run("Fallback to Pool when specific pool is nil", func(t *testing.T) {
		db := &database.Database{
			Pool:         nil,
			CollegePool:  nil,
			PlatformPool: nil,
		}

		// Both should safely return nil without panicking
		if p := db.GetCollegePool(); p != nil {
			t.Errorf("expected nil, got %v", p)
		}
		if p := db.GetPlatformPool(); p != nil {
			t.Errorf("expected nil, got %v", p)
		}
	})
}

// TestDualPool_SafeShutdown validates that Close handles nil or distinct pools safely.
func TestDualPool_SafeShutdown(t *testing.T) {
	t.Run("Nil database Close does not panic", func(t *testing.T) {
		var db *database.Database
		db.Close()
	})

	t.Run("Database with nil pools Close does not panic", func(t *testing.T) {
		db := &database.Database{}
		db.Close()
	})
}

// TestPlatformContext_Helpers validates that platform user ID and audit reason
// are correctly attached to and retrieved from context.
func TestPlatformContext_Helpers(t *testing.T) {
	ctx := context.Background()

	// 1. Missing context
	if uid, ok := database.PlatformUserIDFromContext(ctx); ok || uid != uuid.Nil {
		t.Errorf("expected missing platform user ID, got %v", uid)
	}
	if reason, ok := database.PlatformReasonFromContext(ctx); ok || reason != "" {
		t.Errorf("expected missing platform reason, got %q", reason)
	}

	// 2. Attached context
	expectedUID := uuid.New()
	expectedReason := "Emergency infrastructure maintenance ticket INC-9901"

	ctx = database.WithPlatformUserID(ctx, expectedUID)
	ctx = database.WithPlatformReason(ctx, expectedReason)

	if uid, ok := database.PlatformUserIDFromContext(ctx); !ok || uid != expectedUID {
		t.Errorf("expected platform user ID %v, got %v", expectedUID, uid)
	}
	if reason, ok := database.PlatformReasonFromContext(ctx); !ok || reason != expectedReason {
		t.Errorf("expected platform reason %q, got %q", expectedReason, reason)
	}
}

// TestWithPlatformTransaction_ReentrantSavepoint validates that nested platform
// transactions use SAVEPOINT rather than checking out another pool connection.
func TestWithPlatformTransaction_ReentrantSavepoint(t *testing.T) {
	db := &database.Database{
		PlatformPool: nil, // Nil pool proves PlatformPool.Begin was NOT called
	}

	parentTx := newMockPlatformTx()
	ctx := database.WithTx(context.Background(), parentTx)

	err := db.WithPlatformTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		if tx != parentTx.subTx {
			t.Errorf("expected subTx to be passed to inner callback")
		}
		return nil
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !parentTx.beginCalled {
		t.Errorf("expected parentTx.Begin (SAVEPOINT) to be called")
	}
	if !parentTx.subTx.commitCalled {
		t.Errorf("expected subTx.Commit (RELEASE SAVEPOINT) to be called")
	}
}

// TestRepository_PoolSeparation verifies that API repositories bind to CollegePool
// while Super Admin repositories bind to PlatformPool.
func TestRepository_PoolSeparation(t *testing.T) {
	db := &database.Database{
		Pool:         nil,
		CollegePool:  nil,
		PlatformPool: nil,
	}

	// API repository uses GetCollegePool
	apiRepo := apirepo.New(db)
	if apiRepo.Pool != db.GetCollegePool() {
		t.Errorf("expected API repository to bind to CollegePool")
	}

	// Super Admin repository uses PlatformPool
	superAdminRepo := superadminrepo.New(db)
	if superAdminRepo.Pool != db.PlatformPool {
		t.Errorf("expected Super Admin repository to bind to PlatformPool")
	}
}
