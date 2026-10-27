package database_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/yourusername/hostel-management-system/API/internal/database"
)

type mockReentrantTx struct {
	pgx.Tx
	beginCalled    bool
	commitCalled   bool
	rollbackCalled bool
	subTx          *mockReentrantTx
}

func newMockReentrantTx() *mockReentrantTx {
	return &mockReentrantTx{
		subTx: &mockReentrantTx{},
	}
}

func (m *mockReentrantTx) Begin(ctx context.Context) (pgx.Tx, error) {
	m.beginCalled = true
	return m.subTx, nil
}

func (m *mockReentrantTx) Commit(ctx context.Context) error {
	m.commitCalled = true
	return nil
}

func (m *mockReentrantTx) Rollback(ctx context.Context) error {
	m.rollbackCalled = true
	return nil
}

func (m *mockReentrantTx) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	return pgconn.NewCommandTag("OK"), nil
}

func (m *mockReentrantTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return nil
}

func TestWithTransaction_Reentrant_SavepointSuccess(t *testing.T) {
	db := &database.Database{
		Pool: nil, // Nil pool proves Pool.Begin was NOT called!
	}

	parentTx := newMockReentrantTx()
	ctx := database.WithTx(context.Background(), parentTx)

	var innerTxReceived pgx.Tx
	err := db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		innerTxReceived = tx
		return nil
	})

	if err != nil {
		t.Fatalf("expected nil error, got: %v", err)
	}

	if !parentTx.beginCalled {
		t.Error("expected parentTx.Begin to be called to start savepoint")
	}

	if innerTxReceived != parentTx.subTx {
		t.Errorf("expected inner tx to be subTx, got %v", innerTxReceived)
	}

	if !parentTx.subTx.commitCalled {
		t.Error("expected subTx.Commit to be called")
	}

	if parentTx.subTx.rollbackCalled {
		t.Error("subTx.Rollback should not be called on success")
	}
}

func TestWithTransaction_Reentrant_SavepointRollback(t *testing.T) {
	db := &database.Database{
		Pool: nil, // Nil pool proves Pool.Begin was NOT called!
	}

	parentTx := newMockReentrantTx()
	ctx := database.WithTx(context.Background(), parentTx)

	expectedErr := errors.New("business validation failed")
	err := db.WithTransaction(ctx, func(txCtx context.Context, tx pgx.Tx) error {
		return expectedErr
	})

	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected error %v, got %v", expectedErr, err)
	}

	if !parentTx.beginCalled {
		t.Error("expected parentTx.Begin to be called to start savepoint")
	}

	if !parentTx.subTx.rollbackCalled {
		t.Error("expected subTx.Rollback to be called on failure")
	}

	if parentTx.subTx.commitCalled {
		t.Error("subTx.Commit should not be called on failure")
	}
}
