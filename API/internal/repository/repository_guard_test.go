package repository_test

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
)

// mockTx implements pgx.Tx for testing context detection.
type mockTx struct {
	pgx.Tx
}

func (m *mockTx) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	return pgconn.NewCommandTag("SELECT 1"), nil
}

func (m *mockTx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, nil
}

func (m *mockTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return nil
}

func TestRepository_Executor_NoTenant_ReturnsPool(t *testing.T) {
	repo := &repository.Repository{
		Pool: nil, // Nil pool is returned when no tenant ID and no transaction
	}

	ctx := context.Background()
	executor := repo.Executor(ctx)

	if executor != repo.Pool {
		t.Errorf("expected repo.Pool to be returned, got %T", executor)
	}
}

func TestRepository_Executor_WithTx_ReturnsTx(t *testing.T) {
	repo := &repository.Repository{
		Pool: nil,
	}

	tx := &mockTx{}
	ctx := database.WithTx(context.Background(), tx)

	executor := repo.Executor(ctx)
	if executor != tx {
		t.Errorf("expected mockTx to be returned, got %T", executor)
	}
}

func TestRepository_Executor_TenantWithoutTx_FailsClosed(t *testing.T) {
	repo := &repository.Repository{
		Pool: nil,
	}

	tenantID := uuid.New()
	ctx := database.WithTenantID(context.Background(), tenantID)

	executor := repo.Executor(ctx)
	if executor == nil {
		t.Fatal("expected non-nil guard executor, got nil")
	}

	// 1. Verify Exec fails closed
	_, err := executor.Exec(ctx, "SELECT * FROM app.hostels")
	if err == nil {
		t.Error("expected Exec to fail closed without transaction, got nil error")
	} else if !strings.Contains(err.Error(), "tenant-scoped query attempted without active transaction") {
		t.Errorf("unexpected error message: %v", err)
	}

	// 2. Verify Query fails closed
	_, err = executor.Query(ctx, "SELECT * FROM app.hostels")
	if err == nil {
		t.Error("expected Query to fail closed without transaction, got nil error")
	} else if !strings.Contains(err.Error(), "tenant-scoped query attempted without active transaction") {
		t.Errorf("unexpected error message: %v", err)
	}

	// 3. Verify QueryRow.Scan fails closed
	var id uuid.UUID
	err = executor.QueryRow(ctx, "SELECT id FROM app.hostels").Scan(&id)
	if err == nil {
		t.Error("expected QueryRow.Scan to fail closed without transaction, got nil error")
	} else if !strings.Contains(err.Error(), "tenant-scoped query attempted without active transaction") {
		t.Errorf("unexpected error message: %v", err)
	}
}
