package repository_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/yourusername/hostel-management-system/API/database"
	"github.com/yourusername/hostel-management-system/MODULES/SUPER-ADMIN/BACKEND/repository"
)

type mockTx struct {
	pgx.Tx
}

func (m *mockTx) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	return pgconn.NewCommandTag("MOCK_OK"), nil
}

func (m *mockTx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, nil
}

func (m *mockTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return nil
}

// -----------------------------------------------------------------------------
// 1. PLATFORM POOL SELECTION TESTS
// -----------------------------------------------------------------------------

func TestRepository_Constructor_PlatformPoolSelection(t *testing.T) {
	// Distinct pointers to ensure identity assertions are rigorous
	collegePool := &pgxpool.Pool{}
	platformPool := &pgxpool.Pool{}

	if collegePool == platformPool {
		t.Fatal("expected test pool pointers to be distinct")
	}

	db := &database.Database{
		Pool:         collegePool,
		CollegePool:  collegePool,
		PlatformPool: platformPool,
	}

	t.Run("New selects PlatformPool over primary Pool", func(t *testing.T) {
		repo := repository.New(db)
		if repo == nil {
			t.Fatal("expected non-nil repository")
		}
		if repo.Pool != platformPool {
			t.Errorf("expected repo.Pool to equal platformPool (%p), got %p", platformPool, repo.Pool)
		}
		if repo.Pool == collegePool {
			t.Errorf("security violation: repo.Pool selected collegePool (%p)", collegePool)
		}
	})

	t.Run("NewValidated selects PlatformPool over primary Pool", func(t *testing.T) {
		repo, err := repository.NewValidated(db)
		if err != nil {
			t.Fatalf("unexpected error from NewValidated: %v", err)
		}
		if repo == nil {
			t.Fatal("expected non-nil repository")
		}
		if repo.Pool != platformPool {
			t.Errorf("expected repo.Pool to equal platformPool (%p), got %p", platformPool, repo.Pool)
		}
		if repo.Pool == collegePool {
			t.Errorf("security violation: repo.Pool selected collegePool (%p)", collegePool)
		}
	})
}

// -----------------------------------------------------------------------------
// 2. NO SILENT FALLBACK TESTS
// -----------------------------------------------------------------------------

func TestRepository_Constructor_MissingPlatformPool_NoSilentFallback(t *testing.T) {
	collegePool := &pgxpool.Pool{}

	// Database with only CollegePool configured; PlatformPool is absent
	db := &database.Database{
		Pool:         collegePool,
		CollegePool:  collegePool,
		PlatformPool: nil,
	}

	t.Run("New never silently falls back to collegePool", func(t *testing.T) {
		repo := repository.New(db)
		if repo == nil {
			t.Fatal("expected non-nil repository struct")
		}
		if repo.Pool != nil {
			t.Errorf("security violation: expected repo.Pool to be nil when PlatformPool is absent, got %p", repo.Pool)
		}
		if repo.Pool == collegePool {
			t.Errorf("security violation: repo silently fell back to collegePool (%p)", collegePool)
		}
	})

	t.Run("NewValidated rejects missing PlatformPool with ErrPlatformPoolRequired", func(t *testing.T) {
		repo, err := repository.NewValidated(db)
		if !errors.Is(err, repository.ErrPlatformPoolRequired) {
			t.Errorf("expected ErrPlatformPoolRequired, got %v", err)
		}
		if repo != nil {
			t.Errorf("expected nil repo on validation failure, got %v", repo)
		}
	})
}

// -----------------------------------------------------------------------------
// 3. NIL DATABASE CONFIGURATION TESTS
// -----------------------------------------------------------------------------

func TestRepository_Constructor_NilDatabase(t *testing.T) {
	t.Run("New handles nil database gracefully without panic", func(t *testing.T) {
		repo := repository.New(nil)
		if repo == nil {
			t.Fatal("expected non-nil repository container")
		}
		if repo.Pool != nil {
			t.Errorf("expected nil pool for nil database, got %p", repo.Pool)
		}
	})

	t.Run("NewValidated rejects nil database with ErrNilDatabase", func(t *testing.T) {
		repo, err := repository.NewValidated(nil)
		if !errors.Is(err, repository.ErrNilDatabase) {
			t.Errorf("expected ErrNilDatabase, got %v", err)
		}
		if repo != nil {
			t.Errorf("expected nil repo on nil database input, got %v", repo)
		}
	})
}

// -----------------------------------------------------------------------------
// 4. EXPLICIT POOL CONSTRUCTORS
// -----------------------------------------------------------------------------

