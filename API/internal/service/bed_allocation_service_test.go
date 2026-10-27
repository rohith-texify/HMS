package service_test

import (
	"context"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/yourusername/hostel-management-system/API/internal/config"
	"github.com/yourusername/hostel-management-system/API/internal/database"
	"github.com/yourusername/hostel-management-system/API/internal/repository"
	"github.com/yourusername/hostel-management-system/API/internal/service"
)

func setupIntegrationDB(t *testing.T) (*database.Database, *repository.Repository) {
	t.Helper()
	testDBURL := os.Getenv("TEST_DATABASE_URL")
	if testDBURL == "" {
		t.Skip("Skipping integration test: TEST_DATABASE_URL is not set.")
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

	repo := repository.New(db)
	return db, repo
}

func TestBedAllocationService_Create_Integration(t *testing.T) {
	db, repo := setupIntegrationDB(t)
	if db == nil {
		return
	}
	defer db.Close()

	svc := service.NewBedAllocationService(db, repo)
	ctx := context.Background()

	collegeID := uuid.New()
	bedID := uuid.New()
	studentID := uuid.New()
	hostelID := uuid.New()
	blockID := uuid.New()
	floorID := uuid.New()
	roomID := uuid.New()

	// Setup fixtures
	setupCtx := database.WithTenantID(ctx, collegeID)
	tx, err := db.Pool.Begin(setupCtx)
	if err != nil {
		t.Fatalf("setup begin tx: %v", err)
	}
	defer tx.Rollback(setupCtx)
	_ = database.SetTenantContext(setupCtx, tx)

	// Create College
	if _, err := tx.Exec(setupCtx, "INSERT INTO platform.colleges (college_id, college_code, name) VALUES ($1, $2, 'Test')", collegeID, "TEST-"+collegeID.String()[:4]); err != nil {
		t.Fatalf("setup: %v", err)
	}
	// Create Hostel -> Block -> Floor -> Room -> Bed hierarchy
	if _, err := tx.Exec(setupCtx, "INSERT INTO app.hostels (id, college_id, code, name, category) VALUES ($1, $2, 'H1', 'Hostel', 'BOYS')", hostelID, collegeID); err != nil {
		t.Fatalf("setup: %v", err)
	}
	if _, err := tx.Exec(setupCtx, "INSERT INTO app.blocks (id, college_id, hostel_id, code, name) VALUES ($1, $2, $3, 'B1', 'Block')", blockID, collegeID, hostelID); err != nil {
		t.Fatalf("setup: %v", err)
	}
	if _, err := tx.Exec(setupCtx, "INSERT INTO app.floors (id, college_id, hostel_id, block_id, code, name, floor_number) VALUES ($1, $2, $3, $4, 'F1', 'Floor 1', 1)", floorID, collegeID, hostelID, blockID); err != nil {
		t.Fatalf("setup: %v", err)
	}
	if _, err := tx.Exec(setupCtx, "INSERT INTO app.rooms (id, college_id, hostel_id, block_id, floor_id, code, name, capacity) VALUES ($1, $2, $3, $4, $5, 'R1', 'Room 1', 2)", roomID, collegeID, hostelID, blockID, floorID); err != nil {
		t.Fatalf("setup: %v", err)
	}
	if _, err := tx.Exec(setupCtx, "INSERT INTO app.beds (id, college_id, hostel_id, block_id, floor_id, room_id, code, status) VALUES ($1, $2, $3, $4, $5, $6, 'B1', 'AVAILABLE')", bedID, collegeID, hostelID, blockID, floorID, roomID); err != nil {
		t.Fatalf("setup: %v", err)
	}
	// Create Student
	if _, err := tx.Exec(setupCtx, "INSERT INTO app.students (id, college_id, admission_number, first_name, last_name) VALUES ($1, $2, 'ENR1', 'John', 'Doe')", studentID, collegeID); err != nil {
		t.Fatalf("setup: %v", err)
	}

	if err := tx.Commit(setupCtx); err != nil {
		t.Fatalf("setup commit: %v", err)
	}

	// Clean up fixtures
	defer func() {
		_, _ = db.Pool.Exec(context.Background(), "DELETE FROM platform.colleges WHERE college_id = $1", collegeID)
	}()

	t.Run("Successful allocation", func(t *testing.T) {
		allocCtx := database.WithTenantID(ctx, collegeID)
		_, err := svc.Create(allocCtx, collegeID, bedID, &studentID, "REGULAR", time.Now(), nil, nil)
		if err != nil {
			t.Fatalf("Expected successful allocation, got error: %v", err)
		}
	})

	t.Run("Rejects already occupied bed", func(t *testing.T) {
		allocCtx := database.WithTenantID(ctx, collegeID)
		otherStudent := uuid.New()
		tx2, err := db.Pool.Begin(allocCtx)
		if err != nil {
			t.Fatalf("tx begin: %v", err)
		}
		defer tx2.Rollback(allocCtx)
		_ = database.SetTenantContext(allocCtx, tx2)
		if _, err := tx2.Exec(allocCtx, "INSERT INTO app.students (id, college_id, admission_number, first_name, last_name) VALUES ($1, $2, 'ENR2', 'Jane', 'Doe')", otherStudent, collegeID); err != nil {
			t.Fatalf("student insert: %v", err)
		}
		if err := tx2.Commit(allocCtx); err != nil {
			t.Fatalf("commit: %v", err)
		}

		// bedID is already allocated to studentID from the previous test
		_, err = svc.Create(allocCtx, collegeID, bedID, &otherStudent, "REGULAR", time.Now(), nil, nil)
		if err == nil {
			t.Errorf("Expected allocation to fail on occupied bed, but it succeeded")
		}
	})
}