func TestRepository_ExplicitPoolConstructors(t *testing.T) {
	explicitPool := &pgxpool.Pool{}

	t.Run("NewWithPool binds explicitly provided pool", func(t *testing.T) {
		repo := repository.NewWithPool(explicitPool)
		if repo == nil {
			t.Fatal("expected non-nil repository")
		}
		if repo.Pool != explicitPool {
			t.Errorf("expected repo.Pool to be %p, got %p", explicitPool, repo.Pool)
		}
	})

	t.Run("NewWithPool handles nil pool safely", func(t *testing.T) {
		repo := repository.NewWithPool(nil)
		if repo == nil {
			t.Fatal("expected non-nil repository")
		}
		if repo.Pool != nil {
			t.Errorf("expected repo.Pool to be nil, got %p", repo.Pool)
		}
	})

	t.Run("NewWithPlatformPool succeeds with valid pool", func(t *testing.T) {
		repo, err := repository.NewWithPlatformPool(explicitPool)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if repo == nil || repo.Pool != explicitPool {
			t.Errorf("expected repo.Pool to be %p, got %v", explicitPool, repo)
		}
	})

	t.Run("NewWithPlatformPool rejects nil pool", func(t *testing.T) {
		repo, err := repository.NewWithPlatformPool(nil)
		if !errors.Is(err, repository.ErrPlatformPoolRequired) {
			t.Errorf("expected ErrPlatformPoolRequired, got %v", err)
		}
		if repo != nil {
			t.Errorf("expected nil repo on nil pool, got %v", repo)
		}
	})
}

// -----------------------------------------------------------------------------
// 5. EXECUTOR TRANSACTION PREFERENCE TESTS
// -----------------------------------------------------------------------------

func TestRepository_Executor_TransactionPreference(t *testing.T) {
	configuredPool := &pgxpool.Pool{}
	mockTransaction := &mockTx{}

	ctxWithTx := repository.WithTx(context.Background(), mockTransaction)
	ctxWithoutTx := context.Background()

	t.Run("Executor prefers contextual transaction over configured pool", func(t *testing.T) {
		repo := repository.NewWithPool(configuredPool)

		executor := repo.Executor(ctxWithTx)
		if executor == nil {
			t.Fatal("expected non-nil executor")
		}
		if executor != mockTransaction {
			t.Errorf("expected executor to be contextual transaction (%p), got %p", mockTransaction, executor)
		}
		if executor == configuredPool {
			t.Errorf("security violation: executor unexpectedly replaced active transaction with pool")
		}
	})

	t.Run("Executor returns contextual transaction even when repo pool is unconfigured", func(t *testing.T) {
		repo := repository.New(nil)

		executor := repo.Executor(ctxWithTx)
		if executor != mockTransaction {
			t.Errorf("expected executor to return contextual transaction (%p), got %p", mockTransaction, executor)
		}
	})

	t.Run("Executor returns configured pool when no transaction in context", func(t *testing.T) {
		repo := repository.NewWithPool(configuredPool)

		executor := repo.Executor(ctxWithoutTx)
		if executor != configuredPool {
			t.Errorf("expected executor to be configured pool (%p), got %p", configuredPool, executor)
		}
	})
}

// -----------------------------------------------------------------------------
// 6. SAFE FAILURE ON UNCONFIGURED REPOSITORY (FAIL-CLOSED)
// -----------------------------------------------------------------------------

func TestRepository_Executor_UnconfiguredFailsSafely(t *testing.T) {
	testCases := []struct {
		name string
		repo *repository.Repository
	}{
		{
			name: "New with nil database",
			repo: repository.New(nil),
		},
		{
			name: "New with database lacking PlatformPool",
			repo: repository.New(&database.Database{Pool: &pgxpool.Pool{}, PlatformPool: nil}),
		},
		{
			name: "NewWithPool with nil pool",
			repo: repository.NewWithPool(nil),
		},
		{
			name: "Direct struct with nil pool",
			repo: &repository.Repository{Pool: nil},
		},
		{
			name: "Nil repository pointer",
			repo: nil,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			executor := tc.repo.Executor(ctx)
			if executor == nil {
				t.Fatal("expected non-nil safe executor (fail-closed implementation)")
			}

			// 1. Exec must return ErrPlatformPoolNotConfigured without panicking
			tag, err := executor.Exec(ctx, "UPDATE platform.colleges SET status = 'ACTIVE'")
			if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
				t.Errorf("Exec: expected ErrPlatformPoolNotConfigured, got %v", err)
			}
			if tag.RowsAffected() != 0 {
				t.Errorf("Exec: expected 0 rows affected, got %d", tag.RowsAffected())
			}

			// 2. Query must return ErrPlatformPoolNotConfigured and safe empty rows
			rows, err := executor.Query(ctx, "SELECT college_id FROM platform.colleges")
			if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
				t.Errorf("Query: expected ErrPlatformPoolNotConfigured, got %v", err)
			}
			if rows == nil {
				t.Fatal("Query: expected safe non-nil rows object")
			}
			// Safe methods on empty rows must not panic
			rows.Close()
			if rows.Next() {
				t.Error("Query: expected rows.Next() to be false")
			}
			if !errors.Is(rows.Err(), repository.ErrPlatformPoolNotConfigured) {
				t.Errorf("Query: expected rows.Err() to be ErrPlatformPoolNotConfigured, got %v", rows.Err())
			}

			// 3. QueryRow Scan must return ErrPlatformPoolNotConfigured without panicking
			var dummyID uuid.UUID
			scanErr := executor.QueryRow(ctx, "SELECT college_id FROM platform.colleges WHERE college_id = $1", uuid.New()).Scan(&dummyID)
			if !errors.Is(scanErr, repository.ErrPlatformPoolNotConfigured) {
				t.Errorf("QueryRow: expected ErrPlatformPoolNotConfigured, got %v", scanErr)
			}
		})
	}
}

// -----------------------------------------------------------------------------
// 7. HIGH-LEVEL DOMAIN METHOD SAFETY ON UNCONFIGURED REPOSITORY
// -----------------------------------------------------------------------------

func TestRepository_DomainMethods_UnconfiguredSafety(t *testing.T) {
	repo := repository.New(nil)
	ctx := context.Background()
	collegeID := uuid.New()

	t.Run("GetCollegeByID fails safely", func(t *testing.T) {
		college, err := repo.GetCollegeByID(ctx, collegeID)
		if college != nil {
			t.Errorf("expected nil college, got %v", college)
		}
		if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
			t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
		}
	})

	t.Run("ListColleges fails safely", func(t *testing.T) {
		colleges, count, err := repo.ListColleges(ctx, nil, 10, 0)
		if colleges != nil || count != 0 {
			t.Errorf("expected nil colleges and count 0, got %v, %d", colleges, count)
		}
		if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
			t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
		}
	})

	t.Run("SeedCollegeOnboarding fails safely", func(t *testing.T) {
		err := repo.SeedCollegeOnboarding(ctx, collegeID)
		if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
			t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
		}
	})

	t.Run("GetCollegeOnboarding fails safely", func(t *testing.T) {
		steps, err := repo.GetCollegeOnboarding(ctx, collegeID)
		if steps != nil {
			t.Errorf("expected nil steps, got %v", steps)
		}
		if !errors.Is(err, repository.ErrPlatformPoolNotConfigured) {
			t.Errorf("expected ErrPlatformPoolNotConfigured, got %v", err)
		}
	})
}

// -----------------------------------------------------------------------------
// 8. COMPATIBILITY MATRIX TABLE TEST
// -----------------------------------------------------------------------------

func TestRepository_CompatibilityMatrix(t *testing.T) {
	primary := &pgxpool.Pool{}
	platform := &pgxpool.Pool{}

	tests := []struct {
		name                 string
		db                   *database.Database
		expectedPool         *pgxpool.Pool
		expectErrOnValidated bool
	}{
		{
			name:                 "nil database",
			db:                   nil,
			expectedPool:         nil,
			expectErrOnValidated: true,
		},
		{
			name: "both pools nil",
			db: &database.Database{
				Pool:         nil,
				PlatformPool: nil,
			},
			expectedPool:         nil,
			expectErrOnValidated: true,
		},
		{
			name: "primary present, platform absent (crucial anti-fallback check)",
			db: &database.Database{
				Pool:         primary,
				PlatformPool: nil,
			},
			expectedPool:         nil, // Must NOT fall back to primary!
			expectErrOnValidated: true,
		},
		{
			name: "primary absent, platform present",
			db: &database.Database{
				Pool:         nil,
				PlatformPool: platform,
			},
			expectedPool:         platform,
			expectErrOnValidated: false,
		},
		{
			name: "both pools present",
			db: &database.Database{
				Pool:         primary,
				PlatformPool: platform,
			},
			expectedPool:         platform,
			expectErrOnValidated: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			repo := repository.New(tc.db)
			if repo == nil {
				t.Fatal("expected non-nil repository")
			}
			if repo.Pool != tc.expectedPool {
				t.Errorf("New: expected pool %p, got %p", tc.expectedPool, repo.Pool)
			}
			if tc.db != nil && tc.db.Pool != nil && tc.db.PlatformPool == nil && repo.Pool == tc.db.Pool {
				t.Errorf("New: security flaw - silently fell back to primary pool")
			}

			valRepo, err := repository.NewValidated(tc.db)
			if tc.expectErrOnValidated {
				if err == nil {
					t.Errorf("NewValidated: expected error, got nil")
				}
				if valRepo != nil {
					t.Errorf("NewValidated: expected nil repo on error, got %v", valRepo)
				}
			} else {
				if err != nil {
					t.Errorf("NewValidated: unexpected error: %v", err)
				}
				if valRepo == nil || valRepo.Pool != tc.expectedPool {
					t.Errorf("NewValidated: expected pool %p, got %v", tc.expectedPool, valRepo)
				}
			}
		})
	}
}
